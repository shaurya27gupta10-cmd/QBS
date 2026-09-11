export type ActiveTab = 'home' | 'encode' | 'decode' | 'how-it-works' | 'security';

export type EncodeMode = 'message' | 'file';

export type QbsPayloadType = 'message' | 'file';

export type FileCategory = 'all' | 'image' | 'video' | 'audio' | 'document' | 'other';

export interface EncryptedPayload {
  version: number;
  algorithm: string; // e.g. 'AES-GCM-256'
  salt: Uint8Array; // 16 bytes
  iv: Uint8Array; // 12 bytes
  ciphertext: Uint8Array; // encrypted data + 16-byte auth tag
  timestamp: number;
}

export interface EncryptedFileContainer {
  version: number;
  algorithmId: number;
  filename: string;
  mimeType: string;
  originalSizeBytes: number;
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export interface DecryptedFileResult {
  data: Uint8Array;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  blob: Blob;
  objectUrl: string;
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
  payloadType: QbsPayloadType;
  fileMetadata?: {
    originalName: string;
    mimeType: string;
    originalSizeBytes: number;
  };
}

export interface DecodeState {
  status: 'idle' | 'analyzing' | 'recovering' | 'decrypting' | 'success' | 'error';
  progressMessage?: string;
  error?: string;
  payloadType?: QbsPayloadType;
  decryptedMessage?: string;
  decryptedFile?: DecryptedFileResult;
}

export interface QrCodeData {
  dataUrl: string;
  isSelfContained: boolean;
  fitsQr: boolean;
  payloadSize: number;
  warning?: string;
}

