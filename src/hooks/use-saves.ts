import { useEffect, useCallback, useRef } from 'react';
import type { mGBAEmulator } from '../core/use-emulator.ts';

const API_BASE = '/api/saves';

interface SaveMeta {
  game: string;
  slot: string;
  updatedAt: string;
}

async function clearLocalSaveStates(emulator: mGBAEmulator) {
  const paths = emulator.filePaths();
  const baseName = emulator.gameName?.replace(/.*\//, '').replace(/\.[^.]+$/, '');
  if (!baseName) return;

  for (const slot of [1, 2, 3]) {
    try {
      emulator.FS.unlink(`${paths.saveStatePath}/${baseName}.ss${slot}`);
    } catch {
      // File doesn't exist, that's fine
    }
  }

  await emulator.FSSync();
  console.log('Cleared local save states from IndexedDB');
}

export function useSaves(emulator: mGBAEmulator | null, gameName: string | null) {
  const syncingRef = useRef(false);

  // On load: clear stale local save states, then auto-load the most recent cloud save
  useEffect(() => {
    if (!emulator || !gameName) return;

    (async () => {
      // Migrate local save states to cloud if needed
      const key = `cloud-migrated:${gameName}`;
      if (!localStorage.getItem(key)) {
        const res = await fetch(API_BASE);
        const cloudSaves: SaveMeta[] = res.ok ? await res.json() : [];
        const cloudSlots = new Set(
          cloudSaves.filter(s => s.game === gameName).map(s => Number(s.slot))
        );

        for (const slot of [1, 2, 3]) {
          if (cloudSlots.has(slot)) continue;
          try {
            const hasLocal = emulator.loadState(slot);
            if (!hasLocal) continue;
            await emulator.FSSync();
            const paths = emulator.filePaths();
            const stateFileName = `${emulator.gameName?.replace(/.*\//, '').replace(/\.[^.]+$/, '')}.ss${slot}`;
            const data = emulator.FS.readFile(`${paths.saveStatePath}/${stateFileName}`);
            await fetch(`${API_BASE}/${encodeURIComponent(gameName)}/${slot}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/octet-stream' },
              body: data,
            });
            console.log(`Migration: uploaded slot ${slot} to cloud`);
          } catch (err) {
            console.error(`Migration: failed to migrate slot ${slot}`, err);
          }
        }
        localStorage.setItem(key, '1');
      }

      await clearLocalSaveStates(emulator);

      // Auto-load the most recent cloud save state
      try {
        const res = await fetch(API_BASE);
        const cloudSaves: SaveMeta[] = res.ok ? await res.json() : [];
        const gameSaves = cloudSaves
          .filter(s => s.game === gameName)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        if (gameSaves.length > 0) {
          const slot = Number(gameSaves[0].slot);
          const saveRes = await fetch(`${API_BASE}/${encodeURIComponent(gameName)}/${slot}`);
          if (saveRes.ok) {
            const data = new Uint8Array(await saveRes.arrayBuffer());
            const paths = emulator.filePaths();
            const baseName = emulator.gameName?.replace(/.*\//, '').replace(/\.[^.]+$/, '');
            emulator.FS.writeFile(`${paths.saveStatePath}/${baseName}.ss${slot}`, data);
            const loaded = emulator.loadState(slot);
            if (loaded) {
              console.log(`Auto-loaded cloud save slot ${slot}`);
            }
          }
        }
      } catch (err) {
        console.error('Failed to auto-load cloud save:', err);
      }
    })();
  }, [emulator, gameName]);

  const saveToCloud = useCallback(async (slot: number) => {
    if (!emulator || !gameName || syncingRef.current) return;
    syncingRef.current = true;

    try {
      const saved = emulator.saveState(slot);
      if (!saved) throw new Error(`Failed to save state to slot ${slot}`);

      await emulator.FSSync();

      const paths = emulator.filePaths();
      const stateFileName = `${emulator.gameName?.replace(/.*\//, '').replace(/\.[^.]+$/, '')}.ss${slot}`;
      const statePath = `${paths.saveStatePath}/${stateFileName}`;

      let data: Uint8Array;
      try {
        data = emulator.FS.readFile(statePath);
      } catch {
        throw new Error(`Could not read save state file: ${statePath}`);
      }

      const res = await fetch(`${API_BASE}/${encodeURIComponent(gameName)}/${slot}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: data,
      });

      if (!res.ok) throw new Error(`Cloud save failed: ${res.status}`);
      console.log(`Saved slot ${slot} to cloud`);
    } finally {
      syncingRef.current = false;
    }
  }, [emulator, gameName]);

  const loadFromCloud = useCallback(async (slot: number) => {
    if (!emulator || !gameName) throw new Error('Emulator or game not ready');

    const res = await fetch(`${API_BASE}/${encodeURIComponent(gameName)}/${slot}`);
    if (!res.ok) throw new Error(`Cloud load failed: ${res.status}`);

    const data = new Uint8Array(await res.arrayBuffer());

    const paths = emulator.filePaths();
    const stateFileName = `${emulator.gameName?.replace(/.*\//, '').replace(/\.[^.]+$/, '')}.ss${slot}`;
    const statePath = `${paths.saveStatePath}/${stateFileName}`;

    emulator.FS.writeFile(statePath, data);

    const loaded = emulator.loadState(slot);
    if (!loaded) throw new Error(`Failed to load state from slot ${slot}`);
    console.log(`Loaded slot ${slot} from cloud`);
  }, [emulator, gameName]);

  const listCloudSaves = useCallback(async (): Promise<SaveMeta[]> => {
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }, []);

  // Auto-save to cloud slot 0 on tab hide and page unload
  useEffect(() => {
    if (!emulator || !gameName) return;

    const AUTO_SLOT = 0;

    function getAutoSaveData(): Uint8Array | null {
      try {
        const saved = emulator!.saveState(AUTO_SLOT);
        if (!saved) return null;
        const paths = emulator!.filePaths();
        const baseName = emulator!.gameName?.replace(/.*\//, '').replace(/\.[^.]+$/, '');
        const statePath = `${paths.saveStatePath}/${baseName}.ss${AUTO_SLOT}`;
        return emulator!.FS.readFile(statePath);
      } catch {
        return null;
      }
    }

    const url = `${API_BASE}/${encodeURIComponent(gameName)}/${AUTO_SLOT}`;

    const onVisChange = () => {
      if (!document.hidden) return;
      const data = getAutoSaveData();
      if (data) {
        navigator.sendBeacon(url, new Blob([data], { type: 'application/octet-stream' }));
        console.log('Auto-saved to cloud slot 0 (visibility)');
      }
    };

    const onBeforeUnload = () => {
      const data = getAutoSaveData();
      if (data) {
        navigator.sendBeacon(url, new Blob([data], { type: 'application/octet-stream' }));
        console.log('Auto-saved to cloud slot 0 (unload)');
      }
    };

    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [emulator, gameName]);

  return { saveToCloud, loadFromCloud, listCloudSaves };
}
