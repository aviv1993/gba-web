import { useEffect, useState } from 'react';
import type { mGBAEmulator } from '@thenick775/mgba-wasm';

export type { mGBAEmulator };

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
