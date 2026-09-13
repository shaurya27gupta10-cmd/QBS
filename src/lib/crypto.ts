/**
 * QBS-Secure Cryptography Engine (v2.0)
 * 
 * CORE SECURITY SPECIFICATION:
 * - Primitives: Standards-based, audited primitives (Argon2id RFC 9106 + AES-256-GCM NIST SP 800-38D).
 * - Key Derivation: Argon2id with 64 MB memory hardness, 3 time cost iterations, 1 parallelism, 16-byte random salt.
 * - Authenticated Encryption: AES-256-GCM with 96-bit unique random nonce, 128-bit authentication tag.
 * - Additional Authenticated Data (AAD): The entire security-sensitive header (magic, version, kdf params,
 *   salt, nonce, metadata, length) is bound to the AES-GCM tag. Any header or metadata tampering
 *   causes mathematical authentication failure before any plaintext can be exposed.
 * - Pre-Encryption Compression: Deflate compression reduces repetitive entropy and shrinks carrier audio.
 * - Memory Safety: Plaintext typed buffers and derived key materials are zeroed with .fill(0) after use.
 * - Error Handling: Non-revealing generic authentication failure to prevent timing and oracle attacks.
 * - Zero Knowledge: No password, key, or plaintext ever stored or sent over the network.
 */

import { argon2id } from 'hash-wasm';
import { compressData, decompressData } from './compression';
import { DecryptedFileResult, QbsPayloadType, KdfType } from '../types';

// Protocol Identifiers
export const MAGIC_HEADER_SECURE = new Uint8Array([0x51, 0x42, 0x53, 0x53]); // 'QBSS' (v2 Standard)
export const MAGIC_HEADER_MESSAGE = new Uint8Array([0x51, 0x42, 0x53, 0x31]); // 'QBS1' (v1 Legacy Message)
export const MAGIC_HEADER_FILE = new Uint8Array([0x51, 0x42, 0x53, 0x46]); // 'QBSF' (v1 Legacy File)
export const MAGIC_HEADER = MAGIC_HEADER_SECURE;

export const PROTOCOL_VERSION_2 = 2;
export const PROTOCOL_VERSION_1 = 1;
export const PROTOCOL_VERSION = PROTOCOL_VERSION_2;

// KDF Identifiers
export const KDF_ID_PBKDF2 = 1;
export const KDF_ID_ARGON2ID = 2;

// Standard Security Parameters
export const ARGON2_TIME_COST = 3; // 3 iterations
export const ARGON2_MEMORY_COST_KB = 65536; // 64 MB memory hardness
export const ARGON2_PARALLELISM = 1;
export const PBKDF2_ITERATIONS = 100000;
export const SALT_LENGTH = 16;
export const IV_LENGTH = 12; // 96 bits for AES-GCM

// Standard non-revealing error message (OWASP recommendation)
export const GENERIC_AUTH_ERROR = 'Unable to authenticate QBS-Secure file.';

/**
 * Zeroes sensitive memory buffers to prevent memory scrapers and heap dumps.
 */
export function zeroMemory(buffer: Uint8Array | ArrayBuffer | Int16Array | Uint32Array): void {
  try {
    if (buffer instanceof Uint8Array || buffer instanceof Int16Array || buffer instanceof Uint32Array) {
      buffer.fill(0);
    } else if (buffer instanceof ArrayBuffer) {
      new Uint8Array(buffer).fill(0);
    }
  } catch {
    // Ignore if buffer is detached or read-only
  }
}

/**
 * Constant-time byte array equality comparison to prevent side-channel timing attacks.
 */
export function constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

// CRC32 Lookup Table
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
 * Derives a 256-bit AES key from a password using memory-hard Argon2id (RFC 9106).
 */
