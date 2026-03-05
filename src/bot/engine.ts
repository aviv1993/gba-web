import type { BotAction, BotMode, BotState, BotStatus, Emulator, TrainingState } from './types.ts';
import { MemoryReader } from './memory.ts';
import { getSpeciesId } from './pokemon-db.ts';
import {
  readBattleState,
  readWildPokemon,
  readPlayerPokemon,
  getBattleOutcome,
  getBattleFingerprint,
  getBallSlotIndex,
  BATTLE_OUTCOME_CAUGHT,
  BATTLE_OUTCOME_WON,
  BATTLE_OUTCOME_LOST,
  ADDR_SAVE_BLOCK_1,
  SB1_PARTY_COUNT,
  ADDR_CURRENT_BAG_POCKET,
  BAG_POCKET_BALLS,
  BAG_POCKET_COUNT,
} from './game-data.ts';
import { readGameState, readParty } from './game-state.ts';

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
/** KO'er HP threshold — pause if below this fraction of maxHP */
const KOER_HP_THRESHOLD = 0.2;
/** Ms to wait for party screen to open */
const PARTY_SCREEN_WAIT = 800;
/** Ms to wait for switch confirmation */
const SWITCH_CONFIRM_WAIT = 400;
/** Ticks to wait for switch animation */
const SWITCH_ANIM_WAIT = 60;
/** Ticks to wait for attack animation */
const ATTACK_ANIM_WAIT = 60;
/** Ms to wait for post-battle text */
const POST_BATTLE_TEXT_WAIT = 1500;
/** Ms to wait after post-battle text for level-up/evolution check */
const POST_BATTLE_CHECK_WAIT = 2000;

