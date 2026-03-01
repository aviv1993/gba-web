import { useCallback } from 'react';
import { useEmulatorContext } from '../emulator-context.tsx';

export function useRomLoader() {
  const { emulator, setRomLoaded } = useEmulatorContext();

  const loadRom = useCallback(async (file: File) => {
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

  return { loadRom };
}