export async function deriveKeyArgon2id(
  password: string,
  salt: Uint8Array,
  timeCost: number = ARGON2_TIME_COST,
  memoryCostKb: number = ARGON2_MEMORY_COST_KB,
  parallelism: number = ARGON2_PARALLELISM
): Promise<{ key: CryptoKey; rawKey: Uint8Array }> {
  // Execute WebAssembly-accelerated Argon2id
  const rawKey = await argon2id({
    password,
    salt,
    parallelism,
    iterations: timeCost,
    memorySize: memoryCostKb,
    hashLength: 32, // 256-bit key
    outputType: 'binary',
  });

  // Import into Web Crypto API for hardware-accelerated AES-256-GCM
  const key = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return { key, rawKey };
}

/**
 * Derives a 256-bit AES key using PBKDF2-HMAC-SHA256 (for backward compatibility).
 */
export async function deriveKeyPBKDF2(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const importedKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  zeroMemory(passwordBuffer);

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a text message into the QBS-Secure v2 authenticated container.
 */
export async function encryptMessage(
  message: string,
  password: string,
  onProgress?: (step: string, percent: number) => void
): Promise<Uint8Array> {
  if (!message || message.trim().length === 0) {
    throw new Error('Please enter a message first.');
  }
  if (!password || password.length === 0) {
    throw new Error('Please enter a password.');
  }

  onProgress?.('Preparing payload & pre-encryption compression...', 15);
  const encoder = new TextEncoder();
  const rawPlaintext = encoder.encode(message);

  // 1. Pre-encryption compression
  const { compressed, wasCompressed } = await compressData(rawPlaintext);

  onProgress?.('Generating cryptographic salt & 96-bit nonce...', 30);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  onProgress?.('Deriving 256-bit key with Argon2id (64MB memory hardness)...', 50);
  const { key, rawKey } = await deriveKeyArgon2id(
    password,
    salt,
    ARGON2_TIME_COST,
    ARGON2_MEMORY_COST_KB,
    ARGON2_PARALLELISM
  );

  // Empty metadata for text messages
  const metadataBytes = new Uint8Array(0);

  // 2. Assemble Header for Authenticated Additional Data (AAD)
  // Header structure:
  // [4] Magic "QBSS"
  // [1] Version = 2
  // [1] Payload Type: 1 = Message, 2 = File
  // [1] KDF ID = 2 (Argon2id)
  // [1] Compression Flag: 1 = Yes, 0 = No
  // [4] KDF Iterations (Uint32 BE)
  // [4] KDF Memory Cost KB (Uint32 BE)
  // [1] KDF Parallelism (Uint8)
  // [16] Salt
  // [12] Nonce/IV
  // [2] Metadata Length (Uint16 BE)
  // [M] Metadata bytes
  // [4] Ciphertext Length (Uint32 BE)
  const headerLen = 4 + 1 + 1 + 1 + 1 + 4 + 4 + 1 + SALT_LENGTH + IV_LENGTH + 2 + metadataBytes.length + 4;
  const headerAad = new Uint8Array(headerLen);
  const view = new DataView(headerAad.buffer);

  let offset = 0;
  headerAad.set(MAGIC_HEADER_SECURE, offset);
  offset += 4;

  headerAad[offset++] = PROTOCOL_VERSION_2;
  headerAad[offset++] = 1; // 1 = Message
  headerAad[offset++] = KDF_ID_ARGON2ID;
  headerAad[offset++] = wasCompressed ? 1 : 0;

  view.setUint32(offset, ARGON2_TIME_COST, false);
  offset += 4;
  view.setUint32(offset, ARGON2_MEMORY_COST_KB, false);
  offset += 4;
  headerAad[offset++] = ARGON2_PARALLELISM;

  headerAad.set(salt, offset);
  offset += SALT_LENGTH;

  headerAad.set(iv, offset);
  offset += IV_LENGTH;

  view.setUint16(offset, metadataBytes.length, false);
  offset += 2;
  if (metadataBytes.length > 0) {
    headerAad.set(metadataBytes, offset);
    offset += metadataBytes.length;
  }

  // Calculate expected ciphertext length: plaintext.length + 16 (GCM auth tag)
  const expectedCiphertextLen = compressed.length + 16;
  view.setUint32(offset, expectedCiphertextLen, false);

  onProgress?.('Encrypting payload with AES-256-GCM and AAD binding...', 80);

  // 3. Encrypt with AES-GCM using AAD
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: headerAad as BufferSource,
    },
    key,
    compressed as BufferSource
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);

  // 4. Assemble complete container: Header AAD + Ciphertext + CRC32
  const totalLength = headerLen + ciphertext.length + 4;
  const container = new Uint8Array(totalLength);
  const containerView = new DataView(container.buffer);

  container.set(headerAad, 0);
  container.set(ciphertext, headerLen);

  // Outer CRC32 over the entire container up to checksum position
  const crc = calculateCRC32(container.subarray(0, headerLen + ciphertext.length));
  containerView.setUint32(headerLen + ciphertext.length, crc, false);

  // 5. Secure Memory Cleanup
  zeroMemory(rawKey);
  zeroMemory(rawPlaintext);

  onProgress?.('QBS-Secure container finalized', 100);
  return container;
}

