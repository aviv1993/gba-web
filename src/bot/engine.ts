import type { BotAction, BotState, BotStatus, Emulator } from './types.ts';
import { MemoryReader } from './memory.ts';
import { getSpeciesId } from './pokemon-db.ts';
import {
  readBattleState,
  readWildPokemon,
  getBattleOutcome,
  getBattleFingerprint,
  getBallSlotIndex,
  BATTLE_OUTCOME_CAUGHT,
  BATTLE_OUTCOME_WON,
  BATTLE_OUTCOME_LOST,
  ADDR_SAVE_BLOCK_1,
  SB1_PARTY_COUNT,
} from './game-data.ts';
import { readGameState } from './game-state.ts';

/** Button press duration in ms */
const PRESS_DURATION = 80;
/** Delay between button presses in ms */
const PRESS_GAP = 100;
/** Tick interval in ms */
const TICK_INTERVAL = 100;
/** Max ticks to wait during battle entering before giving up */
const BATTLE_ENTER_WAIT = 60;
/** Min ticks to stay in BATTLE_ENTERING (B presses to dismiss all intro text) */
const BATTLE_ENTER_MIN = 20;
/** Ticks to wait after initial executeRun before first retry check */
const RUN_WAIT = 40;
/** Ticks between subsequent RUN re-navigation attempts */
const RUN_RETRY_INTERVAL = 20;
/** Frames to wait after executing an action */
const ACTION_WAIT = 60;
/** How often to refresh memory during walking (every N ticks) */
const WALK_REFRESH_INTERVAL = 10;
/** Number of B presses to dismiss lingering text before menu navigation */
const TEXT_DISMISS_COUNT = 3;
/** Ms to wait for battle menu animation to complete */
const MENU_READINESS_WAIT = 2500;
/** Max number of times to retry executeRun before giving up and resuming walk */
const RUN_MAX_RETRIES = 3;
/** Ms to wait for bag screen to open */
const BAG_OPEN_WAIT = 500;
/** Ms to wait between bag navigation steps */
const BAG_NAV_WAIT = 200;

