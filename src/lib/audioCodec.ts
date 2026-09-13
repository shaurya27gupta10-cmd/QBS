/**
 * QBS Secure Sound - Audio Codec Module
 * Synthesizes digital audio signal (FSK modulation) and encodes/decodes
 * the encrypted binary payload into reliable WAV format.
 */

import { base64ToBytes } from './crypto';

const SAMPLE_RATE = 44100;
const FREQ_SPACE = 1200; // Bit 0 frequency (Hz)
const FREQ_MARK = 2000;  // Bit 1 frequency (Hz)
const FREQ_PILOT = 2400; // Sync pilot tone frequency (Hz)
const FREQ_END = 1600;   // End marker frequency (Hz)

/**
 * Generates a formatted filename: QBS-Secure-YYYYMMDD-HHMMSS.wav
 */
export function generateFilename(date: Date = new Date(), ext: string = 'wav'): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `QBS-Secure-${yyyy}${mm}${dd}-${hh}${min}${ss}.${ext}`;
}

/**
 * Synthesizes modulated audio PCM samples (16-bit signed integers)
 * from the binary payload using Continuous Phase Frequency Shift Keying (CPFSK).
 */
export function synthesizeFskPcm(payload: Uint8Array): {
  pcmSamples: Int16Array;
  durationSeconds: number;
} {
  // For telemetry audio playback: if payload is large (such as encrypted files),
  // modulate the cryptographic header, distributed sample frames, and CRC chunk (up to 512 bytes)
  // so audio synthesis is fast and safe from memory exhaustion (audio stays 2.5 - 4.5s)
  const maxModBytes = 512;
  let bytesToModulate: Uint8Array;
  if (payload.length <= maxModBytes) {
    bytesToModulate = payload;
  } else {
    bytesToModulate = new Uint8Array(maxModBytes);
    // Copy first 128 bytes (magic, version, salt, iv, metadata)
    bytesToModulate.set(payload.subarray(0, 128), 0);
    // Evenly sample the middle ciphertext
    const step = Math.max(1, Math.floor((payload.length - 144) / (maxModBytes - 144)));
    for (let i = 128; i < maxModBytes - 16; i++) {
      const srcIdx = Math.min(payload.length - 17, 128 + (i - 128) * step);
      bytesToModulate[i] = payload[srcIdx];
    }
    // Copy last 16 bytes (auth tag & CRC32)
    bytesToModulate.set(payload.subarray(payload.length - 16), maxModBytes - 16);
  }

  // Determine symbol duration based on modulated bytes
  const totalBits = bytesToModulate.length * 8;
  const bitDurationSec = Math.max(0.0006, Math.min(0.004, 3.2 / Math.max(totalBits, 1)));
  const samplesPerBit = Math.max(24, Math.floor(SAMPLE_RATE * bitDurationSec));

  const pilotSamples = Math.floor(SAMPLE_RATE * 0.20); // 200ms pilot
  const endSamples = Math.floor(SAMPLE_RATE * 0.15);   // 150ms end marker
  const totalPcmSamples = pilotSamples + totalBits * samplesPerBit + endSamples;

  const pcm = new Int16Array(totalPcmSamples);
  let phase = 0;
  let sampleIndex = 0;

  // 1. Pilot Tone (2400 Hz) with fade-in
  for (let i = 0; i < pilotSamples; i++) {
    const envelope = Math.min(1, i / (SAMPLE_RATE * 0.03)); // 30ms fade-in
    phase += (2 * Math.PI * FREQ_PILOT) / SAMPLE_RATE;
    const sampleVal = Math.sin(phase) * 0.7 * envelope;
    pcm[sampleIndex++] = Math.floor(sampleVal * 32767);
  }

  // 2. Data Bits (FSK modulated)
  for (let byteIdx = 0; byteIdx < bytesToModulate.length; byteIdx++) {
    const byte = bytesToModulate[byteIdx];
    for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
      const bit = (byte >> bitIdx) & 1;
      const freq = bit === 1 ? FREQ_MARK : FREQ_SPACE;

      for (let s = 0; s < samplesPerBit; s++) {
        phase += (2 * Math.PI * freq) / SAMPLE_RATE;
        if (phase > 2 * Math.PI) phase -= 2 * Math.PI;

        let bitEnv = 1.0;
        const rampLen = Math.floor(samplesPerBit * 0.15);
        if (s < rampLen) {
          bitEnv = 0.5 * (1 - Math.cos((Math.PI * s) / rampLen));
        } else if (s > samplesPerBit - rampLen) {
          const remaining = samplesPerBit - s;
          bitEnv = 0.5 * (1 - Math.cos((Math.PI * remaining) / rampLen));
        }

        const sampleVal = (Math.sin(phase) * 0.8 + Math.sin(2 * phase) * 0.1) * bitEnv;
        pcm[sampleIndex++] = Math.floor(sampleVal * 32767);
      }
    }
  }

  // 3. End Marker (1600 Hz) with fade-out
  for (let i = 0; i < endSamples; i++) {
    const envelope = Math.max(0, 1 - i / endSamples);
    phase += (2 * Math.PI * FREQ_END) / SAMPLE_RATE;
    const sampleVal = Math.sin(phase) * 0.6 * envelope;
    pcm[sampleIndex++] = Math.floor(sampleVal * 32767);
  }

  return {
    pcmSamples: pcm,
    durationSeconds: totalPcmSamples / SAMPLE_RATE,
  };
}

