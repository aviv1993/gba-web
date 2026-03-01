import { useCallback, useRef, useState, type DragEvent } from 'react';
import { useRomLoader } from '../hooks/use-rom-loader.ts';
import { useEmulatorContext } from '../emulator-context.tsx';

export function RomLoader() {
  const { loadRom } = useRomLoader();
  const { emulator, romLoaded } = useEmulatorContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (file.name.match(/\.(gba|gbc|gb|zip)$/i)) {
      loadRom(file);
    }
  }, [loadRom]);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  if (!emulator) {
    return <div className="rom-loader">Initializing emulator...</div>;
  }

  if (romLoaded) return null;

  return (
    <div
      className={`rom-loader ${dragging ? 'rom-loader--dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
    >
      <div className="rom-loader-content">
        <div className="rom-loader-icon">🎮</div>
        <p>Drop a ROM file here or tap to browse</p>
        <p className="rom-loader-hint">.gba, .gbc, .gb</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".gba,.gbc,.gb,.zip"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        hidden
      />
    </div>
  );
}