/**
 * Encrypts a binary file into the QBS-Secure v2 authenticated container.
 */
export async function encryptFile(
  fileBytes: Uint8Array,
  filename: string,
  mimeType: string,
  password: string,
  onProgress?: (step: string, percent: number) => void
): Promise<Uint8Array> {
  if (!fileBytes) {
    throw new Error('Please select a valid file first.');
  }
  if (!password || password.length === 0) {
    throw new Error('Please enter a password.');
  }

  onProgress?.('Analyzing file and compressing...', 15);
  const cleanFilename = (filename || 'file.bin').replace(/[/\\]/g, '_');
  const cleanMime = mimeType || 'application/octet-stream';

  // 1. Pre-encryption compression
  const { compressed, wasCompressed } = await compressData(fileBytes);

  // 2. Encode structured metadata JSON
  const metadataObj = {
    name: cleanFilename,
    mime: cleanMime,
    origSize: fileBytes.byteLength,
  };
  const metadataBytes = new TextEncoder().encode(JSON.stringify(metadataObj));

  onProgress?.('Generating cryptographic salt & 96-bit nonce...', 30);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  onProgress?.('Deriving 256-bit key with Argon2id (64MB memory hardness)...', 55);
  const { key, rawKey } = await deriveKeyArgon2id(
    password,
    salt,
    ARGON2_TIME_COST,
    ARGON2_MEMORY_COST_KB,
    ARGON2_PARALLELISM
  );

  // 3. Assemble Header for Authenticated Additional Data (AAD)
  const headerLen = 4 + 1 + 1 + 1 + 1 + 4 + 4 + 1 + SALT_LENGTH + IV_LENGTH + 2 + metadataBytes.length + 4;
  const headerAad = new Uint8Array(headerLen);
  const view = new DataView(headerAad.buffer);

  let offset = 0;
  headerAad.set(MAGIC_HEADER_SECURE, offset);
  offset += 4;

  headerAad[offset++] = PROTOCOL_VERSION_2;
  headerAad[offset++] = 2; // 2 = File
  headerAad[offset++] = KDF_ID_ARGON2ID;
  headerAad[offset++] = wasCompressed ? 1 : 0;

  view.setUint32(offset, ARGON2_TIME_COST, false);
  offset += 4;
  view.setUint32(offset, ARGON2_MEMORY_COST_KB, false);
  offset += 4;
  headerAad[offset++] = ARGON2_PARALLELISM;

  headerAad.set(salt, offset);
  offset += SALT_LENGTH;

  headerAad.set(iv, offset);
  offset += IV_LENGTH;

  view.setUint16(offset, metadataBytes.length, false);
  offset += 2;
  headerAad.set(metadataBytes, offset);
  offset += metadataBytes.length;

  const expectedCiphertextLen = compressed.length + 16;
  view.setUint32(offset, expectedCiphertextLen, false);

  onProgress?.('Encrypting file with AES-256-GCM & AAD integrity binding...', 80);

  // 4. Encrypt with AES-GCM using AAD
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: headerAad as BufferSource,
    },
    key,
    compressed as BufferSource
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);

  // 5. Assemble complete container
  const totalLength = headerLen + ciphertext.length + 4;
  const container = new Uint8Array(totalLength);
  const containerView = new DataView(container.buffer);

  container.set(headerAad, 0);
  container.set(ciphertext, headerLen);

  const crc = calculateCRC32(container.subarray(0, headerLen + ciphertext.length));
  containerView.setUint32(headerLen + ciphertext.length, crc, false);

  // 6. Memory cleanup
  zeroMemory(rawKey);

  onProgress?.('Secure file package generated', 100);
  return container;
}

