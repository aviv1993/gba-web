import { useEffect, useCallback, useRef } from 'react';
import type { mGBAEmulator } from '../core/use-emulator.ts';

const API_BASE = '/api/saves';

interface SaveMeta {
  game: string;
  slot: string;
  updatedAt: string;
}

export function useSaves(emulator: mGBAEmulator | null, gameName: string | null) {
  const syncingRef = useRef(false);

  // Auto-save FS to IndexedDB every 30 seconds
  useEffect(() => {
    if (!emulator || !gameName) return;

    const interval = setInterval(() => {
      emulator.FSSync().catch(console.error);
    }, 30_000);

    return () => clearInterval(interval);
  }, [emulator, gameName]);

  // Save on visibility hidden (tab switch, app background)
  useEffect(() => {
    if (!emulator || !gameName) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        emulator.forceAutoSaveState();
        emulator.FSSync().catch(console.error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [emulator, gameName]);

  const saveToCloud = useCallback(async (slot: number) => {
    if (!emulator || !gameName || syncingRef.current) return;
    syncingRef.current = true;

    try {
      const saved = emulator.saveState(slot);
      if (!saved) {
        console.error('Failed to save state to slot', slot);
        return;
      }

      await emulator.FSSync();

      // Read the save state file from the FS
      const paths = emulator.filePaths();
      const stateFileName = `${emulator.gameName?.replace(/.*\//, '').replace(/\.[^.]+$/, '')}.ss${slot}`;
      const statePath = `${paths.saveStatePath}/${stateFileName}`;

      let data: Uint8Array;
      try {
        data = emulator.FS.readFile(statePath);
      } catch {
        console.error('Could not read save state file:', statePath);
        return;
      }

      const res = await fetch(`${API_BASE}/${encodeURIComponent(gameName)}/${slot}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: data,
      });

      if (!res.ok) {
        console.error('Cloud save failed:', res.status);
      } else {
        console.log(`Saved slot ${slot} to cloud`);
      }
    } finally {
      syncingRef.current = false;
    }
  }, [emulator, gameName]);

  const loadFromCloud = useCallback(async (slot: number) => {
    if (!emulator || !gameName) return false;

    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(gameName)}/${slot}`);
      if (!res.ok) return false;

      const data = new Uint8Array(await res.arrayBuffer());

      // Write the save state file to FS
      const paths = emulator.filePaths();
      const stateFileName = `${emulator.gameName?.replace(/.*\//, '').replace(/\.[^.]+$/, '')}.ss${slot}`;
      const statePath = `${paths.saveStatePath}/${stateFileName}`;

      emulator.FS.writeFile(statePath, data);

      const loaded = emulator.loadState(slot);
      if (loaded) {
        console.log(`Loaded slot ${slot} from cloud`);
      }
      return loaded;
    } catch (err) {
      console.error('Cloud load failed:', err);
      return false;
    }
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

  const saveLocal = useCallback((slot: number) => {
    if (!emulator) return false;
    const saved = emulator.saveState(slot);
    if (saved) {
      emulator.FSSync().catch(console.error);
    }
    return saved;
  }, [emulator]);

  const loadLocal = useCallback((slot: number) => {
    if (!emulator) return false;
    return emulator.loadState(slot);
  }, [emulator]);

  return { saveToCloud, loadFromCloud, listCloudSaves, saveLocal, loadLocal };
}
