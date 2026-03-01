import { useCallback } from 'react';
import { useEmulatorContext } from '../emulator-context.tsx';

type GBAButton = 'Up' | 'Down' | 'Left' | 'Right' | 'A' | 'B' | 'L' | 'R' | 'Start' | 'Select';

function Button({ name, label, className }: { name: GBAButton; label: string; className?: string }) {
  const { emulator } = useEmulatorContext();

  const press = useCallback(() => {
    emulator?.buttonPress(name);
  }, [emulator, name]);

  const release = useCallback(() => {
    emulator?.buttonUnpress(name);
  }, [emulator, name]);

  return (
    <button
      className={`touch-btn ${className ?? ''}`}
      onTouchStart={(e) => { e.preventDefault(); press(); }}
      onTouchEnd={(e) => { e.preventDefault(); release(); }}
      onMouseDown={press}
      onMouseUp={release}
      onMouseLeave={release}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: 'none' }}
    >
      {label}
    </button>
  );
}

export function TouchControls() {
  const { romLoaded } = useEmulatorContext();

  if (!romLoaded) return null;

  return (
    <div className="touch-controls">
      {/* Shoulder buttons */}
      <div className="shoulder-buttons">
        <Button name="L" label="L" className="touch-btn-shoulder" />
        <Button name="R" label="R" className="touch-btn-shoulder" />
      </div>

      {/* Main controls area */}
      <div className="main-controls">
        {/* D-pad */}
        <div className="dpad">
          <Button name="Up" label="▲" className="dpad-up" />
          <Button name="Left" label="◀" className="dpad-left" />
          <div className="dpad-center" />
          <Button name="Right" label="▶" className="dpad-right" />
          <Button name="Down" label="▼" className="dpad-down" />
        </div>

        {/* A/B buttons */}
        <div className="ab-buttons">
          <Button name="A" label="A" className="touch-btn-a" />
          <Button name="B" label="B" className="touch-btn-b" />
        </div>
      </div>

      {/* Start/Select */}
      <div className="start-select">
        <Button name="Select" label="SELECT" className="touch-btn-meta" />
        <Button name="Start" label="START" className="touch-btn-meta" />
      </div>
    </div>
  );
}
