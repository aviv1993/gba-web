import type { BotAction, BotState, BotStatus, Emulator } from './types.ts';
import { MemoryReader } from './memory.ts';
import { getSpeciesId } from './pokemon-db.ts';
import {
  isInBattle,
  readBattleState,
  readWildPokemon,
  getBattleOutcome,
  BATTLE_OUTCOME_CAUGHT,
  BATTLE_OUTCOME_RAN,
} from './game-data.ts';

/** Button press duration in ms */
const PRESS_DURATION = 80;
/** Delay between button presses in ms */
const PRESS_GAP = 100;
/** Tick interval in ms */
const TICK_INTERVAL = 100;
/** Frames to wait for battle transition */
const BATTLE_ENTER_WAIT = 60;
/** Frames to wait after running */
const RUN_WAIT = 40;
/** Frames to wait after executing an action */
const ACTION_WAIT = 60;

export function createBotEngine(emulator: Emulator) {
  const memory = new MemoryReader(emulator);

  let status: BotStatus = 'IDLE';
  let targetName = '';
  let targetSpeciesId = 0;
  let encounterCount = 0;
  let error: string | null = null;
  let pendingAction: BotAction | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let waitCounter = 0;
  let walkDirection: 'Up' | 'Down' = 'Up';
  let walkStep = 0;
  let previousSpeed = 1;

  function getState(): BotState {
    const battleState = (status === 'WAITING_FOR_DECISION' || status === 'EXECUTING_ACTION')
      ? readBattleState(memory)
      : null;
    return {
      status,
      targetName,
      encounterCount,
      battleState,
      error,
    };
  }

  function setStatus(s: BotStatus) {
    status = s;
    updateDOM();
  }

  function updateDOM() {
    const state = getState();
    const w = window as Window & Record<string, unknown>;
    w.botStatus = state.status;
    w.botState = state;
    // Dispatch custom event for React to pick up
    window.dispatchEvent(new CustomEvent('bot-state-change', { detail: state }));
  }

  /** Press a button for a short duration, then release. */
  function pressButton(button: string): Promise<void> {
    return new Promise(resolve => {
      emulator.buttonPress(button);
      setTimeout(() => {
        emulator.buttonUnpress(button);
        setTimeout(resolve, PRESS_GAP);
      }, PRESS_DURATION);
    });
  }

  async function start(name: string) {
    const speciesId = getSpeciesId(name);
    if (!speciesId) {
      error = `Unknown Pokemon: ${name}`;
      setStatus('ERROR');
      return;
    }

    targetName = name;
    targetSpeciesId = speciesId;
    encounterCount = 0;
    error = null;
    pendingAction = null;

    // Initialize memory reader
    const ok = await memory.init();
    if (!ok) {
      error = 'Failed to initialize memory reader. Make sure a ROM is loaded and running.';
      setStatus('ERROR');
      return;
    }

    // Save current speed and enable fast forward
    previousSpeed = emulator.getFastForwardMultiplier();
    emulator.setFastForwardMultiplier(4);

    setStatus('WALKING');
    tickTimer = setInterval(tick, TICK_INTERVAL);
  }

  function stop() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    // Restore speed
    emulator.setFastForwardMultiplier(previousSpeed);
    if (status !== 'DONE' && status !== 'ERROR') {
      setStatus('IDLE');
    }
  }

  function setAction(action: BotAction) {
    if (status === 'WAITING_FOR_DECISION') {
      pendingAction = action;
      const w = window as Window & Record<string, unknown>;
      w.botAction = null;
    }
  }

  function destroy() {
    stop();
    const w = window as Window & Record<string, unknown>;
    w.botStatus = undefined;
    w.botState = undefined;
    w.botAction = undefined;
  }

  function tick() {
    try {
      switch (status) {
        case 'WALKING':
          tickWalking();
          break;
        case 'BATTLE_ENTERING':
          tickBattleEntering();
          break;
        case 'RUNNING':
          tickRunning();
          break;
        case 'WAITING_FOR_DECISION':
          tickWaitingForDecision();
          break;
        case 'EXECUTING_ACTION':
          tickExecutingAction();
          break;
      }
    } catch (err) {
      console.error('[Bot] Tick error:', err);
      error = err instanceof Error ? err.message : String(err);
      setStatus('ERROR');
      stop();
    }
  }

  function tickWalking() {
    // Check if we stumbled into a battle
    if (isInBattle(memory)) {
      // Disable fast forward for battle
      emulator.setFastForwardMultiplier(1);
      waitCounter = BATTLE_ENTER_WAIT;
      setStatus('BATTLE_ENTERING');
      return;
    }

    // Walk back and forth on grass
    walkStep++;
    if (walkStep % 8 === 0) {
      walkDirection = walkDirection === 'Up' ? 'Down' : 'Up';
    }
    // Press the direction button (non-blocking — we just tap it each tick)
    emulator.buttonPress(walkDirection);
    setTimeout(() => emulator.buttonUnpress(walkDirection), PRESS_DURATION);
  }

  function tickBattleEntering() {
    waitCounter--;
    if (waitCounter > 0) return;

    // Battle should be loaded now — read wild Pokemon
    const wild = readWildPokemon(memory);
    if (!wild) {
      // Battle might not be fully loaded yet, wait more
      waitCounter = 20;
      return;
    }

    encounterCount++;
    console.log(`[Bot] Encounter #${encounterCount}: ${wild.name} Lv.${wild.level}`);

    if (wild.species === targetSpeciesId) {
      // Target found!
      console.log(`[Bot] Target ${targetName} found!`);
      setStatus('WAITING_FOR_DECISION');
    } else {
      // Wrong Pokemon — run away
      setStatus('RUNNING');
      executeRun();
    }
  }

  async function executeRun() {
    // In Pokemon battle menu: Fight/Bag/Pokemon/Run
    // Run is bottom-right (Down, Right, then A)
    // First press B to close any text, then navigate to Run
    await pressButton('B');
    await pressButton('Down');
    await pressButton('Right');
    await pressButton('A');

    // Wait for run to complete
    waitCounter = RUN_WAIT;
  }

  function tickRunning() {
    waitCounter--;
    if (waitCounter > 0) return;

    // Check if we exited battle
    if (!isInBattle(memory)) {
      // Re-enable fast forward for walking
      emulator.setFastForwardMultiplier(4);
      setStatus('WALKING');
    } else {
      // Still in battle, might need to press A through text
      emulator.buttonPress('A');
      setTimeout(() => emulator.buttonUnpress('A'), PRESS_DURATION);
      waitCounter = 10;
    }
  }

  function tickWaitingForDecision() {
    // Check for action from Claude Code via window global
    const w = window as Window & Record<string, unknown>;
    const windowAction = w.botAction as BotAction | null;
    if (windowAction) {
      pendingAction = windowAction;
      w.botAction = null;
    }

    if (!pendingAction) return;

    // Check if battle ended (maybe wild Pokemon fainted)
    const outcome = getBattleOutcome(memory);
    if (outcome === BATTLE_OUTCOME_CAUGHT) {
      console.log(`[Bot] Caught ${targetName}!`);
      setStatus('DONE');
      stop();
      return;
    }

    const action = pendingAction;
    pendingAction = null;
    setStatus('EXECUTING_ACTION');
    executeAction(action);
  }

  async function executeAction(action: BotAction) {
    if (action.type === 'use_move') {
      await executeMoveAction(action.moveIndex);
    } else if (action.type === 'throw_ball') {
      await executeThrowBall(action.ballType);
    }

    // Wait for the action to resolve
    waitCounter = ACTION_WAIT;
  }

  async function executeMoveAction(moveIndex: number) {
    // Navigate to Fight menu and select move
    // Battle menu: Fight is top-left (default position)
    await pressButton('A'); // Select Fight

    // Navigate to correct move slot (0-3)
    // Moves are in a 2x2 grid: [0,1] / [2,3]
    if (moveIndex === 1) {
      await pressButton('Right');
    } else if (moveIndex === 2) {
      await pressButton('Down');
    } else if (moveIndex === 3) {
      await pressButton('Down');
      await pressButton('Right');
    }

    await pressButton('A'); // Select the move
  }

  async function executeThrowBall(ballType: string) {
    console.log(`[Bot] Throwing ${ballType}`);

    // Navigate to Bag from battle menu
    // Bag is top-right: Right from default, then A
    await pressButton('Right');
    await pressButton('A'); // Open Bag

    // Small wait for bag to open
    await new Promise(r => setTimeout(r, 500));

    // In the bag, we need to navigate to the Balls pocket
    // and select the right ball. The balls pocket navigation
    // depends on the current pocket. We'll use Left/Right to
    // switch pockets to the Balls pocket, then select.

    // Press Left to navigate to Poke Balls pocket
    // (from the default Items pocket, Balls is one to the right)
    await pressButton('Right');
    await new Promise(r => setTimeout(r, 200));

    // Now navigate within the pocket to find our ball
    // For simplicity, select the first ball visible (most common approach)
    // The ball at the top of the list is usually the one we want
    // In practice, the player should have organized balls appropriately
    await pressButton('A'); // Select the ball
    await new Promise(r => setTimeout(r, 200));
    await pressButton('A'); // Confirm "Use" option
  }

  function tickExecutingAction() {
    waitCounter--;
    if (waitCounter > 0) return;

    // Check battle outcome
    const outcome = getBattleOutcome(memory);
    if (outcome === BATTLE_OUTCOME_CAUGHT) {
      console.log(`[Bot] Caught ${targetName}!`);
      setStatus('DONE');
      stop();
      return;
    }
    if (outcome === BATTLE_OUTCOME_RAN || !isInBattle(memory)) {
      // Wild Pokemon fled or battle ended unexpectedly
      console.log('[Bot] Battle ended unexpectedly, resuming walk');
      emulator.setFastForwardMultiplier(4);
      setStatus('WALKING');
      return;
    }

    // Battle still going — wait for next decision
    // Press A/B a few times to advance any text
    emulator.buttonPress('A');
    setTimeout(() => {
      emulator.buttonUnpress('A');
      setStatus('WAITING_FOR_DECISION');
    }, PRESS_DURATION);
  }

  return { start, stop, setAction, getState, destroy };
}
