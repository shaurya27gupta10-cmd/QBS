/**
 * QBS Secure Sound - Cryptography Module
 * Client-side authenticated encryption using Web Crypto API:
 * - PBKDF2 (100,000 iterations, SHA-256) for password-to-key derivation
 * - AES-GCM (256-bit key, 12-byte random IV)
 * - Cryptographically secure random 16-byte salt
 * - Binary serialization with magic bytes and CRC32 integrity check
 */

import { DecryptedFileResult, QbsPayloadType } from '../types';

// Magic identifier: 'QBS1' for messages, 'QBSF' for files
export const MAGIC_HEADER_MESSAGE = new Uint8Array([0x51, 0x42, 0x53, 0x31]); // 'QBS1'
export const MAGIC_HEADER_FILE = new Uint8Array([0x51, 0x42, 0x53, 0x46]); // 'QBSF'
export const MAGIC_HEADER = MAGIC_HEADER_MESSAGE; // Backward compatibility
export const PROTOCOL_VERSION = 1;
export const ALGORITHM_ID = 1; // 1 = AES-256-GCM with PBKDF2-SHA256
export const PBKDF2_ITERATIONS = 100000;
export const SALT_LENGTH = 16;
export const IV_LENGTH = 12;

// Standard CRC32 table
const crcTable: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function calculateCRC32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Derives an AES-GCM 256-bit CryptoKey from a password and salt using PBKDF2-SHA256
 */
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const importedKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext message into a compact binary payload
 */
export async function encryptMessage(message: string, password: string): Promise<Uint8Array> {
  if (!message || message.trim().length === 0) {
    throw new Error('Please enter a message first.');
  }
  if (!password || password.length === 0) {
    throw new Error('Please enter a password.');
  }

  // 1. Generate random salt & IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // 2. Derive 256-bit key from password
  const key = await deriveKeyFromPassword(password, salt);

  // 3. Encrypt with AES-GCM (128-bit tag attached automatically to end of ciphertext)
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(message);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    plaintextBytes
  );

  const ciphertextBytes = new Uint8Array(ciphertextBuffer);

  // 4. Pack into compact binary payload:
  // [4 bytes Magic "QBS1"]
  // [1 byte Version]
  // [1 byte Alg ID]
  // [16 bytes Salt]
  // [12 bytes IV]
  // [4 bytes Ciphertext Length (Uint32 Big-Endian)]
  // [N bytes Ciphertext]
  // [4 bytes CRC32 Checksum (Uint32 Big-Endian)]
  const totalLength = 4 + 1 + 1 + SALT_LENGTH + IV_LENGTH + 4 + ciphertextBytes.length + 4;
  const payload = new Uint8Array(totalLength);
  const view = new DataView(payload.buffer);

  let offset = 0;
  payload.set(MAGIC_HEADER, offset);
  offset += 4;

  payload[offset++] = PROTOCOL_VERSION;
  payload[offset++] = ALGORITHM_ID;

  payload.set(salt, offset);
  offset += SALT_LENGTH;

  payload.set(iv, offset);
  offset += IV_LENGTH;

  view.setUint32(offset, ciphertextBytes.length, false); // Big-Endian
  offset += 4;

  payload.set(ciphertextBytes, offset);
  offset += ciphertextBytes.length;

  // Compute CRC32 over the payload up to this point
  const dataForCrc = payload.subarray(0, offset);
  const crc = calculateCRC32(dataForCrc);
  view.setUint32(offset, crc, false); // Big-Endian

  return payload;
}

/**
 * Decrypts a binary payload given a password
 */
