import type { mGBAEmulator } from '../core/use-emulator.ts';

export type BotStatus =
  | 'IDLE'
  | 'WALKING'
  | 'BATTLE_ENTERING'
  | 'RUNNING'
  | 'WAITING_FOR_DECISION'
  | 'EXECUTING_ACTION'
  | 'DONE'
  | 'ERROR';

export interface WildPokemon {
  species: number;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  status: string;
}

export interface PlayerPokemon {
  species: number;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  moves: MoveSlot[];
}

export interface MoveSlot {
  id: number;
  name: string;
  pp: number;
  maxPp: number;
  power: number;
  type: string;
}

export interface BagState {
  pokeball: number;
  greatball: number;
  ultraball: number;
  masterball: number;
}

export interface BattleState {
  wild: WildPokemon;
  player: PlayerPokemon;
  bag: BagState;
}

export interface BotState {
  status: BotStatus;
  targetName: string;
  encounterCount: number;
  battleState: BattleState | null;
  error: string | null;
}

export type BotAction =
  | { type: 'use_move'; moveIndex: number }
  | { type: 'throw_ball'; ballType: 'pokeball' | 'greatball' | 'ultraball' | 'masterball' };

export interface BotEngine {
  start(targetName: string): void;
  stop(): void;
  setAction(action: BotAction): void;
  getState(): BotState;
  destroy(): void;
}

export type Emulator = mGBAEmulator;
