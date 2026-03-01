import { useEffect } from 'react';
import type { mGBAEmulator } from '../core/use-emulator.ts';

const KEY_MAP: Record<string, string> = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  x: 'A',
  X: 'A',
  z: 'B',
  Z: 'B',
  a: 'L',
  A: 'L',
  s: 'R',
  S: 'R',
  Enter: 'Start',
  Backspace: 'Select',
};

export function useKeyboard(emulator: mGBAEmulator | null) {
  useEffect(() => {
    if (!emulator) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const button = KEY_MAP[e.key];
      if (button) {
        e.preventDefault();
        emulator.buttonPress(button);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const button = KEY_MAP[e.key];
      if (button) {
        e.preventDefault();
        emulator.buttonUnpress(button);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [emulator]);
}