export async function decryptPayload(payload: Uint8Array, password: string): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error('Please enter a password.');
  }

  // Minimum size check: 4 + 1 + 1 + 16 + 12 + 4 + 16 (min GCM tag) + 4 = 58 bytes
  if (payload.length < 58) {
    throw new Error('This does not appear to be a valid QBS Secure Sound file.');
  }

  // Check Magic header
  if (
    payload[0] !== MAGIC_HEADER[0] ||
    payload[1] !== MAGIC_HEADER[1] ||
    payload[2] !== MAGIC_HEADER[2] ||
    payload[3] !== MAGIC_HEADER[3]
  ) {
    throw new Error('This does not appear to be a valid QBS Secure Sound file.');
  }

  const version = payload[4];
  if (version !== PROTOCOL_VERSION) {
    throw new Error(`Unsupported QBS version (v${version}). Please use a compatible version.`);
  }

  const algId = payload[5];
  if (algId !== ALGORITHM_ID) {
    throw new Error('Unsupported algorithm identifier.');
  }

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

  let offset = 6;
  const salt = payload.slice(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  const iv = payload.slice(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const ciphertextLen = view.getUint32(offset, false);
  offset += 4;

  if (offset + ciphertextLen + 4 !== payload.length) {
    throw new Error('The secure sound appears to be damaged or incomplete.');
  }

  const ciphertext = payload.slice(offset, offset + ciphertextLen);
  offset += ciphertextLen;

  const storedCrc = view.getUint32(offset, false);
  const dataForCrc = payload.subarray(0, offset);
  const calculatedCrc = calculateCRC32(dataForCrc);

  if (storedCrc !== calculatedCrc) {
    throw new Error('The secure sound appears to be damaged or incomplete.');
  }

  // Derive key and decrypt
  try {
    const key = await deriveKeyFromPassword(password, salt);
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      key,
      ciphertext as BufferSource
    );

    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(decryptedBuffer);
  } catch (err: unknown) {
    // If decryption fails in AES-GCM, it is either wrong password or authentication tag mismatch
    throw new Error('Incorrect password. The encrypted message could not be opened.');
  }
}

/**
 * Helper to convert Uint8Array to URL-safe / standard Base64 string
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper to convert Base64 string back to Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64.trim());
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Detects whether the binary payload contains a QBS Message ('QBS1') or a QBS File ('QBSF').
 */
export function detectPayloadType(payload: Uint8Array): QbsPayloadType {
  if (!payload || payload.length < 4) {
    throw new Error('This does not appear to be a valid QBS Secure Sound file.');
  }

  // 'QBS1' -> Message
  if (
    payload[0] === MAGIC_HEADER_MESSAGE[0] &&
    payload[1] === MAGIC_HEADER_MESSAGE[1] &&
    payload[2] === MAGIC_HEADER_MESSAGE[2] &&
    payload[3] === MAGIC_HEADER_MESSAGE[3]
  ) {
    return 'message';
  }

  // 'QBSF' -> File
  if (
    payload[0] === MAGIC_HEADER_FILE[0] &&
    payload[1] === MAGIC_HEADER_FILE[1] &&
    payload[2] === MAGIC_HEADER_FILE[2] &&
    payload[3] === MAGIC_HEADER_FILE[3]
  ) {
    return 'file';
  }

  throw new Error('This does not appear to be a valid QBS Secure Sound file.');
}

export interface PayloadInfo {
  type: QbsPayloadType;
  version: number;
  filename?: string;
  mimeType?: string;
  originalSizeBytes?: number;
  payloadSizeBytes: number;
}

/**
 * Inspects the payload header metadata without requiring password decryption.
 */
export function inspectPayloadInfo(payload: Uint8Array): PayloadInfo {
  const type = detectPayloadType(payload);
  const version = payload[4];

  if (type === 'message') {
    return {
      type: 'message',
      version,
      payloadSizeBytes: payload.length,
    };
  }

  // For 'file' type, read unencrypted metadata header:
  // Offset 0..3: QBSF
  // Offset 4: Version
  // Offset 5: AlgId
  // Offset 6..21: Salt (16 bytes)
  // Offset 22..33: IV (12 bytes)
  // Offset 34..35: Filename length (Uint16 BE)
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  let offset = 34;

  if (offset + 2 > payload.length) {
    throw new Error('File appears to be corrupted or incomplete.');
  }

  const filenameLen = view.getUint16(offset, false);
  offset += 2;

  if (offset + filenameLen + 2 > payload.length) {
    throw new Error('File appears to be corrupted or incomplete.');
  }

  const filenameBytes = payload.subarray(offset, offset + filenameLen);
  offset += filenameLen;
  const decoder = new TextDecoder('utf-8');
  const filename = decoder.decode(filenameBytes) || 'unnamed-file';

  const mimeLen = view.getUint16(offset, false);
  offset += 2;

  if (offset + mimeLen + 4 > payload.length) {
    throw new Error('File appears to be corrupted or incomplete.');
  }

  const mimeBytes = payload.subarray(offset, offset + mimeLen);
  offset += mimeLen;
  const mimeType = decoder.decode(mimeBytes) || 'application/octet-stream';

  const originalSizeBytes = view.getUint32(offset, false);

  return {
    type: 'file',
    version,
    filename,
    mimeType,
    originalSizeBytes,
    payloadSizeBytes: payload.length,
  };
}

