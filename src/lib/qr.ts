import QRCode from 'qrcode';
import { bytesToBase64, detectPayloadType } from './crypto';

// Maximum payload size for reliable mobile QR code scanning
export const MAX_QR_PAYLOAD_BYTES = 800;

export interface QrResult {
  dataUrl: string | null;
  fitsQr: boolean;
  warning?: string;
  sizeBytes: number;
}

/**
 * Generates a self-contained QR code containing the encrypted binary payload.
 * Never includes passwords or plaintext.
 */
export async function generateEncryptedQrCode(payload: Uint8Array): Promise<QrResult> {
  const sizeBytes = payload.length;
  let isFile = false;
  try {
    isFile = detectPayloadType(payload) === 'file';
  } catch {
    // ignore
  }

  // Check if payload exceeds reliable QR code density
  if (sizeBytes > MAX_QR_PAYLOAD_BYTES) {
    return {
      dataUrl: null,
      fitsQr: false,
      warning: isFile
        ? 'QR Code is not suitable for this file size. Use the QBS Secure Sound.'
        : 'Message is too large for a single QR code. Use the QBS Sound file.',
      sizeBytes,
    };
  }

  // Self-contained compact representation
  const b64 = bytesToBase64(payload);
  const prefix = isFile ? 'QBSF:' : 'QBS1:';
  const qrString = `${prefix}${b64}`;

  try {
    const dataUrl = await QRCode.toDataURL(qrString, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 380,
      color: {
        dark: '#0f172a', // Dark slate/navy for high contrast
        light: '#ffffff',
      },
    });

    return {
      dataUrl,
      fitsQr: true,
      sizeBytes,
    };
  } catch (err) {
    return {
      dataUrl: null,
      fitsQr: false,
      warning: isFile
        ? 'QR Code is not suitable for this file size. Use the QBS Secure Sound.'
        : 'Failed to generate QR code. Use the QBS Sound file.',
      sizeBytes,
    };
  }
}

