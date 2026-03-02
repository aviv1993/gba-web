import { useCallback, useState } from 'react';
import { useEmulatorContext } from '../emulator-context.tsx';
import { SaveSlots } from './SaveSlots.tsx';

export function Toolbar() {
  const { romLoaded, paused, muted, speed, togglePause, toggleMute, setSpeed } = useEmulatorContext();
  const [showHelp, setShowHelp] = useState(false);

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
      <button className="toolbar-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
        {muted ? '🔇' : '🔊'}
      </button>
      <button className="toolbar-btn" onClick={cycleSpeed} title={`Speed: ${speed}x`}>
        {speed}x
      </button>
      <SaveSlots />
      <button className="toolbar-btn" onClick={toggleFullscreen} title="Fullscreen">
        ⛶
      </button>
      <div className="help-wrapper">
        <button className="toolbar-btn" onClick={() => setShowHelp(!showHelp)} title="Controls">
          ?
        </button>
        {showHelp && (
          <div className="help-dropdown">
            <div className="help-title">Keyboard Controls</div>
            <div className="help-row"><kbd>Arrow Keys</kbd> D-pad</div>
            <div className="help-row"><kbd>X</kbd> A button</div>
            <div className="help-row"><kbd>Z</kbd> B button</div>
            <div className="help-row"><kbd>A</kbd> L shoulder</div>
            <div className="help-row"><kbd>S</kbd> R shoulder</div>
            <div className="help-row"><kbd>Enter</kbd> Start</div>
            <div className="help-row"><kbd>Backspace</kbd> Select</div>
            <div className="help-row"><kbd>Space</kbd> Fast forward (hold)</div>
          </div>
        )}
      </div>
    </div>
  );
}
