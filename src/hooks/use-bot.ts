import { useEffect, useState, useCallback, useRef } from 'react';
import { useEmulatorContext } from '../emulator-context.tsx';
import { createBotEngine } from '../bot/engine.ts';
import type { BotState, BotAction } from '../bot/types.ts';

const IDLE_STATE: BotState = {
  status: 'IDLE',
  targetName: '',
  encounterCount: 0,
  battleState: null,
  error: null,
};

export function useBot() {
  const { emulator, romLoaded } = useEmulatorContext();
  const [botState, setBotState] = useState<BotState>(IDLE_STATE);
  const engineRef = useRef<ReturnType<typeof createBotEngine> | null>(null);

  // Listen for bot state changes (dispatched from engine)
  useEffect(() => {
    const handler = (e: Event) => {
      const state = (e as CustomEvent<BotState>).detail;
      setBotState(state);
    };
    window.addEventListener('bot-state-change', handler);
    return () => window.removeEventListener('bot-state-change', handler);
  }, []);

  // Create/destroy engine when emulator is available
  useEffect(() => {
    if (!emulator || !romLoaded) return;

    const eng = createBotEngine(emulator);
    engineRef.current = eng;

    // Expose window globals for Playwright/Claude Code
    const w = window as Window & Record<string, unknown>;
    w.startBot = (pokemonName: string) => {
      eng.start(pokemonName);
    };
    w.stopBot = () => {
      eng.stop();
      setBotState(IDLE_STATE);
    };
    w.setBotAction = (action: BotAction) => {
      eng.setAction(action);
    };
    w.getBotState = () => eng.getState();

    return () => {
      eng.destroy();
      engineRef.current = null;
      delete w.startBot;
      delete w.stopBot;
      delete w.setBotAction;
      delete w.getBotState;
    };
  }, [emulator, romLoaded]);

  const stopBot = useCallback(() => {
    engineRef.current?.stop();
    setBotState(IDLE_STATE);
  }, []);

  return { botState, stopBot };
}
