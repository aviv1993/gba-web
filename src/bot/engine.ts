import type { BotAction, BotState, BotStatus, Emulator } from './types.ts';
import { MemoryReader } from './memory.ts';
import { getSpeciesId } from './pokemon-db.ts';
import {
  readBattleState,
  readWildPokemon,
  getBattleOutcome,
  getBattleFingerprint,
  BATTLE_OUTCOME_CAUGHT,
} from './game-data.ts';

/** Button press duration in ms */
const PRESS_DURATION = 80;
/** Delay between button presses in ms */
const PRESS_GAP = 100;
/** Tick interval in ms */
const TICK_INTERVAL = 100;
/** Ticks to wait for battle transition */
const BATTLE_ENTER_WAIT = 60;
/** Max ticks to wait for battle data before assuming false positive */
const BATTLE_ENTER_MAX_RETRIES = 5;
/** Ticks to wait after running (press A through text) */
const RUN_WAIT = 40;
/** Extra ticks to press through post-run text */
const POST_RUN_DISMISS = 20;
/** Frames to wait after executing an action */
const ACTION_WAIT = 60;
/** How often to refresh memory during walking (every N ticks) */
const WALK_REFRESH_INTERVAL = 10;

export function createBotEngine(emulator: Emulator) {
  const memory = new MemoryReader(emulator);

  let status: BotStatus = 'IDLE';
  let targetName = '';
  let targetSpeciesId = 0;
  let encounterCount = 0;
  let error: string | null = null;
  let pendingAction: BotAction | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let tickInProgress = false;
  let waitCounter = 0;
  let walkDirection: 'Up' | 'Down' = 'Up';
  let walkStep = 0;
  let previousSpeed = 1;
  let battleEnterRetries = 0;
  /** Fingerprint of the last battle's gBattleMons data, used to detect NEW battles. */
  let lastBattleFingerprint: string | null = null;

  function getState(): BotState {
    const battleState = (status === 'WAITING_FOR_DECISION' || status === 'EXECUTING_ACTION')
      ? readBattleState(memory, true)
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
    lastBattleFingerprint = null;

    const ok = await memory.init();
    if (!ok) {
      error = 'Failed to initialize memory reader. Make sure a ROM is loaded and running.';
      setStatus('ERROR');
      return;
    }

    // Take initial snapshot so we can detect changes (stale battle data from previous encounters)
    await memory.refresh();
    lastBattleFingerprint = getBattleFingerprint(memory);

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

  async function tick() {
    // Re-entry guard: save state + decompress is async, prevent overlapping ticks
    if (tickInProgress) return;
    tickInProgress = true;

    try {
      switch (status) {
        case 'WALKING':
          await tickWalking();
          break;
        case 'BATTLE_ENTERING':
          await tickBattleEntering();
          break;
        case 'RUNNING':
          await tickRunning();
          break;
        case 'WAITING_FOR_DECISION':
          await tickWaitingForDecision();
          break;
        case 'EXECUTING_ACTION':
          await tickExecutingAction();
          break;
      }
    } catch (err) {
      console.error('[Bot] Tick error:', err);
      error = err instanceof Error ? err.message : String(err);
      setStatus('ERROR');
      stop();
    } finally {
      tickInProgress = false;
    }
  }

  async function tickWalking() {
    // Periodically refresh memory to detect battle entry
    walkStep++;
    if (walkStep % WALK_REFRESH_INTERVAL === 0) {
      await memory.refresh();
      const fp = getBattleFingerprint(memory);
      // Detect NEW battle: fingerprint changed from last known state
      if (fp !== lastBattleFingerprint) {
        console.log('[Bot] Battle detected, entering...');
        emulator.setFastForwardMultiplier(1);
        waitCounter = BATTLE_ENTER_WAIT;
        battleEnterRetries = 0;
        setStatus('BATTLE_ENTERING');
        return;
      }
    }

    // Walk back and forth on grass — only directional buttons, never A
    if (walkStep % 8 === 0) {
      walkDirection = walkDirection === 'Up' ? 'Down' : 'Up';
    }
    emulator.buttonPress(walkDirection);
    setTimeout(() => emulator.buttonUnpress(walkDirection), PRESS_DURATION);
  }

  async function tickBattleEntering() {
    waitCounter--;

    // Press B periodically to advance battle intro text
    // ("Wild WURMPLE appeared!", "Go! MUDKIP!", etc.)
    // B advances text but does NOT select menu items, so it won't accidentally pick FIGHT
    if (waitCounter > 0 && waitCounter % 5 === 0) {
      emulator.buttonPress('B');
      setTimeout(() => emulator.buttonUnpress('B'), PRESS_DURATION);
    }

    if (waitCounter > 0) return;

    // Refresh memory and read wild Pokemon
    await memory.refresh();
    const wild = readWildPokemon(memory, true);
    if (!wild) {
      battleEnterRetries++;
      if (battleEnterRetries >= BATTLE_ENTER_MAX_RETRIES) {
        console.log('[Bot] False battle detection, resuming walk');
        lastBattleFingerprint = getBattleFingerprint(memory);
        emulator.setFastForwardMultiplier(4);
        setStatus('WALKING');
        return;
      }
      waitCounter = 20;
      return;
    }

    encounterCount++;
    console.log(`[Bot] Encounter #${encounterCount}: ${wild.name} Lv.${wild.level}`);

    if (wild.species === targetSpeciesId) {
      console.log(`[Bot] Target ${targetName} found!`);
      setStatus('WAITING_FOR_DECISION');
    } else {
      setStatus('RUNNING');
      await executeRun();
    }
  }

  async function executeRun() {
    // Dismiss any remaining text — B advances text but won't select menu items
    for (let i = 0; i < 3; i++) {
      await pressButton('B');
    }
    // Wait for battle menu to be fully visible and interactive
    await new Promise(r => setTimeout(r, 500));

    // Battle menu: FIGHT BAG / POKEMON RUN
    // Down+Right reaches RUN from any cursor position (Gen 3 uses clamped navigation)
    await pressButton('Down');
    await pressButton('Right');
    await pressButton('A');

    waitCounter = RUN_WAIT;
  }

  async function tickRunning() {
    waitCounter--;

    // Press A/B periodically to dismiss text
    if (waitCounter > 0 && waitCounter % 5 === 0) {
      emulator.buttonPress('A');
      setTimeout(() => emulator.buttonUnpress('A'), PRESS_DURATION);
    }

    if (waitCounter > 0) return;

    // Timeout expired — assume battle ended. Record fingerprint and resume walking.
    await memory.refresh();
    lastBattleFingerprint = getBattleFingerprint(memory);
    console.log('[Bot] Run complete, resuming walk');

    // Press A a few more times to dismiss any remaining text
    for (let i = 0; i < 3; i++) {
      await pressButton('A');
    }

    emulator.setFastForwardMultiplier(4);
    setStatus('WALKING');
  }

  async function tickWaitingForDecision() {
    // Check for action from Claude Code via window global
    const w = window as Window & Record<string, unknown>;
    const windowAction = w.botAction as BotAction | null;
    if (windowAction) {
      pendingAction = windowAction;
      w.botAction = null;
    }

    if (!pendingAction) return;

    // Refresh and check if battle ended
    await memory.refresh();
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

    waitCounter = ACTION_WAIT;
  }

  async function executeMoveAction(moveIndex: number) {
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
    await pressButton('Right');
    await pressButton('A'); // Open Bag

    await new Promise(r => setTimeout(r, 500));

    // Navigate to Poke Balls pocket (one right from Items)
    await pressButton('Right');
    await new Promise(r => setTimeout(r, 200));

    await pressButton('A'); // Select the ball
    await new Promise(r => setTimeout(r, 200));
    await pressButton('A'); // Confirm "Use" option
  }

  async function tickExecutingAction() {
    waitCounter--;
    if (waitCounter > 0) return;

    // Refresh and check battle outcome
    await memory.refresh();
    const outcome = getBattleOutcome(memory);
    if (outcome === BATTLE_OUTCOME_CAUGHT) {
      console.log(`[Bot] Caught ${targetName}!`);
      setStatus('DONE');
      stop();
      return;
    }

    // Battle still going — advance text and wait for next decision
    emulator.buttonPress('A');
    setTimeout(() => {
      emulator.buttonUnpress('A');
      setStatus('WAITING_FOR_DECISION');
    }, PRESS_DURATION);
  }

  return { start, stop, setAction, getState, destroy };
}