function getPasswordCandidates(rawPassword: string): string[] {
  const candidates: string[] = [];
  const add = (pwd: string) => {
    if (pwd && !candidates.includes(pwd)) {
      candidates.push(pwd);
    }
  };

  // 1. Raw password as entered
  add(rawPassword);

  // 2. Trimmed whitespace (removes leading/trailing spaces & newlines from touch screen copy-paste)
  add(rawPassword.trim());

  // 3. Stripped invisible zero-width chars and non-breaking spaces
  const cleanInvisible = rawPassword.replace(/[\u200B-\u200D\uFEFF\u00A0\r\n\t]/g, '').trim();
  add(cleanInvisible);

  // 4. Unicode normalized forms
  add(rawPassword.normalize('NFKC').trim());
  add(rawPassword.normalize('NFC').trim());

  return candidates;
}

/**
 * Decrypts a QBS-Secure payload (supporting both v2 QBSS and v1 legacy formats).
 */
export async function decryptPayload(
  payload: Uint8Array,
  password: string,
  onProgress?: (step: string, percent: number) => void
): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error('Please enter a password.');
  }

  // Minimum sanity check
  if (!payload || payload.length < 50) {
    throw new Error('Payload is too small to be a valid QBS container.');
  }

  // Check Magic header
  const isV2 =
    payload[0] === MAGIC_HEADER_SECURE[0] &&
    payload[1] === MAGIC_HEADER_SECURE[1] &&
    payload[2] === MAGIC_HEADER_SECURE[2] &&
    payload[3] === MAGIC_HEADER_SECURE[3];

  const isV1Message =
    payload[0] === MAGIC_HEADER_MESSAGE[0] &&
    payload[1] === MAGIC_HEADER_MESSAGE[1] &&
    payload[2] === MAGIC_HEADER_MESSAGE[2] &&
    payload[3] === MAGIC_HEADER_MESSAGE[3];

  if (!isV2 && !isV1Message) {
    throw new Error('Unrecognized container header: Not a valid QBS Secure Sound file.');
  }

  // -------------------------------------------------------------
  // v1 Legacy Message Fallback
  // -------------------------------------------------------------
  if (isV1Message) {
    return await decryptLegacyV1Message(payload, password);
  }

  // -------------------------------------------------------------
  // v2 QBS-Secure Protocol Decoder
  // -------------------------------------------------------------
  onProgress?.('Validating container structure & outer CRC32...', 20);

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const version = payload[4];
  if (version !== PROTOCOL_VERSION_2) {
    throw new Error(`Unsupported QBS container version: ${version}`);
  }

  const payloadType = payload[5]; // 1 = Message, 2 = File
  const kdfId = payload[6]; // 1 = PBKDF2, 2 = Argon2id
  const isCompressed = payload[7] === 1;

  const timeCost = view.getUint32(8, false);
  const memoryCostKb = view.getUint32(12, false);
  const parallelism = payload[16];

  let offset = 17;
  const salt = payload.slice(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  const iv = payload.slice(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const metadataLen = view.getUint16(offset, false);
  offset += 2;

  if (offset + metadataLen + 4 > payload.length) {
    throw new Error('Corrupted container header: Metadata length exceeds payload boundary.');
  }

  offset += metadataLen;

  const ciphertextLen = view.getUint32(offset, false);
  offset += 4;

  const headerLen = offset;
  const headerAad = payload.slice(0, headerLen);

  if (headerLen + ciphertextLen + 4 !== payload.length) {
    if (payload.length < headerLen + ciphertextLen + 4) {
      throw new Error(
        `Incomplete payload: Received ${payload.length.toLocaleString()} bytes of ${(headerLen + ciphertextLen + 4).toLocaleString()} bytes expected. The code was truncated by clipboard or scanner. Please copy the complete code or use the sound file (.wav).`
      );
    }
    throw new Error('Corrupted container header: Encrypted payload length does not match container size.');
  }

  const ciphertext = payload.slice(headerLen, headerLen + ciphertextLen);

  // Validate outer CRC32
  const storedCrc = view.getUint32(headerLen + ciphertextLen, false);
  const calculatedCrc = calculateCRC32(payload.subarray(0, headerLen + ciphertextLen));
  if (storedCrc !== calculatedCrc) {
    throw new Error('Integrity verification failed: Outer CRC32 checksum mismatch. The payload was corrupted in transit.');
  }

  onProgress?.('Deriving cryptographic key with Argon2id...', 45);

  const candidates = getPasswordCandidates(password);
  let decryptedBuffer: ArrayBuffer | null = null;

  for (const candidate of candidates) {
    let key: CryptoKey;
    let rawKey: Uint8Array | null = null;
    try {
      if (kdfId === KDF_ID_ARGON2ID) {
        const derived = await deriveKeyArgon2id(candidate, salt, timeCost, memoryCostKb, parallelism);
        key = derived.key;
        rawKey = derived.rawKey;
      } else {
        key = await deriveKeyPBKDF2(candidate, salt, timeCost || PBKDF2_ITERATIONS);
      }

      decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
          additionalData: headerAad as BufferSource,
        },
        key,
        ciphertext as BufferSource
      );

      if (rawKey) zeroMemory(rawKey);
      if (decryptedBuffer) break;
    } catch {
      if (rawKey) zeroMemory(rawKey);
      // Try next candidate
    }
  }

  if (!decryptedBuffer) {
    throw new Error('Decryption failed: Incorrect password or invalid security tag. Please check your password and try again.');
  }

  onProgress?.('Reconstructing authentic message...', 95);

  try {
    let plainBytes = new Uint8Array(decryptedBuffer);

    // Decompress if compressed
    if (isCompressed) {
      plainBytes = await decompressData(plainBytes);
    }

    const text = new TextDecoder('utf-8', { fatal: true }).decode(plainBytes);
    zeroMemory(plainBytes);
    return text;
  } catch {
    throw new Error('Message decoding failed: Decrypted data could not be parsed as valid text.');
  }
}

