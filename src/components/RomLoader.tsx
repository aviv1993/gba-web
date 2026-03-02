import { useCallback, useRef, useState, type DragEvent } from 'react';
import { useRomLoader } from '../hooks/use-rom-loader.ts';
import { useEmulatorContext } from '../emulator-context.tsx';

export function RomLoader() {
  const { loadRom, loadServerRom, serverRoms, checking } = useRomLoader();
  const { emulator, romLoaded, loading } = useEmulatorContext();
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

  if (!emulator || loading) {
    return (
      <div className="rom-loader">
        <div className="rom-loader-content">
          <div className="spinner" />
          <p style={{ marginTop: 16 }}>{!emulator ? 'Initializing emulator...' : 'Loading ROM...'}</p>
        </div>
      </div>
    );
  }

  if (romLoaded) return null;

  if (checking) {
    return (
      <div className="rom-loader">
        <div className="rom-loader-content">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rom-loader ${dragging ? 'rom-loader--dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="rom-loader-content">
        {serverRoms.length > 0 ? (
          <>
            <div className="rom-loader-icon">🎮</div>
            <div className="rom-server-list">
              {serverRoms.map(rom => (
                <button
                  key={rom.name}
                  className="rom-server-btn"
                  onClick={() => loadServerRom(rom.name)}
                >
                  {rom.name.replace(/\.(gba|gbc|gb)$/i, '')}
                </button>
              ))}
            </div>
            <p className="rom-loader-hint" style={{ marginTop: 12 }}>
              or{' '}
              <span className="rom-loader-link" onClick={() => fileInputRef.current?.click()}>
                load a different ROM
              </span>
            </p>
          </>
        ) : (
          <>
            <div className="rom-loader-icon">🎮</div>
            <p
              onClick={() => fileInputRef.current?.click()}
              style={{ cursor: 'pointer' }}
            >
              Drop a ROM file here or tap to browse
            </p>
            <p className="rom-loader-hint">.gba, .gbc, .gb</p>
          </>
        )}
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
