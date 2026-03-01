import { useEffect, useCallback, useState } from 'react';
import { useEmulator } from '../core/use-emulator.ts';
import { useEmulatorContext } from '../emulator-context.tsx';

export function Screen() {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const canvasRef = useCallback((node: HTMLCanvasElement | null) => {
    setCanvas(node);
  }, []);

  const { emulator, error } = useEmulator(canvas);
  const { setEmulator } = useEmulatorContext();

  useEffect(() => {
    if (emulator) {
      setEmulator(emulator);
    }
  }, [emulator, setEmulator]);

  return (
    <div className="screen-container">
      <canvas
        ref={canvasRef}
        width={240}
        height={160}
        className="gba-screen"
      />
      {error && <div className="screen-error">Failed to load emulator: {error}</div>}
    </div>
  );
}