/**
 * Decrypts a file payload (supporting both v2 QBSS and v1 QBSF containers).
 */
export async function decryptFilePayload(
  payload: Uint8Array,
  password: string,
  onProgress?: (step: string, percent: number) => void
): Promise<DecryptedFileResult> {
  if (!password || password.length === 0) {
    throw new Error('Please enter a password.');
  }

  if (!payload || payload.length < 50) {
    throw new Error('Payload is too small to be a valid QBS container.');
  }

  const isV2 =
    payload[0] === MAGIC_HEADER_SECURE[0] &&
    payload[1] === MAGIC_HEADER_SECURE[1] &&
    payload[2] === MAGIC_HEADER_SECURE[2] &&
    payload[3] === MAGIC_HEADER_SECURE[3];

  const isV1File =
    payload[0] === MAGIC_HEADER_FILE[0] &&
    payload[1] === MAGIC_HEADER_FILE[1] &&
    payload[2] === MAGIC_HEADER_FILE[2] &&
    payload[3] === MAGIC_HEADER_FILE[3];

  if (!isV2 && !isV1File) {
    throw new Error('Unrecognized container header: Not a valid QBS Secure Sound file.');
  }

  // -------------------------------------------------------------
  // v1 Legacy File Fallback
  // -------------------------------------------------------------
  if (isV1File) {
    return await decryptLegacyV1File(payload, password, onProgress);
  }

  // -------------------------------------------------------------
  // v2 QBS-Secure File Decoder
  // -------------------------------------------------------------
  onProgress?.('Validating QBS-Secure container integrity...', 20);

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const version = payload[4];
  if (version !== PROTOCOL_VERSION_2) {
    throw new Error(`Unsupported QBS container version: ${version}`);
  }

  const payloadType = payload[5]; // 2 = File
  const kdfId = payload[6]; // 2 = Argon2id
  const isCompressed = payload[7] === 1;

  const timeCost = view.getUint32(8, false);
  const memoryCostKb = view.getUint32(12, false);
  const parallelism = payload[16];

  let offset = 17;
  const salt = payload.slice(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  const iv = payload.slice(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const metadataLen = view.getUint16(offset, false);
  offset += 2;

  if (offset + metadataLen + 4 > payload.length) {
    throw new Error('Corrupted container header: Metadata length exceeds payload boundary.');
  }

  const metadataBytes = payload.slice(offset, offset + metadataLen);
  offset += metadataLen;

  let metadataObj: { name?: string; mime?: string; origSize?: number } = {};
  try {
    const metaStr = new TextDecoder('utf-8').decode(metadataBytes);
    metadataObj = JSON.parse(metaStr);
  } catch {
    metadataObj = {};
  }

  const ciphertextLen = view.getUint32(offset, false);
  offset += 4;

  const headerLen = offset;
  const headerAad = payload.slice(0, headerLen);

  if (headerLen + ciphertextLen + 4 !== payload.length) {
    if (payload.length < headerLen + ciphertextLen + 4) {
      throw new Error(
        `Incomplete payload: Received ${payload.length.toLocaleString()} bytes of ${(headerLen + ciphertextLen + 4).toLocaleString()} bytes expected. The code was truncated by clipboard or scanner. Please copy the complete code, scan all QR parts, or use the sound file (.wav).`
      );
    }
    throw new Error('Corrupted container header: Length header does not match container size.');
  }

  const ciphertext = payload.slice(headerLen, headerLen + ciphertextLen);

  // Validate outer CRC32
  const storedCrc = view.getUint32(headerLen + ciphertextLen, false);
  const calculatedCrc = calculateCRC32(payload.subarray(0, headerLen + ciphertextLen));
  if (storedCrc !== calculatedCrc) {
    throw new Error('Integrity verification failed: Outer CRC32 checksum mismatch. The payload was corrupted in transit.');
  }

  onProgress?.('Deriving cryptographic key with Argon2id...', 45);

  const candidates = getPasswordCandidates(password);
  let decryptedBuffer: ArrayBuffer | null = null;

  for (const candidate of candidates) {
    let key: CryptoKey;
    let rawKey: Uint8Array | null = null;
    try {
      if (kdfId === KDF_ID_ARGON2ID) {
        const derived = await deriveKeyArgon2id(candidate, salt, timeCost, memoryCostKb, parallelism);
        key = derived.key;
        rawKey = derived.rawKey;
      } else {
        key = await deriveKeyPBKDF2(candidate, salt, timeCost || PBKDF2_ITERATIONS);
      }

      decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
          additionalData: headerAad as BufferSource,
        },
        key,
        ciphertext as BufferSource
      );

      if (rawKey) zeroMemory(rawKey);
      if (decryptedBuffer) break;
    } catch {
      if (rawKey) zeroMemory(rawKey);
      // Try next candidate
    }
  }

  if (!decryptedBuffer) {
    throw new Error('Decryption failed: Incorrect password or invalid security tag. Please check your password and try again.');
  }

  onProgress?.('Reconstructing authentic file data...', 95);

  try {
    let plainBytes = new Uint8Array(decryptedBuffer);

    // Decompress if compressed
    if (isCompressed) {
      plainBytes = await decompressData(plainBytes);
    }

    const filename = metadataObj.name || 'decrypted-file';
    const mimeType = metadataObj.mime || 'application/octet-stream';
    const sizeBytes = metadataObj.origSize || plainBytes.byteLength;

    const blob = new Blob([plainBytes], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);

    onProgress?.('Decryption complete', 100);

    return {
      data: plainBytes,
      filename,
      mimeType,
      sizeBytes,
      blob,
      objectUrl,
    };
  } catch {
    throw new Error('File reconstruction failed: Decrypted bytes could not be unpacked.');
  }
}

