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
export function buildWavFile(
  pcmInput: Int16Array | { pcmSamples: Int16Array },
  payload: Uint8Array
): Blob {
  const pcmSamples = pcmInput instanceof Int16Array ? pcmInput : pcmInput.pcmSamples;
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
 * Parses the RIFF container format to locate the 'qbsd' chunk, handles ID3 wrappers,
 * performs deep buffer scanning for the embedded container, and reports clear actionable guidance.
 */
export function extractPayloadFromWav(input: ArrayBuffer | Uint8Array): Uint8Array {
  let bytes: Uint8Array;
  let arrayBuffer: ArrayBuffer;

  if (input instanceof Uint8Array) {
    bytes = input;
    arrayBuffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  } else if (input instanceof ArrayBuffer) {
    arrayBuffer = input;
    bytes = new Uint8Array(input);
  } else {
    throw new Error('Invalid input format provided to audio extractor.');
  }

  const totalLength = bytes.length;

  if (totalLength < 16) {
    throw new Error('The uploaded file is too small to contain a valid QBS payload.');
  }

  // 1. Direct Binary Check: Is this a raw .qbs payload starting with magic header?
  const first4 = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (first4 === 'QBSS' || first4 === 'QBS1' || first4 === 'QBSF') {
    const clean = new Uint8Array(totalLength);
    clean.set(bytes);
    return clean;
  }

  // 2. Text / Base64 Check: Is this a text file containing an exported QBS string?
  try {
    const textSample = new TextDecoder().decode(bytes.subarray(0, Math.min(512, totalLength)));
    // Normalize spaces around colons (e.g. QBSF : <b64>)
    const normalizedSample = textSample.replace(/(?:QBSS|QBSF|QBS1|QBS2|QBS)\s*:\s*/i, 'QBSS:');
    if (/(?:QBSS|QBSF|QBS1|QBS2|QBS):/i.test(normalizedSample)) {
      const fullText = new TextDecoder().decode(bytes);
      const cleaned = fullText.replace(/(QBSS|QBSF|QBS1|QBS2|QBS)\s*:\s*/gi, '$1:');
      const match = cleaned.match(/(?:QBSS|QBSF|QBS1|QBS2|QBS):([A-Za-z0-9+/=_-]{12,})/i);
      if (match) {
        return base64ToBytes(match[1]);
      }
    }
  } catch {
    // Non-text binary, continue to container parsing
  }

  // 3. Fast Deep Scan for 'qbsd' chunk signature (0x71, 0x62, 0x73, 0x64) anywhere in the file
  // This succeeds even if the WAV file was prepended with ID3 tags or wrapped in another format
  for (let i = 0; i <= totalLength - 8; i++) {
    if (
      bytes[i] === 0x71 && // 'q'
      bytes[i + 1] === 0x62 && // 'b'
      bytes[i + 2] === 0x73 && // 's'
      bytes[i + 3] === 0x64    // 'd'
    ) {
      // 4-byte little-endian length
      const chunkSize =
        bytes[i + 4] |
        (bytes[i + 5] << 8) |
        (bytes[i + 6] << 16) |
        (bytes[i + 7] << 24);

      if (chunkSize > 0 && i + 8 + chunkSize <= totalLength) {
        const clean = new Uint8Array(chunkSize);
        clean.set(bytes.subarray(i + 8, i + 8 + chunkSize));
        return clean;
      }
    }
  }

  // 4. Scan for embedded QBSS, QBSF, or QBS1 magic header anywhere in the buffer
  // (In case an audio converter, editor, or player modified the container wrapper)
  for (let i = 0; i <= totalLength - 32; i++) {
    if (bytes[i] === 0x51 && bytes[i + 1] === 0x42 && bytes[i + 2] === 0x53) {
      const char4 = String.fromCharCode(bytes[i + 3]);
      if (char4 === 'S') {
        // v2 QBSS: Extract exact length from header
        if (i + 51 <= totalLength) {
          const view = new DataView(bytes.buffer, bytes.byteOffset + i, totalLength - i);
          const metadataLen = view.getUint16(45, false);
          if (i + 47 + metadataLen + 4 <= totalLength) {
            const cipherLen = view.getUint32(47 + metadataLen, false);
            const containerLen = 47 + metadataLen + 4 + cipherLen + 4;
            if (i + containerLen <= totalLength) {
              const clean = new Uint8Array(containerLen);
              clean.set(bytes.subarray(i, i + containerLen));
              return clean;
            }
          }
        }
      } else if (char4 === '1') {
        // v1 QBS1 Message: Extract exact length
        if (i + 38 <= totalLength) {
          const view = new DataView(bytes.buffer, bytes.byteOffset + i, totalLength - i);
          const cipherLen = view.getUint32(34, false);
          const containerLen = 34 + 4 + cipherLen + 4;
          if (i + containerLen <= totalLength) {
            const clean = new Uint8Array(containerLen);
            clean.set(bytes.subarray(i, i + containerLen));
            return clean;
          }
        }
      } else if (char4 === 'F') {
        // v1 QBSF File
        if (i + 44 <= totalLength) {
          const view = new DataView(bytes.buffer, bytes.byteOffset + i, totalLength - i);
          let off = 34;
          const fnLen = view.getUint16(off, false);
          off += 2 + fnLen;
          if (i + off + 2 <= totalLength) {
            const mimeLen = view.getUint16(off, false);
            off += 2 + mimeLen + 4; // skip mime + origSize (4)
            if (i + off + 4 <= totalLength) {
              const cipherLen = view.getUint32(off, false);
              const containerLen = off + 4 + cipherLen + 4;
              if (i + containerLen <= totalLength) {
                const clean = new Uint8Array(containerLen);
                clean.set(bytes.subarray(i, i + containerLen));
                return clean;
              }
            }
          }
        }
      }
    }
  }

  // 5. Standard RIFF WAVE parser (with ID3 tag skip support)
  let riffOffset = -1;
  // If file starts with ID3v2 tag: ID3 + 2 bytes ver + 1 byte flags + 4 bytes synchsafe size
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33 && totalLength >= 10) {
    const id3Size =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);
    const potentialRiff = 10 + id3Size;
    if (potentialRiff + 12 <= totalLength) {
      const tag = String.fromCharCode(...bytes.subarray(potentialRiff, potentialRiff + 4));
      if (tag === 'RIFF') {
        riffOffset = potentialRiff;
      }
    }
  }

  // If not found yet, check at offset 0 or scan first 64KB for 'RIFF' + 'WAVE'
  if (riffOffset === -1) {
    if (totalLength >= 12) {
      const rTag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
      const wTag = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
      if (rTag === 'RIFF' && wTag === 'WAVE') {
        riffOffset = 0;
      }
    }
  }

  if (riffOffset === -1) {
    const searchLimit = Math.min(65536, totalLength - 12);
    for (let i = 0; i < searchLimit; i++) {
      if (
        bytes[i] === 0x52 && // 'R'
        bytes[i + 1] === 0x49 && // 'I'
        bytes[i + 2] === 0x46 && // 'F'
        bytes[i + 3] === 0x46 && // 'F'
        bytes[i + 8] === 0x57 && // 'W'
        bytes[i + 9] === 0x41 && // 'A'
        bytes[i + 10] === 0x56 && // 'V'
        bytes[i + 11] === 0x45   // 'E'
      ) {
        riffOffset = i;
        break;
      }
    }
  }

  // If valid RIFF WAVE found, iterate chunks sequentially
  if (riffOffset !== -1) {
    const view = new DataView(arrayBuffer, riffOffset);
    let offset = 12;
    const maxOffset = totalLength - riffOffset;
    while (offset + 8 <= maxOffset) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      const chunkSize = view.getUint32(offset + 4, true);
      offset += 8;

      if (chunkId === 'qbsd') {
        if (offset + chunkSize > maxOffset) {
          throw new Error('The audio container is truncated or damaged.');
        }
        const clean = new Uint8Array(chunkSize);
        clean.set(new Uint8Array(arrayBuffer, riffOffset + offset, chunkSize));
        return clean;
      }

      const paddedSize = chunkSize + (chunkSize % 2);
      offset += paddedSize;
    }
  }

  // Detect common compressed formats to give specific user-friendly guidance
  const headerCheck = String.fromCharCode(...bytes.subarray(0, 4));
  const isOggOpus = headerCheck === 'OggS'; // WhatsApp voice notes convert to Opus Ogg
  const isMp4 = headerCheck === 'ftyp' || String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp';
  const isMp3 = (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) || headerCheck === 'ID3';

  if (isOggOpus || isMp4 || isMp3) {
    throw new Error(
      'This audio file was compressed or converted (e.g. by WhatsApp audio sharing), which removed the encrypted container. To transfer sound without compression: share as a "Document" on WhatsApp, or on Phone 1 tap "Copy QBSF Code" to paste the text code directly.'
    );
  }

  // General fallback
  throw new Error(
    'No valid QBS encrypted payload found in this audio file. Please ensure you are uploading the original .wav sound file (shared as Document) or paste the encrypted text code.'
  );
}
