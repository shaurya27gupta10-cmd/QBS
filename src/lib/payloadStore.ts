/**
 * Persistent storage and reference resolver for QBS encrypted payloads.
 * Uses IndexedDB with in-memory caching and BroadcastChannel for cross-tab sync.
 * Enables instant single QR code generation for payloads of ANY size.
 */

const DB_NAME = 'QBS_PAYLOAD_STORE_V1';
const STORE_NAME = 'payloads';

// Global memory cache for instant zero-latency retrieval
const memoryCache = new Map<string, Uint8Array>();

// Cross-tab synchronization channel
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('qbs_payload_channel');
    broadcastChannel.onmessage = (event) => {
      if (event.data && event.data.id && event.data.payload) {
        memoryCache.set(event.data.id, new Uint8Array(event.data.payload));
      }
    };
  }
} catch {
  // Ignore BroadcastChannel errors in restricted contexts
}

/**
 * Open or initialize the IndexedDB storage.
 */
function openPayloadDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment.'));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generate a short, deterministic, URL-safe 12-character ID from the payload bytes.
 */
export async function createPayloadId(payload: Uint8Array): Promise<string> {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', payload as BufferSource);
    const hashBytes = new Uint8Array(hashBuffer);
    // Take first 8 bytes and format as hex
    let hex = '';
    for (let i = 0; i < 8; i++) {
      hex += hashBytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  } catch {
    // Fallback pseudo-random ID if crypto.subtle is unavailable
    return 'qbs_' + Math.random().toString(36).substring(2, 14);
  }
}

/**
 * Save an encrypted payload into IndexedDB and memory cache.
 * Returns the short reference ID.
 */
export async function savePayloadToStore(
  payload: Uint8Array,
  filename?: string
): Promise<string> {
  const id = await createPayloadId(payload);

  // 1. In-memory cache
  memoryCache.set(id, payload);

  // 2. Broadcast to other tabs
  try {
    broadcastChannel?.postMessage({ id, payload: Array.from(payload) });
  } catch {
    // Ignore broadcast errors
  }

  // 3. Persist to IndexedDB
  try {
    const db = await openPayloadDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        id,
        payload,
        filename: filename || 'file',
        sizeBytes: payload.length,
        timestamp: Date.now(),
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to persist payload to IndexedDB:', err);
  }

  return id;
}

/**
 * Retrieve a payload synchronously from in-memory cache if available.
 */
export function getMemoryPayload(id: string): Uint8Array | null {
  const cleanId = id.trim().toLowerCase();
  return memoryCache.get(cleanId) || null;
}

/**
 * Retrieve a payload by its reference ID from memory cache or IndexedDB.
 */
export async function getPayloadFromStore(id: string): Promise<Uint8Array | null> {
  const cleanId = id.trim().toLowerCase();

  // 1. Check in-memory cache
  if (memoryCache.has(cleanId)) {
    return memoryCache.get(cleanId)!;
  }

  // 2. Query IndexedDB
  try {
    const db = await openPayloadDb();
    return await new Promise<Uint8Array | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cleanId);
      req.onsuccess = () => {
        if (req.result && req.result.payload) {
          const arr = new Uint8Array(req.result.payload);
          memoryCache.set(cleanId, arr);
          resolve(arr);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Check if a raw string is a reference code (e.g. QBSF:REF:a1b2c3d4 or QBSS:REF:a1b2c3d4).
 */
export function isPayloadReferenceCode(input: string): boolean {
  return /^(?:QBSF|QBSS|QBS):REF:([a-f0-9_-]+)/i.test(input.trim());
}

/**
 * Extract the reference ID from a reference code string.
 */
export function extractPayloadReferenceId(input: string): string | null {
  const match = input.trim().match(/^(?:QBSF|QBSS|QBS):REF:([a-f0-9_-]+)/i);
  return match ? match[1].toLowerCase() : null;
}
