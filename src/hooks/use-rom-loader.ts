import { useCallback, useEffect, useState } from 'react';
import { useEmulatorContext } from '../emulator-context.tsx';

interface ServerRom {
  name: string;
  size: number;
}

export function useRomLoader() {
  const { emulator, setRomLoaded } = useEmulatorContext();
  const [serverRoms, setServerRoms] = useState<ServerRom[]>([]);
  const [checking, setChecking] = useState(true);

  // Check server for existing ROMs on mount
  useEffect(() => {
    fetch('/api/roms')
      .then(r => r.ok ? r.json() : [])
      .then(setServerRoms)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const loadRomIntoEmulator = useCallback((file: File) => {
    if (!emulator) return;

    const romName = file.name;
    const paths = emulator.filePaths();

    emulator.uploadRom(file, () => {
      const romPath = paths.gamePath + '/' + romName;
      const loaded = emulator.loadGame(romPath);

      if (loaded) {
        console.log('ROM loaded:', romName);
        setRomLoaded(romName.replace(/\.(gba|gbc|gb|zip)$/i, ''));
      } else {
        console.error('Failed to load ROM:', romName);
      }
    });
  }, [emulator, setRomLoaded]);

  // Upload ROM from file picker, then sync to server
  const loadRom = useCallback(async (file: File) => {
    loadRomIntoEmulator(file);

    // Upload to server in background
    try {
      await fetch(`/api/roms/${encodeURIComponent(file.name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      });
      console.log('ROM synced to server');
    } catch {
      console.warn('Failed to sync ROM to server');
    }
  }, [loadRomIntoEmulator]);

  // Load ROM from server by name
  const loadServerRom = useCallback(async (name: string) => {
    if (!emulator) return;

    try {
      const res = await fetch(`/api/roms/${encodeURIComponent(name)}`);
      if (!res.ok) return;

      const blob = await res.blob();
      const file = new File([blob], name);
      loadRomIntoEmulator(file);
    } catch (err) {
      console.error('Failed to load ROM from server:', err);
    }
  }, [emulator, loadRomIntoEmulator]);

  return { loadRom, loadServerRom, serverRoms, checking };
}
