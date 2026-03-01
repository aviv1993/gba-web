import { useState, useEffect, useCallback } from 'react';
import { useEmulatorContext } from '../emulator-context.tsx';
import { useSaves } from '../hooks/use-saves.ts';

export function SaveSlots() {
  const { emulator, romLoaded, gameName } = useEmulatorContext();
  const { saveToCloud, loadFromCloud, listCloudSaves, saveLocal, loadLocal } = useSaves(emulator, gameName);
  const [cloudSlots, setCloudSlots] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!romLoaded || !gameName) return;
    listCloudSaves().then(saves => {
      const map: Record<number, string> = {};
      for (const s of saves) {
        if (s.game === gameName) {
          map[Number(s.slot)] = s.updatedAt;
        }
      }
      setCloudSlots(map);
    });
  }, [romLoaded, gameName, listCloudSaves]);

  const handleSave = useCallback(async (slot: number) => {
    setBusy(slot);
    saveLocal(slot);
    await saveToCloud(slot);
    setCloudSlots(prev => ({ ...prev, [slot]: new Date().toISOString() }));
    setBusy(null);
  }, [saveLocal, saveToCloud]);

  const handleLoad = useCallback(async (slot: number) => {
    setBusy(slot);
    const loaded = loadLocal(slot) || await loadFromCloud(slot);
    if (!loaded) {
      console.log('No save in slot', slot);
    }
    setBusy(null);
  }, [loadLocal, loadFromCloud]);

  if (!romLoaded) return null;

  return (
    <div className="save-slots-wrapper">
      <button className="toolbar-btn" onClick={() => setOpen(!open)} title="Save Slots">
        💾
      </button>
      {open && (
        <div className="save-slots-dropdown">
          {[1, 2, 3].map(slot => (
            <div key={slot} className="save-slot">
              <span className="save-slot-label">
                Slot {slot}
                {cloudSlots[slot] && <span className="save-slot-cloud" title="Synced to cloud">☁</span>}
              </span>
              <button
                className="save-slot-btn"
                onClick={() => handleSave(slot)}
                disabled={busy !== null}
              >
                {busy === slot ? '...' : 'Save'}
              </button>
              <button
                className="save-slot-btn"
                onClick={() => handleLoad(slot)}
                disabled={busy !== null}
              >
                {busy === slot ? '...' : 'Load'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