export function createBotEngine(emulator: Emulator, setSpeedMultiplier: (speed: number) => void) {
  const memory = new MemoryReader(emulator);

  let status: BotStatus = 'IDLE';
  let mode: BotMode = 'catch';
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
  /** Party count before throwing a ball, used to detect catches. */
  let partyCountBeforeThrow = 0;
  /** Training mode state. */
  let trainingState: TrainingState | null = null;
  /** Reason for PAUSED status. */
  let pauseReason: string | null = null;

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
      mode,
      targetName,
      encounterCount,
      lastEncounterName,
      battleState,
      error,
      trainingState,
      pauseReason,
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
        case 'SWITCHING':
          await tickSwitching();
          break;
        case 'ATTACKING':
          await tickAttacking();
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
        partyCountBeforeThrow = 0;
        waitingCheckCounter = 0;
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

    if (mode === 'train') {
      // Training mode: check KO'er HP, then switch
      const party = readParty(memory);
      const koer = party.find(p => p.slot === 1);
      if (!koer || koer.hp === 0) {
        error = "KO'er (slot 1) is fainted";
        setStatus('ERROR');
        stop();
        return;
      }
      if (koer.hp / koer.maxHp < KOER_HP_THRESHOLD) {
        pauseReason = `KO'er HP low (${koer.hp}/${koer.maxHp}) — heal before continuing`;
        console.log(`[Bot] ${pauseReason}`);
        setStatus('PAUSED');
        return;
      }
      setStatus('SWITCHING');
      await executeSwitch();
    } else if (wild.species === targetSpeciesId) {
      console.log(`[Bot] Target ${targetName} found!`);
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

  /** Check if the Pokemon was caught (via battle outcome or party count increase). */
  function checkCaught(): { caught: boolean; outcome: number; partyGrew: boolean } {
    const outcome = getBattleOutcome(memory);
    const currentPartyCount = memory.readU8(ADDR_SAVE_BLOCK_1 + SB1_PARTY_COUNT);
    const partyGrew = partyCountBeforeThrow > 0 && currentPartyCount > partyCountBeforeThrow;
    return { caught: outcome === BATTLE_OUTCOME_CAUGHT || partyGrew, outcome, partyGrew };
  }

  /** If caught, log, set DONE, stop, and return true. */
  function handleCaughtIfDetected(context: string): boolean {
    const { caught, outcome, partyGrew } = checkCaught();
    if (caught) {
      console.log(`[Bot] Caught ${targetName}! (${context}: outcome=${outcome}, partyGrew=${partyGrew})`);
      setStatus('DONE');
      stop();
    }
    return caught;
  }

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
        if (handleCaughtIfDetected('delayed detect')) return;
      }
      return;
    }

    // Refresh and check if battle ended before executing action
    waitingCheckCounter = 0;
    await memory.refresh();
    if (handleCaughtIfDetected('pre-action detect')) return;

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

  /** Navigate to the Poke Balls pocket from whatever pocket the bag is currently on.
   *  Caller must have called memory.refresh() before invoking this. */
  async function navigateToBagPocketBalls() {
    const currentPocket = memory.readU8(ADDR_CURRENT_BAG_POCKET);
    if (currentPocket === BAG_POCKET_BALLS) return;

    // Circular navigation: compute shortest path (Left or Right)
    const rightSteps = (BAG_POCKET_BALLS - currentPocket + BAG_POCKET_COUNT) % BAG_POCKET_COUNT;
    const leftSteps = (currentPocket - BAG_POCKET_BALLS + BAG_POCKET_COUNT) % BAG_POCKET_COUNT;
    const dir = rightSteps <= leftSteps ? 'Right' : 'Left';
    const steps = Math.min(rightSteps, leftSteps);
    console.log(`[Bot] Bag pocket ${currentPocket} → ${BAG_POCKET_BALLS}: ${dir} × ${steps}`);
    for (let i = 0; i < steps; i++) {
      await pressButton(dir);
      await delay(BAG_NAV_WAIT);
    }
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
    await navigateToBagPocketBalls();

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
          if (handleCaughtIfDetected('early detect')) return;
        }
      }
      return;
    }

    // Timer expired — refresh and check what happened
    await memory.refresh();
    if (handleCaughtIfDetected('timer expired')) return;

    const outcome = getBattleOutcome(memory);
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
      if (handleCaughtIfDetected('overworld detect')) return;
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

    // One more catch check after the extra delay
    if (handleCaughtIfDetected('post-delay detect')) return;

    setStatus('WAITING_FOR_DECISION');
  }

  async function startTraining(options: { targetLevel?: number }) {
    mode = 'train';
    targetName = '';
    targetSpeciesId = 0;
    encounterCount = 0;
    lastEncounterName = null;
    error = null;
    pendingAction = null;
    lastBattleFingerprint = null;
    pauseReason = null;

    const ok = await memory.init();
    if (!ok) {
      error = 'Failed to initialize memory reader. Make sure a ROM is loaded and running.';
      setStatus('ERROR');
      return;
    }

    await memory.refresh();

    const party = readParty(memory);
    if (party.length < 2) {
      error = 'Need at least 2 Pokemon in party (trainee slot 0, KO\'er slot 1)';
      setStatus('ERROR');
      return;
    }

    const trainee = party.find(p => p.slot === 0);
    const koer = party.find(p => p.slot === 1);
    if (!trainee) {
      error = 'No Pokemon in slot 0 (trainee)';
      setStatus('ERROR');
      return;
    }
    if (!koer || koer.hp === 0) {
      error = 'KO\'er (slot 1) is fainted or missing';
      setStatus('ERROR');
      return;
    }

    trainingState = {
      traineeSlot: 0,
      koerSlot: 1,
      startLevel: trainee.level,
      currentLevel: trainee.level,
      targetLevel: options.targetLevel ?? null,
      battlesWon: 0,
    };

    console.log(`[Bot] Training started: Lv.${trainee.level}${options.targetLevel ? ` → Lv.${options.targetLevel}` : ''}`);

    lastBattleFingerprint = getBattleFingerprint(memory);
    previousSpeed = emulator.getFastForwardMultiplier();
    setSpeedMultiplier(4);

    setStatus('WALKING');
    tickTimer = setInterval(tick, TICK_INTERVAL);
  }

  async function resumeTraining() {
    if (mode !== 'train' || status !== 'PAUSED') {
      console.warn('[Bot] resumeTraining called but not in PAUSED train mode');
      return;
    }

    await memory.refresh();
    const gameState = readGameState(memory);
    if (gameState.screen.type !== 'overworld') {
      console.warn('[Bot] Cannot resume — not on overworld. Handle the prompt first.');
      return;
    }

    // Re-read trainee level (may have changed due to evolution/level-up)
    const party = readParty(memory);
    const trainee = party.find(p => p.slot === 0);
    if (trainee && trainingState) {
      trainingState.currentLevel = trainee.level;
      console.log(`[Bot] Resumed training. Trainee level: ${trainee.level}`);

      if (trainingState.targetLevel && trainee.level >= trainingState.targetLevel) {
        console.log(`[Bot] Target level ${trainingState.targetLevel} reached!`);
        setStatus('DONE');
        stop();
        return;
      }
    }

    pauseReason = null;
    lastBattleFingerprint = getBattleFingerprint(memory);
    setSpeedMultiplier(4);
    setStatus('WALKING');
  }

  async function executeSwitch() {
    // Dismiss text + wait for menu
    await pressButtonN('B', TEXT_DISMISS_COUNT);
    await delay(MENU_READINESS_WAIT);

    // Battle menu: FIGHT BAG / POKEMON RUN
    // Navigate to POKEMON (bottom-left) with clamped nav
    await pressButtonN('Down', 3);
    await pressButtonN('Left', 3);
    await pressButton('A');

    await delay(PARTY_SCREEN_WAIT);

    // Party screen: slot 0 is selected by default (top-left)
    // Move right to slot 1
    await pressButton('Right');
    await pressButton('A'); // Select slot 1
    await delay(SWITCH_CONFIRM_WAIT);
    await pressButton('A'); // Confirm "SHIFT"

    waitCounter = SWITCH_ANIM_WAIT;
  }

  async function tickSwitching() {
    waitCounter--;

    // Press B to dismiss "Go! [Pokemon]!" text
    if (waitCounter > 0 && waitCounter % 5 === 0) {
      emulator.buttonPress('B');
      setTimeout(() => emulator.buttonUnpress('B'), PRESS_DURATION);
    }

    if (waitCounter > 0) return;

    await memory.refresh();
    const gameState = readGameState(memory);

    if (gameState.screen.type === 'overworld') {
      // Wild fled (Roar/Teleport/Whirlwind)
      console.log('[Bot] Wild fled during switch, resuming walk');
      lastBattleFingerprint = getBattleFingerprint(memory);
      setSpeedMultiplier(4);
      setStatus('WALKING');
      return;
    }

    // Switch complete — attack with KO'er
    setStatus('ATTACKING');
    await executeKoerAttack();
  }

  async function executeKoerAttack() {
    await memory.refresh();
    const player = readPlayerPokemon(memory, true);
    if (!player) {
      error = 'Cannot read active Pokemon data';
      setStatus('ERROR');
      stop();
      return;
    }

    const bestIdx = selectBestMove(player.moves);
    if (bestIdx < 0) {
      error = 'KO\'er has no usable moves (all out of PP or status-only)';
      setStatus('ERROR');
      stop();
      return;
    }

    console.log(`[Bot] Attacking with ${player.moves[bestIdx].name} (power ${player.moves[bestIdx].power})`);
    await executeMoveAction(bestIdx);
    waitCounter = ATTACK_ANIM_WAIT;
  }

  function selectBestMove(moves: { power: number; pp: number }[]): number {
    let bestIdx = -1;
    let bestPower = -1;
    for (let i = 0; i < moves.length; i++) {
      if (moves[i].pp > 0 && moves[i].power > bestPower) {
        bestPower = moves[i].power;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  async function tickAttacking() {
    waitCounter--;

    // Phase 2: press B to dismiss result text
    const PHASE2_START = 20;
    if (waitCounter > PHASE2_START) return;

    if (waitCounter > 0) {
      if (waitCounter % 5 === 0) {
        emulator.buttonPress('B');
        setTimeout(() => emulator.buttonUnpress('B'), PRESS_DURATION);
      }
      return;
    }

    // Timer expired — check outcome
    await memory.refresh();
    const outcome = getBattleOutcome(memory);
    const gameState = readGameState(memory);

    if (outcome === BATTLE_OUTCOME_LOST) {
      error = 'Player lost the battle';
      setStatus('ERROR');
      stop();
      return;
    }

    if (outcome === BATTLE_OUTCOME_WON || gameState.screen.type === 'overworld') {
      // Battle won — dismiss post-battle text carefully
      console.log('[Bot] Battle won, dismissing post-battle text');
      await pressButtonN('B', 3);
      await delay(POST_BATTLE_TEXT_WAIT);
      await pressButtonN('B', 2);
      await delay(POST_BATTLE_CHECK_WAIT);

      await memory.refresh();
      const postState = readGameState(memory);

      if (postState.screen.type === 'overworld') {
        // Clean exit — update training state
        await handleTrainingBattleWon();
      } else {
        // Something is blocking — evolution or move-learn prompt
        pauseReason = 'Level-up event detected — handle evolution/move prompt, then call window.resumeTraining()';
        console.log(`[Bot] ${pauseReason}`);
        setStatus('PAUSED');
      }
      return;
    }

    // Still in battle — check if KO'er fainted
    const player = readPlayerPokemon(memory, true);
    if (player && player.hp === 0) {
      error = 'KO\'er fainted during battle';
      setStatus('ERROR');
      stop();
      return;
    }

    // Multi-turn KO: dismiss text and attack again
    console.log('[Bot] Still in battle, attacking again');
    await pressButtonN('B', TEXT_DISMISS_COUNT);
    await delay(MENU_READINESS_WAIT);
    await executeKoerAttack();
  }

  async function handleTrainingBattleWon() {
    if (!trainingState) return;

    trainingState.battlesWon++;
    lastBattleFingerprint = getBattleFingerprint(memory);

    const party = readParty(memory);
    const trainee = party.find(p => p.slot === 0);
    if (trainee) {
      trainingState.currentLevel = trainee.level;
    }

    console.log(`[Bot] Battle won (#${trainingState.battlesWon}). Trainee level: ${trainingState.currentLevel}`);

    if (trainingState.targetLevel && trainingState.currentLevel >= trainingState.targetLevel) {
      console.log(`[Bot] Target level ${trainingState.targetLevel} reached!`);
      setStatus('DONE');
      stop();
      return;
    }

    setSpeedMultiplier(4);
    setStatus('WALKING');
  }

  async function getLocation(): Promise<{ mapName: string; x: number; y: number } | null> {
    const ok = await memory.init();
    if (!ok) return null;
    await memory.refresh();
    const gameState = readGameState(memory);
    return { mapName: gameState.location.mapName, x: gameState.location.x, y: gameState.location.y };
  }

  return { start, startTraining, resumeTraining, stop, setAction, getState, getLocation, destroy };
}