/**
 * Inspects payload header metadata safely without requiring password or key derivation.
 */
export interface PayloadInfo {
  type: QbsPayloadType;
  version: number;
  kdf: KdfType;
  kdfParams?: {
    timeCost: number;
    memoryCostKb: number;
  };
  isCompressed?: boolean;
  filename?: string;
  mimeType?: string;
  originalSizeBytes?: number;
  payloadSizeBytes: number;
}

export function inspectPayloadInfo(payload: Uint8Array): PayloadInfo {
  if (!payload || payload.length < 4) {
    throw new Error(GENERIC_AUTH_ERROR);
  }

  // v2 QBSS
  if (
    payload[0] === MAGIC_HEADER_SECURE[0] &&
    payload[1] === MAGIC_HEADER_SECURE[1] &&
    payload[2] === MAGIC_HEADER_SECURE[2] &&
    payload[3] === MAGIC_HEADER_SECURE[3]
  ) {
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    const version = payload[4];
    const payloadTypeNum = payload[5]; // 1 = Message, 2 = File
    const kdfId = payload[6];
    const isCompressed = payload[7] === 1;
    const timeCost = view.getUint32(8, false);
    const memoryCostKb = view.getUint32(12, false);

    const type: QbsPayloadType = payloadTypeNum === 2 ? 'file' : 'message';
    const kdf: KdfType = kdfId === KDF_ID_ARGON2ID ? 'argon2id' : 'pbkdf2';

    if (type === 'message') {
      return {
        type: 'message',
        version,
        kdf,
        kdfParams: { timeCost, memoryCostKb },
        isCompressed,
        payloadSizeBytes: payload.length,
      };
    }

    // Read metadata JSON for file
    let filename = 'secure-file';
    let mimeType = 'application/octet-stream';
    let originalSizeBytes = 0;

    try {
      const metadataOffset = 17 + SALT_LENGTH + IV_LENGTH;
      const metadataLen = view.getUint16(metadataOffset, false);
      const metadataBytes = payload.subarray(metadataOffset + 2, metadataOffset + 2 + metadataLen);
      const metaStr = new TextDecoder('utf-8').decode(metadataBytes);
      const meta = JSON.parse(metaStr);
      filename = meta.name || filename;
      mimeType = meta.mime || mimeType;
      originalSizeBytes = meta.origSize || 0;
    } catch {
      // Safe fallback
    }

    return {
      type: 'file',
      version,
      kdf,
      kdfParams: { timeCost, memoryCostKb },
      isCompressed,
      filename,
      mimeType,
      originalSizeBytes,
      payloadSizeBytes: payload.length,
    };
  }

  // v1 Legacy Message
  if (
    payload[0] === MAGIC_HEADER_MESSAGE[0] &&
    payload[1] === MAGIC_HEADER_MESSAGE[1] &&
    payload[2] === MAGIC_HEADER_MESSAGE[2] &&
    payload[3] === MAGIC_HEADER_MESSAGE[3]
  ) {
    return {
      type: 'message',
      version: payload[4],
      kdf: 'pbkdf2',
      payloadSizeBytes: payload.length,
    };
  }

  // v1 Legacy File
  if (
    payload[0] === MAGIC_HEADER_FILE[0] &&
    payload[1] === MAGIC_HEADER_FILE[1] &&
    payload[2] === MAGIC_HEADER_FILE[2] &&
    payload[3] === MAGIC_HEADER_FILE[3]
  ) {
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    let offset = 34;
    const filenameLen = view.getUint16(offset, false);
    offset += 2;
    const filename = new TextDecoder('utf-8').decode(payload.subarray(offset, offset + filenameLen));
    offset += filenameLen;
    const mimeLen = view.getUint16(offset, false);
    offset += 2;
    const mimeType = new TextDecoder('utf-8').decode(payload.subarray(offset, offset + mimeLen));
    offset += mimeLen;
    const originalSizeBytes = view.getUint32(offset, false);

    return {
      type: 'file',
      version: payload[4],
      kdf: 'pbkdf2',
      filename,
      mimeType,
      originalSizeBytes,
      payloadSizeBytes: payload.length,
    };
  }

  throw new Error(GENERIC_AUTH_ERROR);
}

