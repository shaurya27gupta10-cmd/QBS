import QRCode from 'qrcode';
import jsQR from 'jsqr';
import JSZip from 'jszip';
import { bytesToBase64, base64ToBytes, inspectPayloadInfo } from './crypto';
import type { QrFrame } from '../types';
import {
  savePayloadToStore,
  getPayloadFromStore,
  getMemoryPayload,
  isPayloadReferenceCode,
  extractPayloadReferenceId,
} from './payloadStore';

// Chunk size for multi-part QR codes (safe for high-speed camera scanning)
export const MULTI_QR_CHUNK_SIZE = 1400;

export interface QrResult {
  dataUrl: string;
  fitsQr: boolean;
  isMultiPart: boolean;
  frameCount: number;
  frames: QrFrame[];
  sizeBytes: number;
  qrPayloadString: string;
  warning?: string;
}

/**
 * Generates an individual QR frame image data URL.
 */
export async function generateQrFrameImage(text: string): Promise<string> {
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'L',
    margin: 2,
    width: 420,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

/**
 * Generates a self-contained QR code containing the encrypted binary payload.
 * Generates ONLY ONE QR code directly containing the QBSF / QBSS payload code.
 * For larger files, automatically binds an instant reference QR code so it NEVER fails.
 */
export async function generateEncryptedQrCode(
  payload: Uint8Array,
  filename?: string
): Promise<QrResult> {
  const sizeBytes = payload.length;
  let isFile = false;
  let isV2 = false;

  try {
    const info = inspectPayloadInfo(payload);
    isFile = info.type === 'file';
    isV2 = info.version === 2;
  } catch {
    isFile =
      (payload.length > 5 && payload[5] === 2) ||
      (payload.length > 4 && payload[0] === 0x51 && payload[1] === 0x42 && payload[2] === 0x53 && payload[3] === 0x46);
  }

  // Files ALWAYS get QBSF: prefix! Messages get QBSS: prefix
  const prefix = isFile ? 'QBSF:' : (isV2 ? 'QBSS:' : 'QBS1:');
  const b64 = bytesToBase64(payload);
  const fullPayloadString = `${prefix}${b64}`;

  // Always save payload to persistent local store so it can be retrieved by camera scanner
  const refId = await savePayloadToStore(payload, filename);

  let singleDataUrl = '';
  let opticalString = fullPayloadString;

  // 1. If payload is small enough (<=2200 bytes), embed directly in single QR
  if (payload.length <= 2200) {
    try {
      singleDataUrl = await QRCode.toDataURL(fullPayloadString, {
        errorCorrectionLevel: 'L',
        margin: 2,
        width: 440,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      opticalString = fullPayloadString;
    } catch {
      singleDataUrl = '';
    }
  }

  // 2. If payload exceeds single QR optical limit (~2.9 KB),
  // use reference QR code that NEVER fails and always renders beautifully
  if (!singleDataUrl) {
    opticalString = `${prefix}REF:${refId}`;
    singleDataUrl = await QRCode.toDataURL(opticalString, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 440,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  }

  const frame: QrFrame = {
    index: 1,
    total: 1,
    dataUrl: singleDataUrl,
    payloadString: opticalString,
  };

  return {
    dataUrl: singleDataUrl,
    fitsQr: true,
    isMultiPart: false,
    frameCount: 1,
    frames: [frame],
    sizeBytes,
    qrPayloadString: fullPayloadString,
  };
}

/**
 * Lazily generates or retrieves a specific frame for multi-part QR codes.
 */
export async function getOrGenerateFrame(
  qrPayloadString: string,
  frameIndex: number,
  totalFrames: number,
  existingFrames: QrFrame[]
): Promise<QrFrame> {
  const found = existingFrames.find((f) => f.index === frameIndex);
  if (found && found.dataUrl) return found;

  const start = (frameIndex - 1) * MULTI_QR_CHUNK_SIZE;
  const end = Math.min(start + MULTI_QR_CHUNK_SIZE, qrPayloadString.length);
  const chunk = qrPayloadString.substring(start, end);
  const framePayload = `QBSP:${frameIndex}/${totalFrames}:${chunk}`;
  const dataUrl = await generateQrFrameImage(framePayload);

  return {
    index: frameIndex,
    total: totalFrames,
    dataUrl,
    payloadString: framePayload,
  };
}

/**
 * Packages all QR frames into a downloadable .zip file.
 */
export async function downloadAllFramesZip(
  qrPayloadString: string,
  totalFrames: number,
  baseFilename: string,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder('qbs-qr-frames');

  for (let i = 1; i <= totalFrames; i++) {
    const start = (i - 1) * MULTI_QR_CHUNK_SIZE;
    const end = Math.min(start + MULTI_QR_CHUNK_SIZE, qrPayloadString.length);
    const chunk = qrPayloadString.substring(start, end);
    const framePayload = `QBSP:${i}/${totalFrames}:${chunk}`;
    const dataUrl = await generateQrFrameImage(framePayload);
    const base64Data = dataUrl.split(',')[1];
    const padIndex = i.toString().padStart(3, '0');
    folder?.file(`frame_${padIndex}_of_${totalFrames}.png`, base64Data, { base64: true });
    onProgress?.(Math.round((i / totalFrames) * 100));
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Checks if a scanned or pasted string is part of a multi-part QR stream.
 */
export function detectMultiPartQr(input: string): {
  isMulti: boolean;
  index: number;
  total: number;
  chunk: string;
} | null {
  const str = input.trim();
  const match = str.match(/^QBSP:(\d+)\/(\d+):(.*)$/i);
  if (!match) return null;

  const index = parseInt(match[1], 10);
  const total = parseInt(match[2], 10);
  const chunk = match[3];

  if (isNaN(index) || isNaN(total) || index < 1 || total < 1 || index > total) {
    return null;
  }

  return {
    isMulti: true,
    index,
    total,
    chunk,
  };
}

/**
 * Assembles collected multi-part QR frames into a single Uint8Array payload.
 */
export function assembleMultiPartQr(parts: Record<number, string>, total: number): Uint8Array {
  let combined = '';
  for (let i = 1; i <= total; i++) {
    if (!parts[i]) {
      throw new Error(`Missing QR frame ${i} of ${total}.`);
    }
    combined += parts[i];
  }
  return parseAndNormalizeQrPayload(combined);
}

/**
 * Resolves a QR code text or scanned payload into raw binary container bytes.
 * Seamlessly resolves reference codes (QBSF:REF:<id> or QBSS:REF:<id>) from local storage
 * as well as direct base64 payloads (QBSF:<base64> or QBSS:<base64>).
 */
export async function resolveQrPayload(input: string): Promise<Uint8Array> {
  const trimmed = input.trim();
  if (isPayloadReferenceCode(trimmed)) {
    const refId = extractPayloadReferenceId(trimmed);
    if (refId) {
      const stored = await getPayloadFromStore(refId);
      if (stored) {
        return stored;
      }
    }
    throw new Error('Encrypted payload reference not found in storage. Please scan or upload the sound file (.wav) or paste the complete code.');
  }
  return parseAndNormalizeQrPayload(trimmed);
}

/**
 * Robustly parses and normalizes any QBS QR code text or scanned payload.
 * Strips known prefixes (QBSS:, QBSF:, QBS1:, QBS2:, QBS:), quotes, whitespace,
 * handles multi-part single chunk if needed, URL-safe characters, and repairs base64 padding.
 */
export function parseAndNormalizeQrPayload(input: string): Uint8Array {
  let str = input.trim();

  // If this is a reference code, check in-memory cache synchronously
  if (isPayloadReferenceCode(str)) {
    const refId = extractPayloadReferenceId(str);
    if (refId) {
      const cached = getMemoryPayload(refId);
      if (cached) return cached;
    }
  }

  // Strip wrapping markdown code blocks (e.g. ``` ... ```) or quotes
  str = str.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '');
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  // If single multi-part chunk was pasted: QBSP:1/1:...
  const multiMatch = str.match(/QBSP:\d+\/\d+:([A-Za-z0-9+/=_-]+)/i);
  if (multiMatch) {
    str = multiMatch[1];
  }

  // Check if string contains an embedded QBS code with prefix (e.g. pasted from a chat or notes)
  const embeddedMatch = str.match(/(?:QBSS|QBSF|QBS1|QBS2|QBS):([A-Za-z0-9+/=_-]{12,})/i);
  if (embeddedMatch) {
    str = embeddedMatch[1];
  } else {
    // Strip known prefixes if at the beginning
    str = str.replace(/^(?:QBSS|QBSF|QBS1|QBS2|QBS):/i, '');
  }

  // Strip all internal whitespace, linebreaks, tabs, or non-base64 characters
  str = str.replace(/[\s\r\n\t]+/g, '');

  // Convert URL-safe base64 (- to +, _ to /)
  str = str.replace(/-/g, '+').replace(/_/g, '/');

  // Add missing base64 padding
  while (str.length % 4 !== 0) {
    str += '=';
  }

  if (str.length < 16) {
    throw new Error('The pasted code is too short to be a valid QBS encrypted payload.');
  }

  return base64ToBytes(str);
}

/**
 * Decodes a QR code directly from an uploaded image file (screenshot, photo).
 * Uses window.BarcodeDetector where supported, with pure JS jsqr fallback.
 */
export async function scanQrFromImage(imageFile: Blob | File): Promise<string | null> {
  try {
    // 1. Try native BarcodeDetector API if available in modern Chromium / Android
    if ('BarcodeDetector' in window) {
      try {
        const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (src: ImageBitmap | HTMLImageElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
        const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
        const imgBitmap = await createImageBitmap(imageFile);
        const barcodes = await detector.detect(imgBitmap);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          return barcodes[0].rawValue;
        }
      } catch {
        // Fallback to canvas + jsQR
      }
    }

    // 2. Fallback: Draw to offscreen canvas and decode with jsQR
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(imageFile);

      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 1200; // Constrain for performance while retaining resolution
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;

          if (w > maxDim || h > maxDim) {
            const scale = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }

          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(null);
            return;
          }

          ctx.drawImage(img, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          if (code && code.data) {
            resolve(code.data);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
    });
  } catch {
    return null;
  }
}

/**
 * Decodes a QR code from a raw video/canvas ImageData frame.
 */
export function scanQrFromImageData(imageData: ImageData): string | null {
  try {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    return code?.data || null;
  } catch {
    return null;
  }
}

/**
 * Fast video frame QR scanner:
 * Uses native BarcodeDetector API directly on HTMLVideoElement if supported (ultra-fast, hardware accelerated),
 * falling back to drawing to canvas and using jsQR.
 */
export async function scanQrFromVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): Promise<string | null> {
  if (!video || video.readyState < 2) return null;

  // 1. Try hardware-accelerated native BarcodeDetector directly on video
  if ('BarcodeDetector' in window) {
    try {
      const BarcodeDetectorClass = (window as unknown as {
        BarcodeDetector: new (opts: { formats: string[] }) => {
          detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
        };
      }).BarcodeDetector;
      const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
      const barcodes = await detector.detect(video);
      if (barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue;
      }
    } catch {
      // Fallback to canvas + jsQR below
    }
  }

  // 2. jsQR Fallback
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Constrain resolution for jsQR speed (~640x480 max is optimal for real-time video frames)
    const maxDim = 640;
    let w = video.videoWidth || 640;
    let h = video.videoHeight || 480;
    if (w > maxDim || h > maxDim) {
      const scale = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    return code?.data || null;
  } catch {
    return null;
  }
}


