import { EmulatorProvider, useEmulatorContext } from './emulator-context.tsx';
import { Screen } from './components/Screen.tsx';
import { RomLoader } from './components/RomLoader.tsx';
import { TouchControls } from './components/TouchControls.tsx';
import { Toolbar } from './components/Toolbar.tsx';
import { useKeyboard } from './hooks/use-keyboard.ts';

function EmulatorApp() {
  const { emulator } = useEmulatorContext();
  useKeyboard(emulator);

  return (
    <div className="app">
      <div className="game-area">
        <Screen />
        <RomLoader />
      </div>
      <Toolbar />
      <TouchControls />
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
