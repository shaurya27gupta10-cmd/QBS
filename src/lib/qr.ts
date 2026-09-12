import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { bytesToBase64, base64ToBytes, inspectPayloadInfo } from './crypto';

// Maximum payload size for reliable mobile QR code scanning (version 35-40 with Low/Medium EC)
export const MAX_QR_PAYLOAD_BYTES = 2100;

export interface QrResult {
  dataUrl: string | null;
  fitsQr: boolean;
  warning?: string;
  sizeBytes: number;
  qrPayloadString?: string;
}

/**
 * Generates a self-contained QR code containing the encrypted binary payload.
 * Never includes passwords or plaintext.
 */
export async function generateEncryptedQrCode(payload: Uint8Array): Promise<QrResult> {
  const sizeBytes = payload.length;
  let isFile = false;
  let isV2 = false;

  try {
    const info = inspectPayloadInfo(payload);
    isFile = info.type === 'file';
    isV2 = info.version === 2;
  } catch {
    // Fallback if inspect fails
    isFile = payload.length > 4 && payload[0] === 0x51 && payload[1] === 0x42 && payload[2] === 0x53 && payload[3] === 0x46;
  }

  // Determine prefix
  const prefix = isV2 ? 'QBSS:' : isFile ? 'QBSF:' : 'QBS1:';
  const b64 = bytesToBase64(payload);
  const qrString = `${prefix}${b64}`;

  // Check if payload exceeds reliable QR code density
  if (sizeBytes > MAX_QR_PAYLOAD_BYTES) {
    return {
      dataUrl: null,
      fitsQr: false,
      warning: isFile
        ? 'File payload is too large for a standard QR code (~2 KB max). Use QBS Secure Sound (.wav), portable .qbs file, or copy the encrypted code directly.'
        : 'Message payload is too large for a standard QR code (~2 KB max). Use the QBS Sound file (.wav) or copy the encrypted text code.',
      sizeBytes,
      qrPayloadString: qrString,
    };
  }

  // Attempt generation: Try 'M' (15% redundancy) for smaller payloads, 'L' (7% redundancy) for high density
  const ecLevel = sizeBytes > 1200 ? 'L' : 'M';

  try {
    const dataUrl = await QRCode.toDataURL(qrString, {
      errorCorrectionLevel: ecLevel,
      margin: 2,
      width: 420,
      color: {
        dark: '#0f172a', // High-contrast navy slate
        light: '#ffffff',
      },
    });

    return {
      dataUrl,
      fitsQr: true,
      sizeBytes,
      qrPayloadString: qrString,
    };
  } catch {
    // Fallback to error correction 'L' if 'M' was too dense
    if (ecLevel === 'M') {
      try {
        const fallbackUrl = await QRCode.toDataURL(qrString, {
          errorCorrectionLevel: 'L',
          margin: 2,
          width: 420,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
        return {
          dataUrl: fallbackUrl,
          fitsQr: true,
          sizeBytes,
          qrPayloadString: qrString,
        };
      } catch {
        // Continue to overflow return
      }
    }

    return {
      dataUrl: null,
      fitsQr: false,
      warning: isFile
        ? 'QR Code density limit reached for this file size. Use the QBS Secure Sound file (.wav) or portable encrypted container.'
        : 'Failed to generate QR code due to data density. Use the QBS Sound file (.wav).',
      sizeBytes,
      qrPayloadString: qrString,
    };
  }
}

/**
 * Robustly parses and normalizes any QBS QR code text or scanned payload.
 * Strips known prefixes (QBSS:, QBSF:, QBS1:, QBS2:, QBS:), quotes, whitespace,
 * handles URL-safe characters, and repairs base64 padding.
 */
export function parseAndNormalizeQrPayload(input: string): Uint8Array {
  let str = input.trim();

  // Strip wrapping quotes or brackets if pasted from JSON or logs
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  // Strip known prefixes (case-insensitive)
  str = str.replace(/^(QBSS|QBSF|QBS1|QBS2|QBS):/i, '');

  // Strip all internal whitespace, linebreaks, tabs
  str = str.replace(/[\s\r\n\t]+/g, '');

  // Convert URL-safe base64 (- to +, _ to /)
  str = str.replace(/-/g, '+').replace(/_/g, '/');

  // Add missing base64 padding
  while (str.length % 4 !== 0) {
    str += '=';
  }

  if (str.length < 16) {
    throw new Error('QR payload is too short to be a valid QBS encrypted container.');
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


