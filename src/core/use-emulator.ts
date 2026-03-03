import { useEffect, useState } from 'react';
import type { mGBAEmulator } from '@thenick775/mgba-wasm';

export type { mGBAEmulator };

function deleteDB(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function useEmulator(canvas: HTMLCanvasElement | null) {
  const [emulator, setEmulator] = useState<mGBAEmulator | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvas) return;

    let cancelled = false;

    const initialize = async () => {
      try {
        const { default: mGBA } = await import('@thenick775/mgba-wasm');
        const Module = await mGBA({ canvas });

        if (cancelled) return;

        const version = Module.version.projectName + ' ' + Module.version.projectVersion;
        console.log('mGBA initialized:', version);

        // Wipe Emscripten IDBFS stores before FSInit so mGBA doesn't
        // restore stale saves from IndexedDB — cloud is the source of truth.
        await Promise.all([
          deleteDB('/data'),
          deleteDB('/autosave'),
        ]);

        await Module.FSInit();

        // Disable mGBA's built-in keyboard handling — we manage input ourselves
        Module.toggleInput(false);

        if (!cancelled) {
          setEmulator(Module);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to initialize mGBA:', err);
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [canvas]);

  return { emulator, error };
}