/**
 * Encrypts a binary file into a QBSF container format:
 * [4 bytes Magic "QBSF"]
 * [1 byte Version = 1]
 * [1 byte Alg ID = 1 (AES-256-GCM)]
 * [16 bytes Salt]
 * [12 bytes IV]
 * [2 bytes Filename Length (Uint16 BE)]
 * [N bytes Filename (UTF-8)]
 * [2 bytes MIME Length (Uint16 BE)]
 * [M bytes MIME Type (UTF-8)]
 * [4 bytes Original Size (Uint32 BE)]
 * [4 bytes Ciphertext Length (Uint32 BE)]
 * [C bytes Ciphertext + GCM Tag]
 * [4 bytes CRC32 Checksum (Uint32 BE)]
 */
export async function encryptFile(
  fileBytes: Uint8Array,
  filename: string,
  mimeType: string,
  password: string,
  onProgress?: (step: string, percent: number) => void
): Promise<Uint8Array> {
  if (!fileBytes || fileBytes.byteLength === 0) {
    throw new Error('Please select a valid file first.');
  }
  if (!password || password.length === 0) {
    throw new Error('Please enter a password.');
  }

  onProgress?.('Preparing file for encryption...', 15);

  // Clean filename and fallback mime
  const cleanFilename = (filename || 'file.bin').replace(/[/\\]/g, '_');
  const cleanMime = mimeType || 'application/octet-stream';

  const textEncoder = new TextEncoder();
  const filenameBytes = textEncoder.encode(cleanFilename);
  const mimeBytes = textEncoder.encode(cleanMime);

  if (filenameBytes.length > 1024) {
    throw new Error('Filename is too long.');
  }
  if (mimeBytes.length > 512) {
    throw new Error('MIME type is too long.');
  }

  onProgress?.('Deriving cryptographic key...', 35);
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive AES-256-GCM key from password
  const key = await deriveKeyFromPassword(password, salt);

  onProgress?.('Encrypting file contents with AES-256-GCM...', 60);

  // Encrypt with AES-GCM (appends 16-byte authentication tag)
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    fileBytes as BufferSource
  );

  const ciphertextBytes = new Uint8Array(ciphertextBuffer);

  onProgress?.('Packing QBS container & calculating integrity...', 85);

  // Calculate container length
  // 4 (Magic) + 1 (Ver) + 1 (Alg) + 16 (Salt) + 12 (IV)
  // + 2 (NameLen) + N (Name) + 2 (MimeLen) + M (Mime)
  // + 4 (OriginalSize) + 4 (CiphertextLen) + C (Ciphertext) + 4 (CRC32)
  const headerLength = 4 + 1 + 1 + SALT_LENGTH + IV_LENGTH + 2 + filenameBytes.length + 2 + mimeBytes.length + 4 + 4;
  const totalLength = headerLength + ciphertextBytes.length + 4;

  const payload = new Uint8Array(totalLength);
  const view = new DataView(payload.buffer);

  let offset = 0;
  payload.set(MAGIC_HEADER_FILE, offset);
  offset += 4;

  payload[offset++] = PROTOCOL_VERSION;
  payload[offset++] = ALGORITHM_ID;

  payload.set(salt, offset);
  offset += SALT_LENGTH;

  payload.set(iv, offset);
  offset += IV_LENGTH;

  view.setUint16(offset, filenameBytes.length, false);
  offset += 2;
  payload.set(filenameBytes, offset);
  offset += filenameBytes.length;

  view.setUint16(offset, mimeBytes.length, false);
  offset += 2;
  payload.set(mimeBytes, offset);
  offset += mimeBytes.length;

  view.setUint32(offset, fileBytes.byteLength, false);
  offset += 4;

  view.setUint32(offset, ciphertextBytes.length, false);
  offset += 4;

  payload.set(ciphertextBytes, offset);
  offset += ciphertextBytes.length;

  // Compute CRC32
  const dataForCrc = payload.subarray(0, offset);
  const crc = calculateCRC32(dataForCrc);
  view.setUint32(offset, crc, false);

  onProgress?.('Secure file payload generated', 100);

  return payload;
}