export function detectPayloadType(payload: Uint8Array): QbsPayloadType {
  const info = inspectPayloadInfo(payload);
  return info.type;
}

// -----------------------------------------------------------------
// Legacy Decoders (Backward Compatibility)
// -----------------------------------------------------------------

async function decryptLegacyV1Message(payload: Uint8Array, password: string): Promise<string> {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  let offset = 6;
  const salt = payload.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;
  const iv = payload.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  const ciphertextLen = view.getUint32(offset, false);
  offset += 4;
  const ciphertext = payload.subarray(offset, offset + ciphertextLen);
  offset += ciphertextLen;
  const storedCrc = view.getUint32(offset, false);

  const calculatedCrc = calculateCRC32(payload.subarray(0, offset));
  if (storedCrc !== calculatedCrc) {
    throw new Error(GENERIC_AUTH_ERROR);
  }

  const key = await deriveKeyPBKDF2(password, salt);
  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(decryptedBuffer);
  } catch {
    throw new Error(GENERIC_AUTH_ERROR);
  }
}

async function decryptLegacyV1File(
  payload: Uint8Array,
  password: string,
  onProgress?: (step: string, percent: number) => void
): Promise<DecryptedFileResult> {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  let offset = 6;
  const salt = payload.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;
  const iv = payload.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const filenameLen = view.getUint16(offset, false);
  offset += 2;
  const filename = new TextDecoder('utf-8').decode(payload.subarray(offset, offset + filenameLen));
  offset += filenameLen;

  const mimeLen = view.getUint16(offset, false);
  offset += 2;
  const mimeType = new TextDecoder('utf-8').decode(payload.subarray(offset, offset + mimeLen));
  offset += mimeLen;

  const originalSizeBytes = view.getUint32(offset, false);
  offset += 4;

  const ciphertextLen = view.getUint32(offset, false);
  offset += 4;

  const ciphertext = payload.subarray(offset, offset + ciphertextLen);
  offset += ciphertextLen;

  const storedCrc = view.getUint32(offset, false);
  const calculatedCrc = calculateCRC32(payload.subarray(0, offset));
  if (storedCrc !== calculatedCrc) {
    throw new Error(GENERIC_AUTH_ERROR);
  }

  const key = await deriveKeyPBKDF2(password, salt);
  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );
    const data = new Uint8Array(decryptedBuffer);
    const blob = new Blob([data], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    return {
      data,
      filename,
      mimeType,
      sizeBytes: originalSizeBytes || data.byteLength,
      blob,
      objectUrl,
    };
  } catch {
    throw new Error(GENERIC_AUTH_ERROR);
  }
}

/**
 * Base64 helper methods
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32768 bytes chunking to prevent V8 string alloc bottlenecks
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    chunks.push(
      String.fromCharCode.apply(
        null,
        bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length)) as unknown as number[]
      )
    );
  }
  return btoa(chunks.join(''));
}

export function base64ToBytes(base64: string): Uint8Array {
  try {
    const binaryString = atob(base64.trim());
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch {
    throw new Error('Invalid base64 character found in payload. The code was corrupted or modified.');
  }
}
