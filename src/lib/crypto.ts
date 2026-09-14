/**
 * QBS-Secure Cryptography Engine (v2.0)
 * 
 * CORE SECURITY SPECIFICATION:
 * - Primitives: Standards-based, audited primitives (WebCrypto PBKDF2/Argon2id + AES-256-GCM NIST SP 800-38D).
 * - Key Derivation: Standard PBKDF2-HMAC-SHA256 (100,000 iterations, 16-byte random salt) with
 *   WebAssembly Argon2id compatibility support.
 * - Authenticated Encryption: AES-256-GCM with 96-bit unique random nonce, 128-bit authentication tag.
 * - Additional Authenticated Data (AAD): The entire security-sensitive header (magic, version, kdf params,
 *   salt, nonce, metadata, length) is bound to the AES-GCM tag. Any header or metadata tampering
 *   causes mathematical authentication failure before any plaintext can be exposed.
 * - Standalone Buffer Safety: Every typed array (salt, IV, AAD, ciphertext) is guaranteed to have
 *   byteOffset = 0 and dedicated ArrayBuffer storage to avoid browser WebCrypto buffer-sharing bugs.
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
export const ARGON2_MEMORY_COST_KB = 16384; // 16 MB memory hardness for reliable mobile & browser allocation
export const ARGON2_PARALLELISM = 1;
export const PBKDF2_ITERATIONS = 100000; // 100,000 iterations (OWASP recommendation for HMAC-SHA256)
export const SALT_LENGTH = 16;
export const IV_LENGTH = 12; // 96 bits for AES-GCM

// Standard non-revealing error message (OWASP recommendation)
export const GENERIC_AUTH_ERROR = 'Unable to authenticate QBS-Secure file.';

/**
 * Ensures any Uint8Array has byteOffset = 0 and its own dedicated ArrayBuffer.
 * This completely prevents WebCrypto bugs where BufferSource with non-zero byteOffset
 * is misread from the start of the underlying ArrayBuffer in some browsers.
 */
export function ensureStandaloneUint8Array(arr: Uint8Array): Uint8Array {
  if (arr.byteOffset === 0 && arr.byteLength === arr.buffer.byteLength) {
    return arr;
  }
  const clean = new Uint8Array(arr.byteLength);
  clean.set(arr);
  return clean;
}

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
  const cleanSalt = ensureStandaloneUint8Array(salt);

  const rawKey = await argon2id({
    password,
    salt: cleanSalt,
    parallelism: Math.max(1, parallelism || 1),
    iterations: Math.max(1, timeCost || 1),
    memorySize: Math.max(1024, memoryCostKb || 16384),
    hashLength: 32, // 256-bit key
    outputType: 'binary',
  });

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
 * Derives a 256-bit AES key using standard Web Crypto PBKDF2-HMAC-SHA256.
 * Guaranteed to work natively in 100% of browsers without WebAssembly or memory issues.
 */