export function createBotEngine(emulator: Emulator, setSpeedMultiplier: (speed: number) => void) {
  const memory = new MemoryReader(emulator);

  let status: BotStatus = 'IDLE';
  let targetName = '';
  let targetSpeciesId = 0;
  let encounterCount = 0;
  let lastEncounterName: string | null = null;
  let error: string | null = null;
  let pendingAction: BotAction | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let tickInProgress = false;
  let waitCounter = 0;
  let walkDirection: 'Up' | 'Down' = 'Up';
  let walkStep = 0;
  let previousSpeed = 1;
  let battleEnterRetries = 0;
  let runRetryCount = 0;
  /** Fingerprint of the last battle's gBattleMons data, used to detect NEW battles. */
  let lastBattleFingerprint: string | null = null;
  /** Whether this is the first time opening the bag in the current battle. */
  let firstBagOpenThisBattle = true;
  /** Party count before throwing a ball, used to detect catches. */
  let partyCountBeforeThrow = 0;

  function getState(): BotState {
    const battleState = (status === 'WAITING_FOR_DECISION' || status === 'EXECUTING_ACTION')
      ? readBattleState(memory, true)
      : null;
    // Hide masterball from exposed state so Claude never tries to use it
    if (battleState) {
      battleState.bag.masterball = 0;
    }
    return {
      status,
      targetName,
      encounterCount,
      lastEncounterName,
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

  /** Press a button N times sequentially. */
  async function pressButtonN(button: string, count: number) {
    for (let i = 0; i < count; i++) {
      await pressButton(button);
    }
  }

  function delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
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
    lastEncounterName = null;
    error = null;
    pendingAction = null;
    lastBattleFingerprint = null;
    firstBagOpenThisBattle = true;

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
    setSpeedMultiplier(4);

    setStatus('WALKING');
    tickTimer = setInterval(tick, TICK_INTERVAL);
  }

  function stop() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    setSpeedMultiplier(previousSpeed);
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

      // Primary detection: fingerprint change (catches battle entry even during transition)
      const fp = getBattleFingerprint(memory);
      const fingerprintChanged = fp !== lastBattleFingerprint;

      // Secondary detection: screen type from gMain.inBattle flag
      const gameState = readGameState(memory);
      const screenIsBattle = gameState.screen.type === 'battle';

      if (fingerprintChanged || screenIsBattle) {
        console.log(`[Bot] Battle detected (fingerprint=${fingerprintChanged}, screen=${screenIsBattle})`);
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
    // Press B periodically to advance battle intro text
    // ("Wild WURMPLE appeared!", "Go! MUDKIP!", etc.)
    // B advances text but does NOT select menu items, so it won't accidentally pick FIGHT
    if (battleEnterRetries % 3 === 0) {
      emulator.buttonPress('B');
      setTimeout(() => emulator.buttonUnpress('B'), PRESS_DURATION);
    }
    battleEnterRetries++;

    // Phase 1: Just press B, no save states. Save state operations can interfere
    // with the emulator's input processing, causing button presses to be dropped.
    // Let the game run uninterrupted while we dismiss intro text.
    if (battleEnterRetries < BATTLE_ENTER_MIN) {
      return;
    }

    // Phase 2: Refresh memory and identify the wild Pokemon
    await memory.refresh();
    const gameState = readGameState(memory);

    if (gameState.screen.type !== 'battle') {
      if (battleEnterRetries >= BATTLE_ENTER_WAIT) {
        console.log('[Bot] Battle transition timed out, resuming walk');
        lastBattleFingerprint = getBattleFingerprint(memory);
        setSpeedMultiplier(4);
        setStatus('WALKING');
      }
      return;
    }

    const wild = readWildPokemon(memory, true);
    if (!wild) {
      if (battleEnterRetries >= BATTLE_ENTER_WAIT) {
        console.log('[Bot] In battle but no valid wild data, resuming walk');
        lastBattleFingerprint = getBattleFingerprint(memory);
        setSpeedMultiplier(4);
        setStatus('WALKING');
      }
      return;
    }

    encounterCount++;
    lastEncounterName = `${wild.name} Lv.${wild.level}`;
    console.log(`[Bot] Encounter #${encounterCount}: ${wild.name} Lv.${wild.level}`);

    if (wild.species === targetSpeciesId) {
      console.log(`[Bot] Target ${targetName} found!`);
      firstBagOpenThisBattle = true;
      setStatus('WAITING_FOR_DECISION');
    } else {
      runRetryCount = 0;
      setStatus('RUNNING');
      await executeRun();
    }
  }

  async function executeRun() {
    // Dismiss any remaining text — B advances text but won't select menu items
    await pressButtonN('B', TEXT_DISMISS_COUNT);
    // Wait for battle menu to be fully visible and interactive
    await delay(MENU_READINESS_WAIT);

    // Battle menu: FIGHT BAG / POKEMON RUN
    // Navigate to RUN with redundant presses — clamped navigation makes
    // double-pressing harmless, but ensures the cursor reaches RUN even
    // if an individual press is dropped by the emulator
    await pressButtonN('Down', 3);
    await pressButtonN('Right', 3);
    await pressButton('A');

    waitCounter = RUN_WAIT;
  }

  async function tickRunning() {
    waitCounter--;

    // Press B periodically to dismiss text ("Got away safely!", "Can't escape!", etc.)
    if (waitCounter % 5 === 0) {
      emulator.buttonPress('B');
      setTimeout(() => emulator.buttonUnpress('B'), PRESS_DURATION);
    }

    // Check screen state every 5 ticks and when the wait timer expires
    if (waitCounter % 5 === 0 || waitCounter <= 0) {
      await memory.refresh();
      const gameState = readGameState(memory);

      if (gameState.screen.type === 'overworld') {
        lastBattleFingerprint = getBattleFingerprint(memory);
        console.log('[Bot] Run complete (overworld detected), resuming walk');
        await pressButtonN('B', TEXT_DISMISS_COUNT);
        setSpeedMultiplier(4);
        setStatus('WALKING');
        return;
      }

      // Still in battle and timer expired — re-navigate to RUN without the full menu wait
      // (handles "Can't escape!" by retrying quickly once the menu reappears)
      if (waitCounter <= 0) {
        if (runRetryCount >= RUN_MAX_RETRIES) {
          lastBattleFingerprint = getBattleFingerprint(memory);
          console.log('[Bot] Run max retries exceeded, resuming walk');
          await pressButtonN('B', TEXT_DISMISS_COUNT);
          setSpeedMultiplier(4);
          setStatus('WALKING');
          return;
        }
        runRetryCount++;
        console.log(`[Bot] Still in battle, re-navigating to RUN (attempt ${runRetryCount})`);
        await pressButtonN('Down', 3);
        await pressButtonN('Right', 3);
        await pressButton('A');
        waitCounter = RUN_RETRY_INTERVAL;
      }
    }
  }

  let waitingCheckCounter = 0;

  async function tickWaitingForDecision() {
    // Check for action from Claude Code via window global
    const w = window as Window & Record<string, unknown>;
    const windowAction = w.botAction as BotAction | null;
    if (windowAction) {
      pendingAction = windowAction;
      w.botAction = null;
    }

    // Periodically check for delayed catch detection even without a pending action
    // (tickExecutingAction may have timed out before the catch was registered)
    waitingCheckCounter++;
    if (!pendingAction) {
      if (waitingCheckCounter % 10 === 0) {
        await memory.refresh();
        const outcome = getBattleOutcome(memory);
        const currentPartyCount = memory.readU8(ADDR_SAVE_BLOCK_1 + SB1_PARTY_COUNT);
        const partyGrew = partyCountBeforeThrow > 0 && currentPartyCount > partyCountBeforeThrow;
        if (outcome === BATTLE_OUTCOME_CAUGHT || partyGrew) {
          console.log(`[Bot] Caught ${targetName}! (delayed detect: outcome=${outcome}, partyGrew=${partyGrew})`);
          setStatus('DONE');
          stop();
          return;
        }
      }
      return;
    }

    // Refresh and check if battle ended before executing action
    waitingCheckCounter = 0;
    await memory.refresh();
    const outcome = getBattleOutcome(memory);
    const currentPartyCount = memory.readU8(ADDR_SAVE_BLOCK_1 + SB1_PARTY_COUNT);
    const partyGrew = partyCountBeforeThrow > 0 && currentPartyCount > partyCountBeforeThrow;
    if (outcome === BATTLE_OUTCOME_CAUGHT || partyGrew) {
      console.log(`[Bot] Caught ${targetName}! (pre-action detect: outcome=${outcome}, partyGrew=${partyGrew})`);
      setStatus('DONE');
      stop();
      return;
    }

    const action = pendingAction;
    pendingAction = null;
    setStatus('EXECUTING_ACTION');
    await executeAction(action);
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
    // Dismiss any lingering text before navigating menu
    await pressButtonN('B', TEXT_DISMISS_COUNT);
    await delay(MENU_READINESS_WAIT);

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
    // Block Master Ball usage — reserved for special occasions
    if (ballType === 'masterball') {
      console.warn('[Bot] Master Ball usage blocked — staying in WAITING_FOR_DECISION');
      setStatus('WAITING_FOR_DECISION');
      return;
    }

    // Refresh memory to find ball position and record party count for catch detection
    await memory.refresh();
    partyCountBeforeThrow = memory.readU8(ADDR_SAVE_BLOCK_1 + SB1_PARTY_COUNT);
    const slotIndex = getBallSlotIndex(memory, ballType);
    if (slotIndex < 0) {
      error = `No ${ballType} found in bag`;
      setStatus('ERROR');
      stop();
      return;
    }
    console.log(`[Bot] Throwing ${ballType} (slot ${slotIndex})`);

    // Dismiss any lingering text and wait for menu readiness
    await pressButtonN('B', TEXT_DISMISS_COUNT);
    await delay(MENU_READINESS_WAIT);

    // Battle menu: FIGHT BAG / POKEMON RUN
    // Navigate to BAG (top-right) with clamped navigation
    await pressButtonN('Up', 2);
    await pressButtonN('Right', 2);
    await pressButton('A');

    await delay(BAG_OPEN_WAIT);

    // On first bag open this battle, cursor starts on Items pocket — press Right to reach Poke Balls
    // TODO: fix for bag pocket memory (circular navigation means we can't assume starting position)
    if (firstBagOpenThisBattle) {
      await pressButton('Right');
      await delay(BAG_NAV_WAIT);
      firstBagOpenThisBattle = false;
    }

    // Reset cursor to top of pocket list
    await pressButtonN('Up', 10);
    await delay(BAG_NAV_WAIT);

    // Navigate down to target ball slot
    for (let i = 0; i < slotIndex; i++) {
      await pressButton('Down');
    }

    await pressButton('A'); // Select the ball
    await delay(BAG_NAV_WAIT);
    await pressButton('A'); // Confirm "Use"
  }

  async function tickExecutingAction() {
    waitCounter--;

    // Phase 1 (first ~5s / 50 ticks): Pure wait, let animation play
    // Phase 2 (next ~3s / 30 ticks): Press B to dismiss result text
    const PHASE2_START = 20; // ticks remaining when phase 2 begins
    if (waitCounter > PHASE2_START) return;

    if (waitCounter > 0) {
      // Phase 2: press B every few ticks to dismiss text
      if (waitCounter % 5 === 0) {
        emulator.buttonPress('B');
        setTimeout(() => emulator.buttonUnpress('B'), PRESS_DURATION);

        // Check for catch/outcome periodically during phase 2 (every 10 ticks)
        if (waitCounter % 10 === 0) {
          await memory.refresh();
          const earlyOutcome = getBattleOutcome(memory);
          const earlyPartyCount = memory.readU8(ADDR_SAVE_BLOCK_1 + SB1_PARTY_COUNT);
          const earlyPartyGrew = partyCountBeforeThrow > 0 && earlyPartyCount > partyCountBeforeThrow;
          if (earlyOutcome === BATTLE_OUTCOME_CAUGHT || earlyPartyGrew) {
            console.log(`[Bot] Caught ${targetName}! (early detect: outcome=${earlyOutcome}, partyGrew=${earlyPartyGrew})`);
            setStatus('DONE');
            stop();
            return;
          }
        }
      }
      return;
    }

    // Timer expired — refresh and check what happened
    await memory.refresh();
    const outcome = getBattleOutcome(memory);

    // Detect catch via gBattleOutcome OR party count increase
    // (gBattleOutcome address may be wrong for EU ROM, party count is reliable)
    const currentPartyCount = memory.readU8(ADDR_SAVE_BLOCK_1 + SB1_PARTY_COUNT);
    const partyGrew = partyCountBeforeThrow > 0 && currentPartyCount > partyCountBeforeThrow;

    if (outcome === BATTLE_OUTCOME_CAUGHT || partyGrew) {
      console.log(`[Bot] Caught ${targetName}! (outcome=${outcome}, partyGrew=${partyGrew})`);
      setStatus('DONE');
      stop();
      return;
    }

    if (outcome === BATTLE_OUTCOME_WON) {
      console.log('[Bot] Wild Pokemon fainted, resuming walk');
      lastBattleFingerprint = getBattleFingerprint(memory);
      await pressButtonN('B', TEXT_DISMISS_COUNT);
      setSpeedMultiplier(4);
      setStatus('WALKING');
      return;
    }

    if (outcome === BATTLE_OUTCOME_LOST) {
      error = 'Player lost the battle';
      setStatus('ERROR');
      stop();
      return;
    }

    // Check if battle ended (back to overworld)
    const gameState = readGameState(memory);
    if (gameState.screen.type === 'overworld') {
      // On overworld after a ball throw with party grew — catch!
      if (partyGrew) {
        console.log(`[Bot] Caught ${targetName}! (detected via party count on overworld)`);
        setStatus('DONE');
        stop();
        return;
      }
      console.log('[Bot] Back to overworld after action, resuming walk');
      lastBattleFingerprint = getBattleFingerprint(memory);
      await pressButtonN('B', TEXT_DISMISS_COUNT);
      setSpeedMultiplier(4);
      setStatus('WALKING');
      return;
    }

    // Still in battle, no decisive outcome — dismiss remaining text and wait for next decision
    await pressButtonN('B', TEXT_DISMISS_COUNT);
    await delay(MENU_READINESS_WAIT);
    await memory.refresh();

    // One more party count check after the extra delay
    const finalPartyCount = memory.readU8(ADDR_SAVE_BLOCK_1 + SB1_PARTY_COUNT);
    if (partyCountBeforeThrow > 0 && finalPartyCount > partyCountBeforeThrow) {
      console.log(`[Bot] Caught ${targetName}! (detected via party count after delay)`);
      setStatus('DONE');
      stop();
      return;
    }

    setStatus('WAITING_FOR_DECISION');
  }

  return { start, stop, setAction, getState, destroy };
}
