import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { mGBAEmulator } from './core/use-emulator.ts';

interface EmulatorState {
  emulator: mGBAEmulator | null;
  romLoaded: boolean;
  paused: boolean;
  speed: number;
  gameName: string | null;
}

interface EmulatorContextValue extends EmulatorState {
  setEmulator: (emu: mGBAEmulator) => void;
  setRomLoaded: (name: string) => void;
  togglePause: () => void;
  setSpeed: (speed: number) => void;
}

const EmulatorContext = createContext<EmulatorContextValue | null>(null);

export function EmulatorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EmulatorState>({
    emulator: null,
    romLoaded: false,
    paused: false,
    speed: 1,
    gameName: null,
  });

  const setEmulator = useCallback((emu: mGBAEmulator) => {
    setState(s => ({ ...s, emulator: emu }));
  }, []);

  const setRomLoaded = useCallback((name: string) => {
    setState(s => ({ ...s, romLoaded: true, gameName: name, paused: false }));
  }, []);

  const togglePause = useCallback(() => {
    setState(s => {
      if (!s.emulator || !s.romLoaded) return s;
      if (s.paused) {
        s.emulator.resumeGame();
      } else {
        s.emulator.pauseGame();
      }
      return { ...s, paused: !s.paused };
    });
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setState(s => {
      if (!s.emulator) return s;
      s.emulator.setFastForwardMultiplier(speed);
      return { ...s, speed };
    });
  }, []);

  return (
    <EmulatorContext.Provider value={{ ...state, setEmulator, setRomLoaded, togglePause, setSpeed }}>
      {children}
    </EmulatorContext.Provider>
  );
}

export function useEmulatorContext() {
  const ctx = useContext(EmulatorContext);
  if (!ctx) throw new Error('useEmulatorContext must be used within EmulatorProvider');
  return ctx;
}