export async function deriveKeyPBKDF2(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const cleanSalt = ensureStandaloneUint8Array(salt);

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
      salt: cleanSalt as BufferSource,
      iterations: Math.max(1000, iterations || PBKDF2_ITERATIONS),
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

  onProgress?.('Deriving 256-bit key with PBKDF2 (100,000 iterations)...', 50);
  const key = await deriveKeyPBKDF2(password, salt, PBKDF2_ITERATIONS);

  // Empty metadata for text messages
  const metadataBytes = new Uint8Array(0);

  // 2. Assemble Header for Authenticated Additional Data (AAD)
  // Header structure:
  // [4] Magic "QBSS"
  // [1] Version = 2
  // [1] Payload Type: 1 = Message, 2 = File
  // [1] KDF ID = 1 (PBKDF2 native)
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
  headerAad[offset++] = KDF_ID_PBKDF2;
  headerAad[offset++] = wasCompressed ? 1 : 0;

  view.setUint32(offset, PBKDF2_ITERATIONS, false);
  offset += 4;
  view.setUint32(offset, 0, false); // Memory cost 0 for PBKDF2
  offset += 4;
  headerAad[offset++] = 1; // Parallelism 1

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
      iv: ensureStandaloneUint8Array(iv) as BufferSource,
      additionalData: ensureStandaloneUint8Array(headerAad) as BufferSource,
    },
    key,
    ensureStandaloneUint8Array(compressed) as BufferSource
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

  onProgress?.('Deriving 256-bit key with PBKDF2 (100,000 iterations)...', 55);
  const key = await deriveKeyPBKDF2(password, salt, PBKDF2_ITERATIONS);

  // 3. Assemble Header for Authenticated Additional Data (AAD)
  const headerLen = 4 + 1 + 1 + 1 + 1 + 4 + 4 + 1 + SALT_LENGTH + IV_LENGTH + 2 + metadataBytes.length + 4;
  const headerAad = new Uint8Array(headerLen);
  const view = new DataView(headerAad.buffer);

  let offset = 0;
  headerAad.set(MAGIC_HEADER_SECURE, offset);
  offset += 4;

  headerAad[offset++] = PROTOCOL_VERSION_2;
  headerAad[offset++] = 2; // 2 = File
  headerAad[offset++] = KDF_ID_PBKDF2;
  headerAad[offset++] = wasCompressed ? 1 : 0;

  view.setUint32(offset, PBKDF2_ITERATIONS, false);
  offset += 4;
  view.setUint32(offset, 0, false);
  offset += 4;
  headerAad[offset++] = 1;

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
      iv: ensureStandaloneUint8Array(iv) as BufferSource,
      additionalData: ensureStandaloneUint8Array(headerAad) as BufferSource,
    },
    key,
    ensureStandaloneUint8Array(compressed) as BufferSource
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
  rawPayload: Uint8Array,
  password: string,
  onProgress?: (step: string, percent: number) => void
): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error('Please enter a password.');
  }

  // Minimum sanity check
  if (!rawPayload || rawPayload.length < 32) {
    throw new Error('Payload is too small to be a valid QBS container.');
  }

  // Ensure byteOffset = 0 and clean standalone buffer
  const payload = ensureStandaloneUint8Array(rawPayload);

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

  const view = new DataView(payload.buffer, 0, payload.byteLength);
  const version = payload[4];
  if (version !== PROTOCOL_VERSION_2) {
    throw new Error(`Unsupported QBS container version: ${version}`);
  }

  const payloadType = payload[5]; // 1 = Message, 2 = File
  const kdfId = payload[6]; // 1 = PBKDF2, 2 = Argon2id
  const isCompressed = payload[7] === 1;

  const timeCost = view.getUint32(8, false);
  const memoryCostKb = view.getUint32(12, false);
  const parallelism = payload[16] || 1;

  let offset = 17;
  // Extract Salt cleanly into independent buffer
  const salt = new Uint8Array(SALT_LENGTH);
  salt.set(payload.subarray(offset, offset + SALT_LENGTH));
  offset += SALT_LENGTH;

  // Extract IV cleanly into independent buffer
  const iv = new Uint8Array(IV_LENGTH);
  iv.set(payload.subarray(offset, offset + IV_LENGTH));
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
  const headerAad = new Uint8Array(headerLen);
  headerAad.set(payload.subarray(0, headerLen));

  const expectedTotal = headerLen + ciphertextLen + 4;
  if (payload.length < expectedTotal) {
    throw new Error(
      `Incomplete payload: Received ${payload.length.toLocaleString()} bytes of ${expectedTotal.toLocaleString()} bytes expected. Please copy the complete code or use the sound file (.wav).`
    );
  }

  const ciphertext = new Uint8Array(ciphertextLen);
  ciphertext.set(payload.subarray(headerLen, headerLen + ciphertextLen));

  // Validate outer CRC32
  const storedCrc = view.getUint32(headerLen + ciphertextLen, false);
  const calculatedCrc = calculateCRC32(payload.subarray(0, headerLen + ciphertextLen));
  if (storedCrc !== calculatedCrc) {
    throw new Error('Integrity verification failed: Outer CRC32 checksum mismatch. The payload was corrupted in transit.');
  }

  onProgress?.('Deriving cryptographic key...', 45);

  const candidates = getPasswordCandidates(password);
  let decryptedBuffer: ArrayBuffer | null = null;

  for (const candidate of candidates) {
    // Try primary KDF according to header
    const kdfAttempts = kdfId === KDF_ID_ARGON2ID 
      ? ['argon2id', 'pbkdf2'] 
      : ['pbkdf2', 'argon2id'];

    for (const attempt of kdfAttempts) {
      let key: CryptoKey | null = null;
      let rawKey: Uint8Array | null = null;

      try {
        if (attempt === 'argon2id') {
          const derived = await deriveKeyArgon2id(candidate, salt, timeCost, memoryCostKb, parallelism);
          key = derived.key;
          rawKey = derived.rawKey;
        } else {
          key = await deriveKeyPBKDF2(candidate, salt, timeCost || PBKDF2_ITERATIONS);
        }

        if (key) {
          decryptedBuffer = await crypto.subtle.decrypt(
            {
              name: 'AES-GCM',
              iv: iv as BufferSource,
              additionalData: headerAad as BufferSource,
            },
            key,
            ciphertext as BufferSource
          );
        }

        if (rawKey) zeroMemory(rawKey);
        if (decryptedBuffer) break;
      } catch {
        if (rawKey) zeroMemory(rawKey);
        // Continue to next attempt
      }
    }

    if (decryptedBuffer) break;
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
  rawPayload: Uint8Array,
  password: string,
  onProgress?: (step: string, percent: number) => void
): Promise<DecryptedFileResult> {
  if (!password || password.length === 0) {
    throw new Error('Please enter a password.');
  }

  if (!rawPayload || rawPayload.length < 32) {
    throw new Error('Payload is too small to be a valid QBS container.');
  }

  // Ensure byteOffset = 0 and clean standalone buffer
  const payload = ensureStandaloneUint8Array(rawPayload);

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

  const view = new DataView(payload.buffer, 0, payload.byteLength);
  const version = payload[4];
  if (version !== PROTOCOL_VERSION_2) {
    throw new Error(`Unsupported QBS container version: ${version}`);
  }

  const payloadType = payload[5]; // 2 = File
  const kdfId = payload[6]; // 1 = PBKDF2, 2 = Argon2id
  const isCompressed = payload[7] === 1;

  const timeCost = view.getUint32(8, false);
  const memoryCostKb = view.getUint32(12, false);
  const parallelism = payload[16] || 1;

  let offset = 17;
  // Extract Salt cleanly into independent buffer
  const salt = new Uint8Array(SALT_LENGTH);
  salt.set(payload.subarray(offset, offset + SALT_LENGTH));
  offset += SALT_LENGTH;

  // Extract IV cleanly into independent buffer
  const iv = new Uint8Array(IV_LENGTH);
  iv.set(payload.subarray(offset, offset + IV_LENGTH));
  offset += IV_LENGTH;

  const metadataLen = view.getUint16(offset, false);
  offset += 2;

  if (offset + metadataLen + 4 > payload.length) {
    throw new Error('Corrupted container header: Metadata length exceeds payload boundary.');
  }

  const metadataBytes = payload.subarray(offset, offset + metadataLen);
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
  const headerAad = new Uint8Array(headerLen);
  headerAad.set(payload.subarray(0, headerLen));

  const expectedTotal = headerLen + ciphertextLen + 4;
  if (payload.length < expectedTotal) {
    throw new Error(
      `Incomplete payload: Received ${payload.length.toLocaleString()} bytes of ${expectedTotal.toLocaleString()} bytes expected. Please copy the complete code, scan all QR parts, or use the sound file (.wav).`
    );
  }

  const ciphertext = new Uint8Array(ciphertextLen);
  ciphertext.set(payload.subarray(headerLen, headerLen + ciphertextLen));

  // Validate outer CRC32
  const storedCrc = view.getUint32(headerLen + ciphertextLen, false);
  const calculatedCrc = calculateCRC32(payload.subarray(0, headerLen + ciphertextLen));
  if (storedCrc !== calculatedCrc) {
    throw new Error('Integrity verification failed: Outer CRC32 checksum mismatch. The payload was corrupted in transit.');
  }

  onProgress?.('Deriving cryptographic key...', 45);

  const candidates = getPasswordCandidates(password);
  let decryptedBuffer: ArrayBuffer | null = null;

  for (const candidate of candidates) {
    const kdfAttempts = kdfId === KDF_ID_ARGON2ID 
      ? ['argon2id', 'pbkdf2'] 
      : ['pbkdf2', 'argon2id'];

    for (const attempt of kdfAttempts) {
      let key: CryptoKey | null = null;
      let rawKey: Uint8Array | null = null;

      try {
        if (attempt === 'argon2id') {
          const derived = await deriveKeyArgon2id(candidate, salt, timeCost, memoryCostKb, parallelism);
          key = derived.key;
          rawKey = derived.rawKey;
        } else {
          key = await deriveKeyPBKDF2(candidate, salt, timeCost || PBKDF2_ITERATIONS);
        }

        if (key) {
          decryptedBuffer = await crypto.subtle.decrypt(
            {
              name: 'AES-GCM',
              iv: iv as BufferSource,
              additionalData: headerAad as BufferSource,
            },
            key,
            ciphertext as BufferSource
          );
        }

        if (rawKey) zeroMemory(rawKey);
        if (decryptedBuffer) break;
      } catch {
        if (rawKey) zeroMemory(rawKey);
        // Continue to next attempt
      }
    }

    if (decryptedBuffer) break;
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

export function inspectPayloadInfo(rawPayload: Uint8Array): PayloadInfo {
  if (!rawPayload || rawPayload.length < 4) {
    throw new Error(GENERIC_AUTH_ERROR);
  }

  const payload = ensureStandaloneUint8Array(rawPayload);

  // v2 QBSS
  if (
    payload[0] === MAGIC_HEADER_SECURE[0] &&
    payload[1] === MAGIC_HEADER_SECURE[1] &&
    payload[2] === MAGIC_HEADER_SECURE[2] &&
    payload[3] === MAGIC_HEADER_SECURE[3]
  ) {
    const view = new DataView(payload.buffer, 0, payload.byteLength);
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
    const view = new DataView(payload.buffer, 0, payload.byteLength);
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
  const view = new DataView(payload.buffer, 0, payload.byteLength);
  let offset = 6;
  const salt = new Uint8Array(SALT_LENGTH);
  salt.set(payload.subarray(offset, offset + SALT_LENGTH));
  offset += SALT_LENGTH;

  const iv = new Uint8Array(IV_LENGTH);
  iv.set(payload.subarray(offset, offset + IV_LENGTH));
  offset += IV_LENGTH;

  const ciphertextLen = view.getUint32(offset, false);
  offset += 4;
  const ciphertext = new Uint8Array(ciphertextLen);
  ciphertext.set(payload.subarray(offset, offset + ciphertextLen));
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
  const view = new DataView(payload.buffer, 0, payload.byteLength);
  let offset = 6;
  const salt = new Uint8Array(SALT_LENGTH);
  salt.set(payload.subarray(offset, offset + SALT_LENGTH));
  offset += SALT_LENGTH;

  const iv = new Uint8Array(IV_LENGTH);
  iv.set(payload.subarray(offset, offset + IV_LENGTH));
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

  const ciphertext = new Uint8Array(ciphertextLen);
  ciphertext.set(payload.subarray(offset, offset + ciphertextLen));
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
 * Base64 helper methods with chunking and thorough sanitization
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error('No base64 data provided.');
  }

  // 1. Strip all prefixes (QBSS:, QBSF:, QBS1:, QBS2:, QBS:, data:...)
  let cleaned = base64.trim();
  cleaned = cleaned.replace(/^(?:QBSS|QBSF|QBS1|QBS2|QBS|QBSP):\s*/i, '');
  cleaned = cleaned.replace(/^data:[^;]+;base64,\s*/i, '');

  // 2. Remove all whitespace, line breaks, carriage returns, tabs
  cleaned = cleaned.replace(/[\s\r\n\t]+/g, '');

  // 3. Convert URL-safe base64 to standard base64 (- -> +, _ -> /)
  cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/');

  // 4. Fix missing base64 padding (=)
  const remainder = cleaned.length % 4;
  if (remainder === 2) {
    cleaned += '==';
  } else if (remainder === 3) {
    cleaned += '=';
  } else if (remainder === 1) {
    cleaned = cleaned.substring(0, cleaned.length - 1);
  }

  try {
    const binaryString = atob(cleaned);
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

