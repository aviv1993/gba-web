import { useCallback } from 'react';
import { useEmulatorContext } from '../emulator-context.tsx';
import { SaveSlots } from './SaveSlots.tsx';

export function Toolbar() {
  const { romLoaded, paused, speed, togglePause, setSpeed } = useEmulatorContext();

  const cycleSpeed = useCallback(() => {
    const speeds = [1, 2, 4];
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
  }, [speed, setSpeed]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  if (!romLoaded) return null;

  return (
    <div className="toolbar">
      <button className="toolbar-btn" onClick={togglePause} title={paused ? 'Resume' : 'Pause'}>
        {paused ? '▶' : '⏸'}
      </button>
      <button className="toolbar-btn" onClick={cycleSpeed} title={`Speed: ${speed}x`}>
        {speed}x
      </button>
      <SaveSlots />
      <button className="toolbar-btn" onClick={toggleFullscreen} title="Fullscreen">
        ⛶
      </button>
    </div>
  );
}
