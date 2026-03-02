import { useCallback, useEffect, useState, useRef } from 'react';
import { useEmulatorContext } from '../emulator-context.tsx';

interface ServerRom {
  name: string;
  size: number;
}

export function useRomLoader() {
  const { emulator, romLoaded, setLoading, setRomLoaded } = useEmulatorContext();
  const [serverRoms, setServerRoms] = useState<ServerRom[]>([]);
  const [checking, setChecking] = useState(true);
  const autoLoadAttempted = useRef(false);

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
        const gameName = romName.replace(/\.(gba|gbc|gb|zip)$/i, '');
        setRomLoaded(gameName);
      } else {
        console.error('Failed to load ROM:', romName);
        setLoading(false);
      }
    });
  }, [emulator, setRomLoaded, setLoading]);

  // Upload ROM from file picker, then sync to server
  const loadRom = useCallback(async (file: File) => {
    setLoading(true);
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
  }, [loadRomIntoEmulator, setLoading]);

  // Load ROM from server by name
  const loadServerRom = useCallback(async (name: string) => {
    if (!emulator) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/roms/${encodeURIComponent(name)}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const file = new File([blob], name);
      loadRomIntoEmulator(file);
    } catch (err) {
      console.error('Failed to load ROM from server:', err);
      setLoading(false);
    }
  }, [emulator, loadRomIntoEmulator, setLoading]);

  // Auto-load last ROM on revisit
  useEffect(() => {
    if (!emulator || romLoaded || checking || autoLoadAttempted.current) return;
    if (serverRoms.length === 0) return;

    autoLoadAttempted.current = true;

    const lastRom = localStorage.getItem('gba-last-rom');
    if (!lastRom) return;

    // Find matching ROM on server
    const match = serverRoms.find(r =>
      r.name.replace(/\.(gba|gbc|gb)$/i, '') === lastRom
    );
    if (match) {
      console.log('Auto-loading last ROM:', match.name);
      loadServerRom(match.name);
    }
  }, [emulator, romLoaded, checking, serverRoms, loadServerRom]);

  return { loadRom, loadServerRom, serverRoms, checking };
}
