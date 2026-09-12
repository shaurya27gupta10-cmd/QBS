/**
 * QBS-Secure Pre-Encryption Compression
 * 
 * SECURITY RATIONALE:
 * Compressing plaintext data before encryption reduces patterns, mitigates known-plaintext
 * predictability, eliminates redundant entropy, and minimizes the generated audio carrier size.
 * Uses native Web Streams CompressionStream('deflate') with graceful fallback.
 */

export async function compressData(data: Uint8Array): Promise<{ compressed: Uint8Array; wasCompressed: boolean }> {
  // If data is very small (under 48 bytes), compression usually inflates size due to headers
  if (data.length < 48) {
    return { compressed: data, wasCompressed: false };
  }

  // Check if CompressionStream is available in this environment
  if (typeof CompressionStream === 'undefined') {
    return { compressed: data, wasCompressed: false };
  }

  try {
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    // Write data asynchronously
    writer.write(data);
    writer.close();

    const chunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    
    // Only use compression if it actually saved space
    if (totalLen >= data.length) {
      return { compressed: data, wasCompressed: false };
    }

    const compressed = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      compressed.set(c, offset);
      offset += c.length;
    }

    return { compressed, wasCompressed: true };
  } catch {
    // If compression fails, safely fallback to uncompressed plaintext
    return { compressed: data, wasCompressed: false };
  }
}

export async function decompressData(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream is not supported in this environment.');
  }

  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const decompressed = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    decompressed.set(c, offset);
    offset += c.length;
  }

  return decompressed;
}