/**
 * Builds a valid standard RIFF WAV file containing:
 * - fmt chunk (16-bit PCM, 44.1kHz mono)
 * - qbsd chunk (embedded exact encrypted binary payload)
 * - data chunk (synthesized FSK audio samples)
 */
export function buildWavFile(pcmSamples: Int16Array, payload: Uint8Array): Blob {
  const pcmBytesLength = pcmSamples.length * 2;

  // QBSD chunk size: 4 bytes ID 'qbsd' + 4 bytes length + payload bytes (+ 1 pad byte if odd)
  const padByte = payload.length % 2 === 1 ? 1 : 0;
  const qbsdChunkSize = 8 + payload.length + padByte;

  // FMT chunk size: 4 ('fmt ') + 4 (length 16) + 16 (params) = 24 bytes
  const fmtChunkSize = 24;

  // DATA chunk size: 4 ('data') + 4 (length) + pcmBytesLength
  const dataChunkSize = 8 + pcmBytesLength;

  // RIFF container size: 4 ('WAVE') + fmtChunk + qbsdChunk + dataChunk
  const totalRiffSize = 4 + fmtChunkSize + qbsdChunkSize + dataChunkSize;

  const buffer = new ArrayBuffer(8 + totalRiffSize);
  const view = new DataView(buffer);
  let offset = 0;

  // Helper string writer
  const writeString = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset++, str.charCodeAt(i));
    }
  };

  // 1. RIFF Header
  writeString('RIFF');
  view.setUint32(offset, totalRiffSize, true); // Little-Endian
  offset += 4;
  writeString('WAVE');

  // 2. FMT Chunk
  writeString('fmt ');
  view.setUint32(offset, 16, true); // Subchunk1Size = 16 for PCM
  offset += 4;
  view.setUint16(offset, 1, true); // AudioFormat = 1 (PCM)
  offset += 2;
  view.setUint16(offset, 1, true); // NumChannels = 1 (Mono)
  offset += 2;
  view.setUint32(offset, SAMPLE_RATE, true); // SampleRate = 44100
  offset += 4;
  view.setUint32(offset, SAMPLE_RATE * 2, true); // ByteRate = SampleRate * NumChannels * BitsPerSample/8
  offset += 4;
  view.setUint16(offset, 2, true); // BlockAlign = NumChannels * BitsPerSample/8
  offset += 2;
  view.setUint16(offset, 16, true); // BitsPerSample = 16
  offset += 2;

  // 3. Custom 'qbsd' Chunk (QBS Encrypted Data Payload)
  writeString('qbsd');
  view.setUint32(offset, payload.length, true);
  offset += 4;
  new Uint8Array(buffer, offset, payload.length).set(payload);
  offset += payload.length;
  if (padByte) {
    view.setUint8(offset++, 0);
  }

  // 4. DATA Chunk
  writeString('data');
  view.setUint32(offset, pcmBytesLength, true);
  offset += 4;

  // Write PCM 16-bit samples
  const pcmView = new Int16Array(buffer, offset, pcmSamples.length);
  pcmView.set(pcmSamples);

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Extracts the encrypted binary payload from a WAV ArrayBuffer or raw .qbs payload container.
 * Parses the RIFF container format to locate the 'qbsd' chunk, or handles raw QBS payloads directly.
 */
export function extractPayloadFromWav(arrayBuffer: ArrayBuffer): Uint8Array {
  const view = new DataView(arrayBuffer);

  // 1. Direct Binary Check: Is this a raw .qbs payload starting with magic header?
  if (arrayBuffer.byteLength >= 4) {
    const magicStr = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    if (magicStr === 'QBSS' || magicStr === 'QBS1' || magicStr === 'QBSF') {
      return new Uint8Array(arrayBuffer);
    }
  }

  // 2. Text / Base64 Check: Is this a text file containing an exported QBS string?
  try {
    const textSample = new TextDecoder().decode(
      new Uint8Array(arrayBuffer.slice(0, Math.min(256, arrayBuffer.byteLength)))
    );
    if (/(?:QBSS|QBSF|QBS1|QBS2|QBS):/i.test(textSample.trim())) {
      const fullText = new TextDecoder().decode(new Uint8Array(arrayBuffer));
      const match = fullText.match(/(?:QBSS|QBSF|QBS1|QBS2|QBS):([A-Za-z0-9+/=_-]{12,})/i);
      if (match) {
        return base64ToBytes(match[1]);
      }
    }
  } catch {
    // Non-text binary, continue to RIFF WAVE parsing
  }

  // 3. RIFF WAVE Header Check
  if (arrayBuffer.byteLength < 44) {
    throw new Error('The audio does not contain a valid QBS secure payload.');
  }

  const riffStr = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  const waveStr = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11)
  );

  if (riffStr !== 'RIFF' || waveStr !== 'WAVE') {
    throw new Error('This audio format is not supported. Please use a QBS WAV file.');
  }

  // Iterate over RIFF chunks starting at byte 12
  let offset = 12;
  while (offset + 8 <= arrayBuffer.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);
    offset += 8;

    if (chunkId === 'qbsd') {
      if (offset + chunkSize > arrayBuffer.byteLength) {
        throw new Error('The audio does not contain a valid QBS secure payload.');
      }
      return new Uint8Array(arrayBuffer.slice(offset, offset + chunkSize));
    }

    // Skip chunk data (chunks are padded to even 2-byte boundaries in RIFF)
    const paddedSize = chunkSize + (chunkSize % 2);
    offset += paddedSize;
  }

  // If no 'qbsd' chunk found in the WAV file
  throw new Error('The audio does not contain a valid QBS secure payload.');
}
