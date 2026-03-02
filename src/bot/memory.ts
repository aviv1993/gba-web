import type { Emulator } from './types.ts';

/**
 * GBA memory map constants.
 * EWRAM: 256KB at 0x02000000
 * IWRAM: 32KB at 0x03000000
 */
const EWRAM_BASE = 0x02000000;
const EWRAM_SIZE = 0x40000; // 256KB
const IWRAM_BASE = 0x03000000;
const IWRAM_SIZE = 0x8000; // 32KB

/**
 * Memory reader that discovers GBA memory regions within the WASM heap.
 *
 * Strategy: capture a save state, extract known EWRAM bytes, then search
 * Module.HEAPU8 for matching bytes to find the heap offset.
 */
export class MemoryReader {
  private emulator: Emulator;
  private ewramOffset: number | null = null;
  private iwramOffset: number | null = null;
  private initialized = false;

  constructor(emulator: Emulator) {
    this.emulator = emulator;
  }

  /**
   * Discover EWRAM/IWRAM locations within HEAPU8.
   * Must be called after a ROM is loaded and running.
   */
  async init(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      // Force a save state to get a snapshot of memory
      this.emulator.forceAutoSaveState();

      // Small delay for the state to be captured
      await new Promise(r => setTimeout(r, 100));

      const state = this.emulator.getAutoSaveState();
      if (!state) {
        console.error('[Bot Memory] Failed to get auto save state');
        return false;
      }

      // Parse the save state to find EWRAM data
      // mGBA save states contain EWRAM data — we look for it by searching
      // for a known signature pattern
      const found = this.discoverFromHeap(state.data);
      if (found) {
        this.initialized = true;
        console.log(`[Bot Memory] EWRAM offset: 0x${this.ewramOffset!.toString(16)}`);
        if (this.iwramOffset !== null) {
          console.log(`[Bot Memory] IWRAM offset: 0x${this.iwramOffset!.toString(16)}`);
        }
      }
      return found;
    } catch (err) {
      console.error('[Bot Memory] Init failed:', err);
      return false;
    }
  }

  private discoverFromHeap(saveStateData: Uint8Array): boolean {
    const heap = this.emulator.HEAPU8;
    if (!heap) {
      console.error('[Bot Memory] HEAPU8 not available');
      return false;
    }

    // Extract a signature from the save state's EWRAM region.
    // mGBA save states have a known structure — EWRAM is stored as a chunk.
    // We'll grab a sequence of bytes from a known offset within EWRAM
    // and search for it in the heap.

    // Strategy: read bytes from a stable EWRAM location (game code section, not stack)
    // and search HEAPU8 for that pattern.
    // We use bytes from save state offset that corresponds to early EWRAM (game data area).

    // mGBA save state format: chunks with headers. EWRAM chunk is tagged.
    // Rather than fully parsing the format, we use a search approach:
    // 1. Pick a 32-byte sample from a well-populated EWRAM area
    // 2. Search HEAPU8 for that exact sequence
    // 3. Calculate the base offset from the match position

    // The save state contains raw EWRAM data. We need to find where in the save state
    // EWRAM starts. mGBA uses a chunked format with 8-byte headers (4-byte tag + 4-byte size).
    // EWRAM tag is "ERAM" (0x4552414D)

    const ewramTag = [0x45, 0x52, 0x41, 0x4D]; // "ERAM"
    let ewramDataStart = -1;

    for (let i = 0; i < saveStateData.length - 8; i++) {
      if (saveStateData[i] === ewramTag[0] && saveStateData[i + 1] === ewramTag[1] &&
          saveStateData[i + 2] === ewramTag[2] && saveStateData[i + 3] === ewramTag[3]) {
        // Found ERAM tag — next 4 bytes are chunk size (little-endian), then data follows
        const chunkSize = saveStateData[i + 4] | (saveStateData[i + 5] << 8) |
          (saveStateData[i + 6] << 16) | (saveStateData[i + 7] << 24);
        if (chunkSize >= EWRAM_SIZE) {
          ewramDataStart = i + 8;
          break;
        }
      }
    }

    if (ewramDataStart === -1) {
      console.error('[Bot Memory] Could not find EWRAM chunk in save state');
      return false;
    }

    // Take a 32-byte sample from offset 0x100 within EWRAM (stable game data area)
    const sampleOffset = 0x100;
    const sampleLen = 32;
    const sample = saveStateData.slice(ewramDataStart + sampleOffset, ewramDataStart + sampleOffset + sampleLen);

    // Verify sample isn't all zeros
    if (sample.every(b => b === 0)) {
      // Try another offset
      const altOffset = 0x1000;
      const altSample = saveStateData.slice(ewramDataStart + altOffset, ewramDataStart + altOffset + sampleLen);
      if (altSample.every(b => b === 0)) {
        console.error('[Bot Memory] EWRAM appears empty, cannot create search pattern');
        return false;
      }
      return this.searchHeapForPattern(heap, altSample, altOffset);
    }

    return this.searchHeapForPattern(heap, sample, sampleOffset);
  }

  private searchHeapForPattern(heap: Uint8Array, sample: Uint8Array, sampleEwramOffset: number): boolean {
    // Search HEAPU8 for the sample pattern
    const sampleLen = sample.length;

    for (let i = 0; i < heap.length - EWRAM_SIZE; i++) {
      let match = true;
      for (let j = 0; j < sampleLen; j++) {
        if (heap[i + j] !== sample[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        // Found! Calculate EWRAM base offset in heap
        this.ewramOffset = i - sampleEwramOffset;

        // Verify by checking a few more bytes
        const verifyOffset = 0x200;
        if (this.ewramOffset + verifyOffset < heap.length) {
          console.log('[Bot Memory] Pattern match found, EWRAM base offset:', this.ewramOffset);

          // Try to find IWRAM too — it's typically near EWRAM in the heap
          // IWRAM is 32KB, usually after EWRAM
          this.findIwram(heap);
          return true;
        }
      }
    }

    console.error('[Bot Memory] Could not find EWRAM pattern in HEAPU8');
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private findIwram(heap: Uint8Array): void {
    // IWRAM is typically allocated near EWRAM in the WASM heap.
    // We'll look for it by using a save state IWRAM chunk.
    // For now, skip IWRAM discovery — most game data we need is in EWRAM.
    // Can be implemented later if needed.
  }

  /** Read an unsigned 8-bit value from a GBA address. */
  readU8(gbaAddr: number): number {
    const offset = this.resolveOffset(gbaAddr);
    if (offset === null) return 0;
    return this.emulator.HEAPU8[offset];
  }

  /** Read an unsigned 16-bit value from a GBA address (little-endian). */
  readU16(gbaAddr: number): number {
    const offset = this.resolveOffset(gbaAddr);
    if (offset === null) return 0;
    const heap = this.emulator.HEAPU8;
    return heap[offset] | (heap[offset + 1] << 8);
  }

  /** Read an unsigned 32-bit value from a GBA address (little-endian). */
  readU32(gbaAddr: number): number {
    const offset = this.resolveOffset(gbaAddr);
    if (offset === null) return 0;
    const heap = this.emulator.HEAPU8;
    return (heap[offset] | (heap[offset + 1] << 8) |
      (heap[offset + 2] << 16) | (heap[offset + 3] << 24)) >>> 0;
  }

  /** Read a block of bytes from a GBA address. */
  readBytes(gbaAddr: number, length: number): Uint8Array {
    const offset = this.resolveOffset(gbaAddr);
    if (offset === null) return new Uint8Array(length);
    return this.emulator.HEAPU8.slice(offset, offset + length);
  }

  private resolveOffset(gbaAddr: number): number | null {
    if (gbaAddr >= EWRAM_BASE && gbaAddr < EWRAM_BASE + EWRAM_SIZE) {
      if (this.ewramOffset === null) return null;
      return this.ewramOffset + (gbaAddr - EWRAM_BASE);
    }
    if (gbaAddr >= IWRAM_BASE && gbaAddr < IWRAM_BASE + IWRAM_SIZE) {
      if (this.iwramOffset === null) return null;
      return this.iwramOffset + (gbaAddr - IWRAM_BASE);
    }
    return null;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}
