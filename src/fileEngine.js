export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const CHUNK_SIZES = [64, 128, 256, 512, 1024];

export async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 requires localhost or HTTPS.');
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

export async function splitFile(file, chunkKiB = 256) {
  if (!file) throw new Error('Select a file first.');
  if (file.size === 0) throw new Error('Please select a non-empty file.');
  if (file.size > MAX_FILE_BYTES) throw new Error('Maximum supported file size is 20 MB.');
  if (!CHUNK_SIZES.includes(Number(chunkKiB))) throw new Error('Invalid chunk size.');
  const buffer = await file.arrayBuffer();
  const size = Number(chunkKiB) * 1024;
  const chunks = [];
  for (let start = 0, index = 0; start < buffer.byteLength; start += size, index++) {
    const bytes = buffer.slice(start, Math.min(start + size, buffer.byteLength));
    chunks.push({ id: index, bytes, size: bytes.byteLength, hash: await sha256(bytes) });
  }
  return {
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    chunkKiB: Number(chunkKiB),
    hash: await sha256(buffer),
    chunks
  };
}

export function distributeChunks(fileRecord, peerIds) {
  if (!fileRecord || peerIds.length === 0) throw new Error('Add at least one peer.');
  const distribution = Object.fromEntries(peerIds.map(id => [id, []]));
  fileRecord.chunks.forEach((chunk, index) => {
    const primary = peerIds[index % peerIds.length];
    distribution[primary].push(chunk.id);
    if (peerIds.length > 1) {
      const replica = peerIds[(index + 1) % peerIds.length];
      distribution[replica].push(chunk.id);
    }
  });
  return distribution;
}

export async function reconstructFile(fileRecord, chunkIds) {
  if (!fileRecord) throw new Error('No file has been prepared.');
  const ids = new Set(chunkIds);
  if (fileRecord.chunks.some(chunk => !ids.has(chunk.id))) throw new Error('Missing chunks. Cannot reconstruct.');
  const ordered = [...fileRecord.chunks].sort((a, b) => a.id - b.id);
  for (const chunk of ordered) {
    if (await sha256(chunk.bytes) !== chunk.hash) throw new Error(`Chunk ${chunk.id + 1} failed integrity verification.`);
  }
  const blob = new Blob(ordered.map(c => c.bytes), { type: fileRecord.type });
  const resultHash = await sha256(await blob.arrayBuffer());
  if (resultHash !== fileRecord.hash) throw new Error('Reconstructed file hash does not match the original.');
  return blob;
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
