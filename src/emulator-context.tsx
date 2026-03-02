import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { mGBAEmulator } from './core/use-emulator.ts';

interface EmulatorState {
  emulator: mGBAEmulator | null;
  romLoaded: boolean;
  loading: boolean;
  paused: boolean;
  muted: boolean;
  speed: number;
  gameName: string | null;
}

interface EmulatorContextValue extends EmulatorState {
  setEmulator: (emu: mGBAEmulator) => void;
  setLoading: (loading: boolean) => void;
  setRomLoaded: (name: string) => void;
  togglePause: () => void;
  toggleMute: () => void;
  setSpeed: (speed: number) => void;
}

const EmulatorContext = createContext<EmulatorContextValue | null>(null);

export function EmulatorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EmulatorState>({
    emulator: null,
    romLoaded: false,
    loading: false,
    paused: false,
    muted: false,
    speed: 1,
    gameName: null,
  });

  const setEmulator = useCallback((emu: mGBAEmulator) => {
    setState(s => ({ ...s, emulator: emu }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState(s => ({ ...s, loading }));
  }, []);

  const setRomLoaded = useCallback((name: string) => {
    setState(s => ({ ...s, romLoaded: true, loading: false, gameName: name, paused: false }));
    // Persist last ROM name for auto-resume
    try { localStorage.setItem('gba-last-rom', name); } catch {}
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

  const toggleMute = useCallback(() => {
    setState(s => {
      if (!s.emulator) return s;
      const newMuted = !s.muted;
      s.emulator.setVolume(newMuted ? 0 : 1);
      return { ...s, muted: newMuted };
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
    <EmulatorContext.Provider value={{ ...state, setEmulator, setLoading, setRomLoaded, togglePause, toggleMute, setSpeed }}>
      {children}
    </EmulatorContext.Provider>
  );
}

export function useEmulatorContext() {
  const ctx = useContext(EmulatorContext);
  if (!ctx) throw new Error('useEmulatorContext must be used within EmulatorProvider');
  return ctx;
}
