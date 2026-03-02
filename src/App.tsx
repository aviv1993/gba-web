import { EmulatorProvider, useEmulatorContext } from './emulator-context.tsx';
import { Screen } from './components/Screen.tsx';
import { RomLoader } from './components/RomLoader.tsx';
import { TouchControls } from './components/TouchControls.tsx';
import { Toolbar } from './components/Toolbar.tsx';
import { useKeyboard } from './hooks/use-keyboard.ts';
import { useTouchSpeed } from './hooks/use-touch-speed.ts';

function EmulatorApp() {
  const { emulator, speed } = useEmulatorContext();
  useKeyboard(emulator, speed);
  useTouchSpeed();

  return (
    <div className="app">
      <div className="game-area">
        <Screen />
        <RomLoader />
      </div>
      <TouchControls />
      <Toolbar />
    </div>
  );
}

export default function App() {
  return (
    <EmulatorProvider>
      <EmulatorApp />
    </EmulatorProvider>
  );
}
