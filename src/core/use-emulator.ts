import { useEffect, useState } from 'react';
import type { mGBAEmulator } from '@thenick775/mgba-wasm';

export type { mGBAEmulator };

export function useEmulator(canvas: HTMLCanvasElement | null) {
  const [emulator, setEmulator] = useState<mGBAEmulator | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvas) return;

    let cancelled = false;
    let cleanupFns: (() => void)[] = [];

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
          // Periodically sync SRAM to IndexedDB so in-game saves persist across page loads
          const syncInterval = setInterval(() => Module.FSSync(), 30_000);
          const onVisChange = () => { if (document.hidden) Module.FSSync(); };
          document.addEventListener('visibilitychange', onVisChange);
          cleanupFns.push(
            () => clearInterval(syncInterval),
            () => document.removeEventListener('visibilitychange', onVisChange),
          );

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
      cleanupFns.forEach(fn => fn());
    };
  }, [canvas]);

  return { emulator, error };
}
