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

  // Clear stale local save states on every load — cloud is the source of truth
  useEffect(() => {
    if (!emulator || !gameName) return;

    const key = `cloud-migrated:${gameName}`;
    if (localStorage.getItem(key)) {
      clearLocalSaveStates(emulator);
      return;
    }

    (async () => {
      // Check which slots already exist in cloud — never overwrite them
      const res = await fetch(API_BASE);
      const cloudSaves: SaveMeta[] = res.ok ? await res.json() : [];
      const cloudSlots = new Set(
        cloudSaves.filter(s => s.game === gameName).map(s => Number(s.slot))
      );

      for (const slot of [1, 2, 3]) {
        if (cloudSlots.has(slot)) {
          console.log(`Migration: slot ${slot} already in cloud, skipping`);
          continue;
        }

        try {
          const hasLocal = emulator.loadState(slot);
          if (!hasLocal) continue;

          // Local save exists and cloud is empty — upload
          await emulator.FSSync();

          const paths = emulator.filePaths();
          const stateFileName = `${emulator.gameName?.replace(/.*\//, '').replace(/\.[^.]+$/, '')}.ss${slot}`;
          const statePath = `${paths.saveStatePath}/${stateFileName}`;

          let data: Uint8Array;
          try {
            data = emulator.FS.readFile(statePath);
          } catch {
            continue;
          }

          const res = await fetch(`${API_BASE}/${encodeURIComponent(gameName)}/${slot}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: data,
          });

          if (res.ok) {
            console.log(`Migration: uploaded slot ${slot} to cloud`);
          }
        } catch (err) {
          console.error(`Migration: failed to migrate slot ${slot}`, err);
        }
      }

      localStorage.setItem(key, '1');
      console.log(`Migration complete for ${gameName}`);

      // Wipe local save state files so IndexedDB never restores stale data
      await clearLocalSaveStates(emulator);
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

  return { saveToCloud, loadFromCloud, listCloudSaves };
}