/**
 * Decrypts a QBSF binary payload into the original file with authentic metadata.
 */
export async function decryptFilePayload(
  payload: Uint8Array,
  password: string,
  onProgress?: (step: string, percent: number) => void
): Promise<DecryptedFileResult> {
  if (!password || password.length === 0) {
    throw new Error('Please enter a password.');
  }

  // Minimum size check: Magic(4) + Ver(1) + Alg(1) + Salt(16) + IV(12) + NameLen(2) + MimeLen(2) + OrigSize(4) + CipherLen(4) + Tag(16) + CRC(4) = 66 bytes
  if (!payload || payload.length < 66) {
    throw new Error('This does not appear to be a valid QBS Secure Sound file.');
  }

  onProgress?.('Verifying container integrity...', 20);

  // Validate magic header
  if (
    payload[0] !== MAGIC_HEADER_FILE[0] ||
    payload[1] !== MAGIC_HEADER_FILE[1] ||
    payload[2] !== MAGIC_HEADER_FILE[2] ||
    payload[3] !== MAGIC_HEADER_FILE[3]
  ) {
    throw new Error('This does not appear to be a valid QBS Secure Sound file.');
  }

  const version = payload[4];
  if (version !== PROTOCOL_VERSION) {
    throw new Error(`Unsupported QBS version (v${version}). Please use a compatible version.`);
  }

  const algId = payload[5];
  if (algId !== ALGORITHM_ID) {
    throw new Error('Unsupported algorithm identifier.');
  }

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

  let offset = 6;
  const salt = payload.slice(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  const iv = payload.slice(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const filenameLen = view.getUint16(offset, false);
  offset += 2;
  if (offset + filenameLen > payload.length) {
    throw new Error('File appears to be corrupted or incomplete.');
  }
  const filenameBytes = payload.subarray(offset, offset + filenameLen);
  offset += filenameLen;
  const decoder = new TextDecoder('utf-8');
  const filename = decoder.decode(filenameBytes) || 'decrypted-file';

  const mimeLen = view.getUint16(offset, false);
  offset += 2;
  if (offset + mimeLen > payload.length) {
    throw new Error('File appears to be corrupted or incomplete.');
  }
  const mimeBytes = payload.subarray(offset, offset + mimeLen);
  offset += mimeLen;
  const mimeType = decoder.decode(mimeBytes) || 'application/octet-stream';

  const originalSizeBytes = view.getUint32(offset, false);
  offset += 4;

  const ciphertextLen = view.getUint32(offset, false);
  offset += 4;

  if (offset + ciphertextLen + 4 !== payload.length) {
    throw new Error('File appears to be corrupted or incomplete.');
  }

  const ciphertext = payload.slice(offset, offset + ciphertextLen);
  offset += ciphertextLen;

  // Validate CRC32
  const storedCrc = view.getUint32(offset, false);
  const dataForCrc = payload.subarray(0, offset);
  const calculatedCrc = calculateCRC32(dataForCrc);

  if (storedCrc !== calculatedCrc) {
    throw new Error('File appears to be corrupted or incomplete.');
  }

  onProgress?.('Deriving decryption key...', 50);

  // Derive AES key
  let key: CryptoKey;
  try {
    key = await deriveKeyFromPassword(password, salt);
  } catch (err) {
    throw new Error('Unable to decrypt. Check the password or QBS sound.');
  }

  onProgress?.('Decrypting file with AES-256-GCM...', 75);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      key,
      ciphertext as BufferSource
    );

    onProgress?.('Reconstructing original file...', 95);

    const data = new Uint8Array(decryptedBuffer);

    // Create safe Blob and Object URL
    const blob = new Blob([data], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);

    onProgress?.('Decryption complete', 100);

    return {
      data,
      filename,
      mimeType,
      sizeBytes: originalSizeBytes || data.byteLength,
      blob,
      objectUrl,
    };
  } catch (err: unknown) {
    // If decryption fails in AES-GCM (wrong password or altered ciphertext)
    throw new Error('Unable to decrypt. Check the password or QBS sound.');
  }
}

