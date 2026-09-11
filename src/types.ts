export type ActiveTab = 'home' | 'encode' | 'decode' | 'how-it-works' | 'security';

export interface EncryptedPayload {
  version: number;
  algorithm: string; // e.g. 'AES-GCM-256'
  salt: Uint8Array; // 16 bytes
  iv: Uint8Array; // 12 bytes
  ciphertext: Uint8Array; // encrypted data + 16-byte auth tag
  timestamp: number;
}

export interface GeneratedSound {
  blob: Blob;
  url: string;
  filename: string;
  durationSeconds: number;
  payloadSizeBytes: number;
  audioBuffer: AudioBuffer;
  rawPayload: Uint8Array;
  timestamp: number;
}

export interface DecodeState {
  status: 'idle' | 'analyzing' | 'recovering' | 'decrypting' | 'success' | 'error';
  progressMessage?: string;
  error?: string;
  decryptedMessage?: string;
}

export interface QrCodeData {
  dataUrl: string;
  isSelfContained: boolean;
  fitsQr: boolean;
  payloadSize: number;
  warning?: string;
}
