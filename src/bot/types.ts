import type { mGBAEmulator } from '../core/use-emulator.ts';

export type BotMode = 'catch' | 'train';

export type BotStatus =
  | 'IDLE'
  | 'WALKING'
  | 'BATTLE_ENTERING'
  | 'RUNNING'
  | 'WAITING_FOR_DECISION'
  | 'EXECUTING_ACTION'
  | 'SWITCHING'
  | 'ATTACKING'
  | 'PAUSED'
  | 'DONE'
  | 'ERROR';

export interface TrainingState {
  traineeSlot: number;
  koerSlot: number;
  startLevel: number;
  currentLevel: number;
  targetLevel: number | null;
  battlesWon: number;
}

export interface WildPokemon {
  species: number;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  status: string;
  catchRate: number;
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
  mode: BotMode;
  targetName: string;
  encounterCount: number;
  lastEncounterName: string | null;
  battleState: BattleState | null;
  error: string | null;
  trainingState: TrainingState | null;
  pauseReason: string | null;
}

export type BotAction =
  | { type: 'use_move'; moveIndex: number }
  | { type: 'throw_ball'; ballType: 'pokeball' | 'greatball' | 'ultraball' };

// --- Game State Model ---

export type Screen =
  | { type: 'overworld' }
  | { type: 'battle' }
  | { type: 'unknown'; callback2: number };

export interface Location {
  mapGroup: number;
  mapNum: number;
  mapName: string;
  x: number;
  y: number;
}

export interface PartyOverview {
  slot: number;
  level: number;
  hp: number;
  maxHp: number;
  status: string;
}

export interface BagSlot {
  itemId: number;
  quantity: number;
}

export interface FullBag {
  items: BagSlot[];
  keyItems: BagSlot[];
  balls: BagSlot[];
  tms: BagSlot[];
  berries: BagSlot[];
}

export interface GameState {
  screen: Screen;
  location: Location;
  party: PartyOverview[];
  bag: FullBag;
  money: number;
  battle: BattleState | null;
}

export interface BotEngine {
  start(targetName: string): void;
  startTraining(options: { targetLevel?: number }): void;
  resumeTraining(): void;
  stop(): void;
  setAction(action: BotAction): void;
  getState(): BotState;
  destroy(): void;
}

export type Emulator = mGBAEmulator;
