import type { Emulator } from './types.ts';

/**
 * GBA memory map constants.
 * EWRAM: 256KB at 0x02000000
 */
const EWRAM_BASE = 0x02000000;
const EWRAM_SIZE = 0x40000; // 256KB

/**
 * Offset of EWRAM within mGBA's decompressed save state data.
 * Empirically discovered: state layout is header+CPU+IO+video (~0x21000 bytes),
 * then EWRAM (0x40000), then IWRAM (0x8000). Total = 0x61000 = 397312 bytes.
 */
const EWRAM_STATE_OFFSET = 0x21000;

/**
 * Memory reader that reads GBA EWRAM from mGBA save state snapshots.
 *
 * On ARM (Apple Silicon), direct HEAPU8 reads are stale due to the weak
 * memory model with SharedArrayBuffer — the emulator's pthread writes
 * without Atomics, so the main thread sees cached values. Instead, we
 * trigger a save state (which serialises the emulator's full state from
 * its own thread), extract the EWRAM region, and cache it locally.
 *
 * Call refresh() before each batch of reads to get fresh data.
 */
export class MemoryReader {
  private emulator: Emulator;
  private ewramCache: Uint8Array | null = null;
  private initialized = false;

  constructor(emulator: Emulator) {
    this.emulator = emulator;
  }

  async init(): Promise<boolean> {
    if (this.initialized) return true;
    this.initialized = true;
    console.log('[Bot Memory] Initialized, will read EWRAM from save states');
    return true;
  }

  /**
   * Take a fresh save state and cache the EWRAM region.
   * Must be called before any read operations to get current data.
   */
  async refresh(): Promise<boolean> {
    const SLOT = 9;
    const ok = this.emulator.saveState(SLOT);
    if (!ok) return false;

    const paths = this.emulator.filePaths();
    const gameName = this.emulator.gameName;
    if (!gameName) return false;

    const baseName = gameName.replace(/.*\//, '').replace(/\.[^.]+$/, '');
    const stateFileName = `${paths.saveStatePath}/${baseName}.ss${SLOT}`;

    let fileData: Uint8Array;
    try {
      fileData = this.emulator.FS.readFile(stateFileName);
    } catch {
      return false;
    }

    // Clean up the save state file
    try { this.emulator.FS.unlink(stateFileName); } catch { /* ignore */ }

    const stateData = await this.extractStateFromPng(fileData);
    if (!stateData) return false;

    // Extract EWRAM from the known offset
    if (EWRAM_STATE_OFFSET + EWRAM_SIZE > stateData.length) {
      console.error(`[Bot Memory] State data too small: ${stateData.length} bytes, need ${EWRAM_STATE_OFFSET + EWRAM_SIZE}`);
      return false;
    }

    this.ewramCache = stateData.slice(EWRAM_STATE_OFFSET, EWRAM_STATE_OFFSET + EWRAM_SIZE);
    return true;
  }

  readU8(gbaAddr: number): number {
    const offset = this.resolveOffset(gbaAddr);
    if (offset === null || !this.ewramCache) return 0;
    return this.ewramCache[offset];
  }

  readU16(gbaAddr: number): number {
    const offset = this.resolveOffset(gbaAddr);
    if (offset === null || !this.ewramCache) return 0;
    return this.ewramCache[offset] | (this.ewramCache[offset + 1] << 8);
  }

  readU32(gbaAddr: number): number {
    const offset = this.resolveOffset(gbaAddr);
    if (offset === null || !this.ewramCache) return 0;
    return (this.ewramCache[offset] | (this.ewramCache[offset + 1] << 8) |
      (this.ewramCache[offset + 2] << 16) | (this.ewramCache[offset + 3] << 24)) >>> 0;
  }

  readBytes(gbaAddr: number, length: number): Uint8Array {
    const offset = this.resolveOffset(gbaAddr);
    if (offset === null || !this.ewramCache) return new Uint8Array(length);
    return this.ewramCache.slice(offset, offset + length);
  }

  private resolveOffset(gbaAddr: number): number | null {
    if (gbaAddr >= EWRAM_BASE && gbaAddr < EWRAM_BASE + EWRAM_SIZE) {
      return gbaAddr - EWRAM_BASE;
    }
    return null;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get hasCache(): boolean {
    return this.ewramCache !== null;
  }

  /**
   * Parse PNG chunks to find the `gbAs` chunk containing the main save state.
   * The chunk data is zlib-compressed; decompress it.
   */
  private async extractStateFromPng(pngData: Uint8Array): Promise<Uint8Array | null> {
    const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < PNG_MAGIC.length; i++) {
      if (pngData[i] !== PNG_MAGIC[i]) {
        return pngData;
      }
    }

    let offset = 8;
    while (offset < pngData.length - 8) {
      const chunkLen = (pngData[offset] << 24) | (pngData[offset + 1] << 16) |
        (pngData[offset + 2] << 8) | pngData[offset + 3];
      const chunkType = String.fromCharCode(
        pngData[offset + 4], pngData[offset + 5],
        pngData[offset + 6], pngData[offset + 7],
      );

      if (chunkType === 'gbAs') {
        const compressedData = pngData.slice(offset + 8, offset + 8 + chunkLen);
        return this.zlibDecompress(compressedData);
      }

      offset += 12 + chunkLen;
    }

    console.error('[Bot Memory] No gbAs chunk found in PNG');
    return null;
  }

  private async zlibDecompress(data: Uint8Array): Promise<Uint8Array> {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(data);
    writer.close();

    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLen);
    let pos = 0;
    for (const chunk of chunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }
    return result;
  }
}
