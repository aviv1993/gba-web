import { useRef, useEffect, useCallback, useState } from 'react';
import { useEmulatorContext } from '../emulator-context.tsx';

type Direction = 'Up' | 'Down' | 'Left' | 'Right';

const DEAD_ZONE = 18;

// 8-sector mapping: angle → active directions
// Sectors are 45° each, centered on the cardinal/diagonal directions
function angleToDirections(angle: number): Set<Direction> {
  // Normalize to 0–360
  const a = ((angle % 360) + 360) % 360;
  const dirs = new Set<Direction>();

  // Right: 337.5–22.5
  if (a >= 337.5 || a < 22.5) dirs.add('Right');
  // Down-Right: 22.5–67.5
  else if (a >= 22.5 && a < 67.5) { dirs.add('Right'); dirs.add('Down'); }
  // Down: 67.5–112.5
  else if (a >= 67.5 && a < 112.5) dirs.add('Down');
  // Down-Left: 112.5–157.5
  else if (a >= 112.5 && a < 157.5) { dirs.add('Left'); dirs.add('Down'); }
  // Left: 157.5–202.5
  else if (a >= 157.5 && a < 202.5) dirs.add('Left');
  // Up-Left: 202.5–247.5
  else if (a >= 202.5 && a < 247.5) { dirs.add('Left'); dirs.add('Up'); }
  // Up: 247.5–292.5
  else if (a >= 247.5 && a < 292.5) dirs.add('Up');
  // Up-Right: 292.5–337.5
  else if (a >= 292.5 && a < 337.5) { dirs.add('Right'); dirs.add('Up'); }

  return dirs;
}

const ALL_DIRECTIONS: Direction[] = ['Up', 'Down', 'Left', 'Right'];

export function useVirtualDpad() {
  const { emulator } = useEmulatorContext();
  const zoneRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const touchIdRef = useRef<number | null>(null);
  const activeDirsRef = useRef<Set<Direction>>(new Set());
  const [activeDirections, setActiveDirections] = useState<Set<Direction>>(new Set());

  const applyDiff = useCallback((newDirs: Set<Direction>) => {
    if (!emulator) return;
    const prev = activeDirsRef.current;

    // Unpress directions no longer active
    for (const dir of ALL_DIRECTIONS) {
      if (prev.has(dir) && !newDirs.has(dir)) {
        emulator.buttonUnpress(dir);
      }
    }
    // Press newly active directions
    for (const dir of ALL_DIRECTIONS) {
      if (newDirs.has(dir) && !prev.has(dir)) {
        emulator.buttonPress(dir);
      }
    }

    activeDirsRef.current = newDirs;
    setActiveDirections(new Set(newDirs));
  }, [emulator]);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;

    function onTouchStart(e: TouchEvent) {
      // Only capture if we don't already have a tracked touch
      if (touchIdRef.current !== null) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      e.preventDefault();
      touchIdRef.current = touch.identifier;
      originRef.current = { x: touch.clientX, y: touch.clientY };
    }

    function onTouchMove(e: TouchEvent) {
      if (touchIdRef.current === null || !originRef.current) return;
      e.preventDefault();

      // Find our tracked touch
      let touch: Touch | null = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          touch = e.changedTouches[i];
          break;
        }
      }
      if (!touch) return;

      const dx = touch.clientX - originRef.current.x;
      const dy = touch.clientY - originRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < DEAD_ZONE) {
        applyDiff(new Set());
        return;
      }

      // atan2 gives angle from positive X axis, clockwise
      // We want: right=0°, down=90°, left=180°, up=270°
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const normalized = ((angle % 360) + 360) % 360;
      applyDiff(angleToDirections(normalized));
    }

    function onTouchEnd(e: TouchEvent) {
      if (touchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          e.preventDefault();
          touchIdRef.current = null;
          originRef.current = null;
          applyDiff(new Set());
          return;
        }
      }
    }

    zone.addEventListener('touchstart', onTouchStart, { passive: false });
    zone.addEventListener('touchmove', onTouchMove, { passive: false });
    zone.addEventListener('touchend', onTouchEnd, { passive: false });
    zone.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      zone.removeEventListener('touchstart', onTouchStart);
      zone.removeEventListener('touchmove', onTouchMove);
      zone.removeEventListener('touchend', onTouchEnd);
      zone.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [applyDiff]);

  return { zoneRef, activeDirections };
}
