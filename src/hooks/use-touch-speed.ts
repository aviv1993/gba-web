import { useEffect, useRef } from 'react';
import { useEmulatorContext } from '../emulator-context.tsx';

const DOUBLE_TAP_MS = 300;

/**
 * Double-tap and hold anywhere on the game screen to engage 2x speed.
 * Release to return to normal speed.
 */
export function useTouchSpeed() {
  const { emulator, speed, romLoaded } = useEmulatorContext();
  const lastTapRef = useRef(0);
  const holdingRef = useRef(false);

  useEffect(() => {
    if (!emulator || !romLoaded) return;

    // Only on touch devices
    if (!window.matchMedia('(pointer: coarse)').matches) return;

    function onTouchStart(e: TouchEvent) {
      const now = Date.now();
      const gap = now - lastTapRef.current;

      if (gap < DOUBLE_TAP_MS) {
        // Second tap — engage fast-forward
        holdingRef.current = true;
        emulator!.setFastForwardMultiplier(speed * 2);
        lastTapRef.current = 0; // Reset so a third tap doesn't re-trigger
      } else {
        lastTapRef.current = now;
      }
    }

    function onTouchEnd() {
      if (holdingRef.current) {
        holdingRef.current = false;
        emulator!.setFastForwardMultiplier(speed);
      }
    }

    // Listen on the game-area element (the screen)
    const gameArea = document.querySelector('.game-area');
    if (!gameArea) return;

    gameArea.addEventListener('touchstart', onTouchStart as EventListener, { passive: true });
    gameArea.addEventListener('touchend', onTouchEnd as EventListener, { passive: true });
    gameArea.addEventListener('touchcancel', onTouchEnd as EventListener, { passive: true });

    return () => {
      gameArea.removeEventListener('touchstart', onTouchStart as EventListener);
      gameArea.removeEventListener('touchend', onTouchEnd as EventListener);
      gameArea.removeEventListener('touchcancel', onTouchEnd as EventListener);
      // Reset speed on cleanup
      if (holdingRef.current) {
        emulator!.setFastForwardMultiplier(speed);
        holdingRef.current = false;
      }
    };
  }, [emulator, romLoaded, speed]);
}
