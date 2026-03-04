import type { MemoryReader } from './memory.ts';
import type { BagState, BattleState, MoveSlot, PlayerPokemon, WildPokemon } from './types.ts';
import { getCatchRate, getSpeciesName, internalToNational } from './pokemon-db.ts';

/**
 * Pokemon Ruby/Sapphire memory addresses.
 * Source: pret/pokeruby symbol map (https://github.com/pret/pokeruby/tree/symbols)
 *
 * These addresses are from the decompilation project and apply to
 * both US and EU versions of Ruby/Sapphire.
 */

// --- EWRAM addresses ---

// gBattleMons — array of BattlePokemon structs (58h bytes each)
// Index 0 = player's active Pokemon, Index 1 = enemy/wild Pokemon
const ADDR_BATTLE_MONS = 0x02024A80;
const BATTLE_MON_SIZE = 0x58; // sizeof(struct BattlePokemon)

// BattlePokemon struct offsets (from pret/pokeruby include/pokemon.h)
const BATTLE_MON_SPECIES = 0x00;       // u16 — internal species ID
// Stats at 0x02-0x0A (attack, defense, speed, sp.atk, sp.def)
const BATTLE_MON_MOVE1 = 0x0C;         // u16
const BATTLE_MON_MOVE2 = 0x0E;         // u16
const BATTLE_MON_MOVE3 = 0x10;         // u16
const BATTLE_MON_MOVE4 = 0x12;         // u16
const BATTLE_MON_PP1 = 0x24;           // u8
const BATTLE_MON_PP2 = 0x25;           // u8
const BATTLE_MON_PP3 = 0x26;           // u8
const BATTLE_MON_PP4 = 0x27;           // u8
const BATTLE_MON_HP = 0x28;            // u16
const BATTLE_MON_LEVEL = 0x2A;         // u8
const BATTLE_MON_MAX_HP = 0x2C;        // u16
const BATTLE_MON_STATUS = 0x4C;        // u32 — status1 condition flags

// gSaveBlock1 — main save data structure
// EU ROM address, empirically validated. US ROM uses 0x02023A60.
export const ADDR_SAVE_BLOCK_1 = 0x02025734;

// SaveBlock1 field offsets
export const SB1_POS = 0x00;              // Coords16: s16 x, s16 y
export const SB1_LOCATION = 0x04;         // WarpData: s8 mapGroup, s8 mapNum, s8 warpId, s16 x, s16 y
export const SB1_PARTY_COUNT = 0x234;     // u8 — number of Pokemon in party (0-6)
export const SB1_PARTY = 0x238;           // Pokemon[6] — 100 bytes each
export const SB1_MONEY = 0x490;           // u32
// Bag pockets (ItemSlot = u16 itemId + u16 quantity = 4 bytes each)
export const SB1_BAG_ITEMS = 0x560;       // 20 slots
export const SB1_BAG_KEY_ITEMS = 0x5B0;   // 20 slots
export const SB1_BAG_BALLS = 0x600;       // 16 slots (only ~16 ball types exist)
export const SB1_BAG_TMS = 0x740;         // 64 slots
export const SB1_BAG_BERRIES = 0x840;     // 43 slots

// Bag pocket sizes (number of item slots)
export const BAG_ITEMS_SIZE = 20;
export const BAG_KEY_ITEMS_SIZE = 20;
export const BAG_BALLS_SIZE = 16;
export const BAG_TMS_SIZE = 64;
export const BAG_BERRIES_SIZE = 43;

// Party Pokemon struct offsets (within 100-byte struct)
// First 80 bytes (BoxPokemon) contains encrypted data — species, moves, items
// Bytes 0x50+ are unencrypted calculated stats
export const PARTY_MON_SIZE = 100;
export const PARTY_MON_STATUS = 0x50;     // u32 — status condition flags
export const PARTY_MON_LEVEL = 0x54;      // u8
export const PARTY_MON_HP = 0x56;         // u16
export const PARTY_MON_MAX_HP = 0x58;     // u16

// --- IWRAM addresses ---

// gMain struct — main game loop state (EU ROM, empirically validated)
// Note: gMain.inBattle flag address is unknown for EU ROM; use callback2 comparison instead
export const ADDR_GMAIN_CALLBACK2 = 0x03001774; // u32, function pointer to current screen handler

// Legacy aliases
const ADDR_BAG_BALLS_POCKET = ADDR_SAVE_BLOCK_1 + SB1_BAG_BALLS;
const BAG_BALLS_POCKET_SIZE = BAG_BALLS_SIZE;

// Item IDs for Pokeballs
export const ITEM_POKEBALL = 4;
export const ITEM_GREATBALL = 3;
export const ITEM_ULTRABALL = 2;
export const ITEM_MASTERBALL = 1;

// gBattleOutcome
const ADDR_BATTLE_OUTCOME = 0x02024D26;

// Battle outcome values
export const BATTLE_OUTCOME_WON = 1;
export const BATTLE_OUTCOME_LOST = 2;
export const BATTLE_OUTCOME_RAN = 4;
export const BATTLE_OUTCOME_CAUGHT = 7;

/** Status condition masks */
const STATUS_NONE = 0;
const STATUS_SLEEP_MASK = 0x07;
const STATUS_POISON = 0x08;
const STATUS_BURN = 0x10;
const STATUS_FREEZE = 0x20;
const STATUS_PARALYSIS = 0x40;
const STATUS_TOXIC = 0x80;

function decodeStatus(statusBits: number): string {
  if (statusBits === STATUS_NONE) return 'none';
  if (statusBits & STATUS_SLEEP_MASK) return 'sleep';
  if (statusBits & STATUS_POISON) return 'poison';
  if (statusBits & STATUS_BURN) return 'burn';
  if (statusBits & STATUS_FREEZE) return 'freeze';
  if (statusBits & STATUS_PARALYSIS) return 'paralysis';
  if (statusBits & STATUS_TOXIC) return 'toxic';
  return 'unknown';
}

/** Max valid internal species ID in Gen 3. */
const MAX_SPECIES_ID = 440;

/**
 * Check if currently in a battle by validating gBattleMons structs.
 * Uses species-based detection (both player and enemy must have valid species)
 * instead of gBattleTypeFlags, which is at a different address in EU ROMs.
 */
export function isInBattle(mem: MemoryReader): boolean {
  // Validate player battle mon
  const playerBase = ADDR_BATTLE_MONS;
  const playerSpecies = mem.readU16(playerBase + BATTLE_MON_SPECIES);
  if (playerSpecies === 0 || playerSpecies > MAX_SPECIES_ID) return false;
  const playerMaxHp = mem.readU16(playerBase + BATTLE_MON_MAX_HP);
  if (playerMaxHp < 5 || playerMaxHp > 999) return false;

  // Validate enemy battle mon
  const enemyBase = ADDR_BATTLE_MONS + BATTLE_MON_SIZE;
  const enemySpecies = mem.readU16(enemyBase + BATTLE_MON_SPECIES);
  if (enemySpecies === 0 || enemySpecies > MAX_SPECIES_ID) return false;
  const enemyMaxHp = mem.readU16(enemyBase + BATTLE_MON_MAX_HP);
  if (enemyMaxHp < 5 || enemyMaxHp > 999) return false;

  // Both need valid levels
  const playerLevel = mem.readU8(playerBase + BATTLE_MON_LEVEL);
  if (playerLevel < 1 || playerLevel > 100) return false;
  const enemyLevel = mem.readU8(enemyBase + BATTLE_MON_LEVEL);
  if (enemyLevel < 1 || enemyLevel > 100) return false;

  return true;
}

/**
 * Return a fingerprint of the current gBattleMons data.
 * Used to detect when a NEW battle starts — gBattleMons persists in EWRAM
 * after battles end (game doesn't zero it), so we compare fingerprints
 * rather than just checking if data is present.
 */
export function getBattleFingerprint(mem: MemoryReader): string {
  const enemyBase = ADDR_BATTLE_MONS + BATTLE_MON_SIZE;
  const species = mem.readU16(enemyBase + BATTLE_MON_SPECIES);
  const level = mem.readU8(enemyBase + BATTLE_MON_LEVEL);
  const hp = mem.readU16(enemyBase + BATTLE_MON_HP);
  const maxHp = mem.readU16(enemyBase + BATTLE_MON_MAX_HP);
  const move1 = mem.readU16(enemyBase + BATTLE_MON_MOVE1);
  // Include player HP too (changes between encounters)
  const playerHp = mem.readU16(ADDR_BATTLE_MONS + BATTLE_MON_HP);
  return `${species}:${level}:${hp}:${maxHp}:${move1}:${playerHp}`;
}

/** Get the battle outcome (0 = ongoing). */
export function getBattleOutcome(mem: MemoryReader): number {
  return mem.readU8(ADDR_BATTLE_OUTCOME);
}

/** Read wild/enemy Pokemon battle data. */
export function readWildPokemon(mem: MemoryReader, skipBattleCheck = false): WildPokemon | null {
  if (!skipBattleCheck && !isInBattle(mem)) return null;

  const base = ADDR_BATTLE_MONS + BATTLE_MON_SIZE; // index 1 = enemy
  const internalSpecies = mem.readU16(base + BATTLE_MON_SPECIES);
  if (internalSpecies === 0 || internalSpecies > MAX_SPECIES_ID) return null;

  const level = mem.readU8(base + BATTLE_MON_LEVEL);
  if (level === 0 || level > 100) return null;

  const maxHp = mem.readU16(base + BATTLE_MON_MAX_HP);
  if (maxHp === 0 || maxHp > 999) return null;

  const nationalId = internalToNational(internalSpecies);
  const name = getSpeciesName(nationalId) ?? `#${nationalId}`;

  return {
    species: nationalId,
    name,
    level,
    hp: mem.readU16(base + BATTLE_MON_HP),
    maxHp,
    status: decodeStatus(mem.readU32(base + BATTLE_MON_STATUS)),
    catchRate: getCatchRate(nationalId),
  };
}

/** Read player's active Pokemon battle data. */
export function readPlayerPokemon(mem: MemoryReader, skipBattleCheck = false): PlayerPokemon | null {
  if (!skipBattleCheck && !isInBattle(mem)) return null;

  const base = ADDR_BATTLE_MONS; // index 0 = player
  const internalSpecies = mem.readU16(base + BATTLE_MON_SPECIES);
  if (internalSpecies === 0) return null;

  const nationalId = internalToNational(internalSpecies);
  const name = getSpeciesName(nationalId) ?? `#${nationalId}`;

  const moveOffsets = [BATTLE_MON_MOVE1, BATTLE_MON_MOVE2, BATTLE_MON_MOVE3, BATTLE_MON_MOVE4];
  const ppOffsets = [BATTLE_MON_PP1, BATTLE_MON_PP2, BATTLE_MON_PP3, BATTLE_MON_PP4];

  const moves: MoveSlot[] = [];
  for (let i = 0; i < 4; i++) {
    const moveId = mem.readU16(base + moveOffsets[i]);
    if (moveId === 0) continue;
    const move = MOVE_DB[moveId];
    moves.push({
      id: moveId,
      name: move?.name ?? `Move #${moveId}`,
      pp: mem.readU8(base + ppOffsets[i]),
      maxPp: move?.pp ?? 0,
      power: move?.power ?? 0,
      type: move?.type ?? 'Normal',
    });
  }

  return {
    species: nationalId,
    name,
    level: mem.readU8(base + BATTLE_MON_LEVEL),
    hp: mem.readU16(base + BATTLE_MON_HP),
    maxHp: mem.readU16(base + BATTLE_MON_MAX_HP),
    moves,
  };
}

/** Read Pokeball counts from bag. */
export function readBag(mem: MemoryReader): BagState {
  const bag: BagState = { pokeball: 0, greatball: 0, ultraball: 0, masterball: 0 };

  for (let i = 0; i < BAG_BALLS_POCKET_SIZE; i++) {
    const addr = ADDR_BAG_BALLS_POCKET + i * 4;
    const itemId = mem.readU16(addr);
    const quantity = mem.readU16(addr + 2);
    if (itemId === 0) break;

    if (itemId === ITEM_POKEBALL) bag.pokeball = quantity;
    else if (itemId === ITEM_GREATBALL) bag.greatball = quantity;
    else if (itemId === ITEM_ULTRABALL) bag.ultraball = quantity;
    else if (itemId === ITEM_MASTERBALL) bag.masterball = quantity;
  }

  return bag;
}

/** Read full battle state. */
export function readBattleState(mem: MemoryReader, skipBattleCheck = false): BattleState | null {
  const wild = readWildPokemon(mem, skipBattleCheck);
  const player = readPlayerPokemon(mem, skipBattleCheck);
  if (!wild || !player) return null;
  const bag = readBag(mem);
  return { wild, player, bag };
}

/** Map ball type string to item ID. */
export function ballTypeToItemId(ballType: string): number {
  switch (ballType) {
    case 'pokeball': return ITEM_POKEBALL;
    case 'greatball': return ITEM_GREATBALL;
    case 'ultraball': return ITEM_ULTRABALL;
    case 'masterball': return ITEM_MASTERBALL;
    default: return -1;
  }
}

/**
 * Find the 0-based display index of a ball type in the Balls pocket.
 * Returns -1 if the ball type is not in the pocket.
 */
export function getBallSlotIndex(mem: MemoryReader, ballType: string): number {
  const targetItemId = ballTypeToItemId(ballType);
  if (targetItemId < 0) return -1;

  for (let i = 0; i < BAG_BALLS_POCKET_SIZE; i++) {
    const addr = ADDR_BAG_BALLS_POCKET + i * 4;
    const itemId = mem.readU16(addr);
    if (itemId === 0) break; // end of pocket
    if (itemId === targetItemId) return i;
  }
  return -1;
}

/**
 * Move database — subset of Gen 3 moves with name, power, type, and PP.
 * Only includes commonly encountered moves. Unlisted moves get generic defaults.
 */
interface MoveData {
  name: string;
  power: number;
  type: string;
  pp: number;
}

const MOVE_DB: Record<number, MoveData> = {
  1: { name: 'Pound', power: 40, type: 'Normal', pp: 35 },
  2: { name: 'Karate Chop', power: 50, type: 'Fighting', pp: 25 },
  3: { name: 'Double Slap', power: 15, type: 'Normal', pp: 10 },
  4: { name: 'Comet Punch', power: 18, type: 'Normal', pp: 15 },
  5: { name: 'Mega Punch', power: 80, type: 'Normal', pp: 20 },
  6: { name: 'Pay Day', power: 40, type: 'Normal', pp: 20 },
  7: { name: 'Fire Punch', power: 75, type: 'Fire', pp: 15 },
  8: { name: 'Ice Punch', power: 75, type: 'Ice', pp: 15 },
  9: { name: 'Thunder Punch', power: 75, type: 'Electric', pp: 15 },
  10: { name: 'Scratch', power: 40, type: 'Normal', pp: 35 },
  11: { name: 'Vice Grip', power: 55, type: 'Normal', pp: 30 },
  12: { name: 'Guillotine', power: 0, type: 'Normal', pp: 5 },
  13: { name: 'Razor Wind', power: 80, type: 'Normal', pp: 10 },
  14: { name: 'Swords Dance', power: 0, type: 'Normal', pp: 30 },
  15: { name: 'Cut', power: 50, type: 'Normal', pp: 30 },
  16: { name: 'Gust', power: 40, type: 'Flying', pp: 35 },
  17: { name: 'Wing Attack', power: 60, type: 'Flying', pp: 35 },
  18: { name: 'Whirlwind', power: 0, type: 'Normal', pp: 20 },
  19: { name: 'Fly', power: 70, type: 'Flying', pp: 15 },
  20: { name: 'Bind', power: 15, type: 'Normal', pp: 20 },
  21: { name: 'Slam', power: 80, type: 'Normal', pp: 20 },
  22: { name: 'Vine Whip', power: 35, type: 'Grass', pp: 15 },
  23: { name: 'Stomp', power: 65, type: 'Normal', pp: 20 },
  24: { name: 'Double Kick', power: 30, type: 'Fighting', pp: 30 },
  25: { name: 'Mega Kick', power: 120, type: 'Normal', pp: 5 },
  26: { name: 'Jump Kick', power: 70, type: 'Fighting', pp: 25 },
  27: { name: 'Rolling Kick', power: 60, type: 'Fighting', pp: 15 },
  28: { name: 'Sand Attack', power: 0, type: 'Ground', pp: 15 },
  29: { name: 'Headbutt', power: 70, type: 'Normal', pp: 15 },
  30: { name: 'Horn Attack', power: 65, type: 'Normal', pp: 25 },
  31: { name: 'Fury Attack', power: 15, type: 'Normal', pp: 20 },
  32: { name: 'Horn Drill', power: 0, type: 'Normal', pp: 5 },
  33: { name: 'Tackle', power: 35, type: 'Normal', pp: 35 },
  34: { name: 'Body Slam', power: 85, type: 'Normal', pp: 15 },
  35: { name: 'Wrap', power: 15, type: 'Normal', pp: 20 },
  36: { name: 'Take Down', power: 90, type: 'Normal', pp: 20 },
  37: { name: 'Thrash', power: 90, type: 'Normal', pp: 20 },
  38: { name: 'Double-Edge', power: 120, type: 'Normal', pp: 15 },
  39: { name: 'Tail Whip', power: 0, type: 'Normal', pp: 30 },
  40: { name: 'Poison Sting', power: 15, type: 'Poison', pp: 35 },
  41: { name: 'Twineedle', power: 25, type: 'Bug', pp: 20 },
  42: { name: 'Pin Missile', power: 14, type: 'Bug', pp: 20 },
  43: { name: 'Leer', power: 0, type: 'Normal', pp: 30 },
  44: { name: 'Bite', power: 60, type: 'Dark', pp: 25 },
  45: { name: 'Growl', power: 0, type: 'Normal', pp: 40 },
  46: { name: 'Roar', power: 0, type: 'Normal', pp: 20 },
  47: { name: 'Sing', power: 0, type: 'Normal', pp: 15 },
  48: { name: 'Supersonic', power: 0, type: 'Normal', pp: 20 },
  49: { name: 'Sonic Boom', power: 0, type: 'Normal', pp: 20 },
  50: { name: 'Disable', power: 0, type: 'Normal', pp: 20 },
  51: { name: 'Acid', power: 40, type: 'Poison', pp: 30 },
  52: { name: 'Ember', power: 40, type: 'Fire', pp: 25 },
  53: { name: 'Flamethrower', power: 95, type: 'Fire', pp: 15 },
  54: { name: 'Mist', power: 0, type: 'Ice', pp: 30 },
  55: { name: 'Water Gun', power: 40, type: 'Water', pp: 25 },
  56: { name: 'Hydro Pump', power: 120, type: 'Water', pp: 5 },
  57: { name: 'Surf', power: 95, type: 'Water', pp: 15 },
  58: { name: 'Ice Beam', power: 95, type: 'Ice', pp: 10 },
  59: { name: 'Blizzard', power: 120, type: 'Ice', pp: 5 },
  60: { name: 'Psybeam', power: 65, type: 'Psychic', pp: 20 },
  61: { name: 'Bubble Beam', power: 65, type: 'Water', pp: 20 },
  62: { name: 'Aurora Beam', power: 65, type: 'Ice', pp: 20 },
  63: { name: 'Hyper Beam', power: 150, type: 'Normal', pp: 5 },
  64: { name: 'Peck', power: 35, type: 'Flying', pp: 35 },
  65: { name: 'Drill Peck', power: 80, type: 'Flying', pp: 20 },
  66: { name: 'Submission', power: 80, type: 'Fighting', pp: 25 },
  67: { name: 'Low Kick', power: 0, type: 'Fighting', pp: 20 },
  68: { name: 'Counter', power: 0, type: 'Fighting', pp: 20 },
  69: { name: 'Seismic Toss', power: 0, type: 'Fighting', pp: 20 },
  70: { name: 'Strength', power: 80, type: 'Normal', pp: 15 },
  71: { name: 'Absorb', power: 20, type: 'Grass', pp: 20 },
  72: { name: 'Mega Drain', power: 40, type: 'Grass', pp: 10 },
  73: { name: 'Leech Seed', power: 0, type: 'Grass', pp: 10 },
  74: { name: 'Growth', power: 0, type: 'Normal', pp: 40 },
  75: { name: 'Razor Leaf', power: 55, type: 'Grass', pp: 25 },
  76: { name: 'Solar Beam', power: 120, type: 'Grass', pp: 10 },
  77: { name: 'Poison Powder', power: 0, type: 'Poison', pp: 35 },
  78: { name: 'Stun Spore', power: 0, type: 'Poison', pp: 30 },
  79: { name: 'Sleep Powder', power: 0, type: 'Grass', pp: 15 },
  80: { name: 'Petal Dance', power: 70, type: 'Grass', pp: 20 },
  81: { name: 'String Shot', power: 0, type: 'Bug', pp: 40 },
  82: { name: 'Dragon Rage', power: 0, type: 'Dragon', pp: 10 },
  83: { name: 'Fire Spin', power: 15, type: 'Fire', pp: 15 },
  84: { name: 'Thunder Shock', power: 40, type: 'Electric', pp: 30 },
  85: { name: 'Thunderbolt', power: 95, type: 'Electric', pp: 15 },
  86: { name: 'Thunder Wave', power: 0, type: 'Electric', pp: 20 },
  87: { name: 'Thunder', power: 120, type: 'Electric', pp: 10 },
  88: { name: 'Rock Throw', power: 50, type: 'Rock', pp: 15 },
  89: { name: 'Earthquake', power: 100, type: 'Ground', pp: 10 },
  90: { name: 'Fissure', power: 0, type: 'Ground', pp: 5 },
  91: { name: 'Dig', power: 60, type: 'Ground', pp: 10 },
  92: { name: 'Toxic', power: 0, type: 'Poison', pp: 10 },
  93: { name: 'Confusion', power: 50, type: 'Psychic', pp: 25 },
  94: { name: 'Psychic', power: 90, type: 'Psychic', pp: 10 },
  95: { name: 'Hypnosis', power: 0, type: 'Psychic', pp: 20 },
  96: { name: 'Meditate', power: 0, type: 'Psychic', pp: 40 },
  97: { name: 'Agility', power: 0, type: 'Psychic', pp: 30 },
  98: { name: 'Quick Attack', power: 40, type: 'Normal', pp: 30 },
  99: { name: 'Rage', power: 20, type: 'Normal', pp: 20 },
  100: { name: 'Teleport', power: 0, type: 'Psychic', pp: 20 },
  101: { name: 'Night Shade', power: 0, type: 'Ghost', pp: 15 },
  102: { name: 'Mimic', power: 0, type: 'Normal', pp: 10 },
  103: { name: 'Screech', power: 0, type: 'Normal', pp: 40 },
  104: { name: 'Double Team', power: 0, type: 'Normal', pp: 15 },
  105: { name: 'Recover', power: 0, type: 'Normal', pp: 20 },
  106: { name: 'Harden', power: 0, type: 'Normal', pp: 30 },
  107: { name: 'Minimize', power: 0, type: 'Normal', pp: 20 },
  108: { name: 'Smokescreen', power: 0, type: 'Normal', pp: 20 },
  109: { name: 'Confuse Ray', power: 0, type: 'Ghost', pp: 10 },
  110: { name: 'Withdraw', power: 0, type: 'Water', pp: 40 },
  111: { name: 'Defense Curl', power: 0, type: 'Normal', pp: 40 },
  112: { name: 'Barrier', power: 0, type: 'Psychic', pp: 30 },
  113: { name: 'Light Screen', power: 0, type: 'Psychic', pp: 30 },
  114: { name: 'Haze', power: 0, type: 'Ice', pp: 30 },
  115: { name: 'Reflect', power: 0, type: 'Psychic', pp: 20 },
  116: { name: 'Focus Energy', power: 0, type: 'Normal', pp: 30 },
  117: { name: 'Bide', power: 0, type: 'Normal', pp: 10 },
  118: { name: 'Metronome', power: 0, type: 'Normal', pp: 10 },
  119: { name: 'Mirror Move', power: 0, type: 'Flying', pp: 20 },
  120: { name: 'Self-Destruct', power: 200, type: 'Normal', pp: 5 },
  121: { name: 'Egg Bomb', power: 100, type: 'Normal', pp: 10 },
  122: { name: 'Lick', power: 20, type: 'Ghost', pp: 30 },
  123: { name: 'Smog', power: 20, type: 'Poison', pp: 20 },
  124: { name: 'Sludge', power: 65, type: 'Poison', pp: 20 },
  125: { name: 'Bone Club', power: 65, type: 'Ground', pp: 20 },
  126: { name: 'Fire Blast', power: 120, type: 'Fire', pp: 5 },
  127: { name: 'Waterfall', power: 80, type: 'Water', pp: 15 },
  128: { name: 'Clamp', power: 35, type: 'Water', pp: 10 },
  129: { name: 'Swift', power: 60, type: 'Normal', pp: 20 },
  130: { name: 'Skull Bash', power: 100, type: 'Normal', pp: 15 },
  131: { name: 'Spike Cannon', power: 20, type: 'Normal', pp: 15 },
  132: { name: 'Constrict', power: 10, type: 'Normal', pp: 35 },
  133: { name: 'Amnesia', power: 0, type: 'Psychic', pp: 20 },
  134: { name: 'Kinesis', power: 0, type: 'Psychic', pp: 15 },
  135: { name: 'Soft-Boiled', power: 0, type: 'Normal', pp: 10 },
  136: { name: 'Hi Jump Kick', power: 85, type: 'Fighting', pp: 20 },
  137: { name: 'Glare', power: 0, type: 'Normal', pp: 30 },
  138: { name: 'Dream Eater', power: 100, type: 'Psychic', pp: 15 },
  139: { name: 'Poison Gas', power: 0, type: 'Poison', pp: 40 },
  140: { name: 'Barrage', power: 15, type: 'Normal', pp: 20 },
  141: { name: 'Leech Life', power: 20, type: 'Bug', pp: 15 },
  142: { name: 'Lovely Kiss', power: 0, type: 'Normal', pp: 10 },
  143: { name: 'Sky Attack', power: 140, type: 'Flying', pp: 5 },
  144: { name: 'Transform', power: 0, type: 'Normal', pp: 10 },
  145: { name: 'Bubble', power: 20, type: 'Water', pp: 30 },
  146: { name: 'Dizzy Punch', power: 70, type: 'Normal', pp: 10 },
  147: { name: 'Spore', power: 0, type: 'Grass', pp: 15 },
  148: { name: 'Flash', power: 0, type: 'Normal', pp: 20 },
  149: { name: 'Psywave', power: 0, type: 'Psychic', pp: 15 },
  150: { name: 'Splash', power: 0, type: 'Normal', pp: 40 },
  151: { name: 'Acid Armor', power: 0, type: 'Poison', pp: 40 },
  152: { name: 'Crabhammer', power: 90, type: 'Water', pp: 10 },
  153: { name: 'Explosion', power: 250, type: 'Normal', pp: 5 },
  154: { name: 'Fury Swipes', power: 18, type: 'Normal', pp: 15 },
  155: { name: 'Bonemerang', power: 50, type: 'Ground', pp: 10 },
  156: { name: 'Rest', power: 0, type: 'Psychic', pp: 10 },
  157: { name: 'Rock Slide', power: 75, type: 'Rock', pp: 10 },
  158: { name: 'Hyper Fang', power: 80, type: 'Normal', pp: 15 },
  159: { name: 'Sharpen', power: 0, type: 'Normal', pp: 30 },
  160: { name: 'Conversion', power: 0, type: 'Normal', pp: 30 },
  161: { name: 'Tri Attack', power: 80, type: 'Normal', pp: 10 },
  162: { name: 'Super Fang', power: 0, type: 'Normal', pp: 10 },
  163: { name: 'Slash', power: 70, type: 'Normal', pp: 20 },
  164: { name: 'Substitute', power: 0, type: 'Normal', pp: 10 },
  165: { name: 'Struggle', power: 50, type: 'Normal', pp: 1 },
  // Gen 2 moves commonly seen in Ruby/Sapphire
  175: { name: 'Flail', power: 0, type: 'Normal', pp: 15 },
  177: { name: 'Aeroblast', power: 100, type: 'Flying', pp: 5 },
  183: { name: 'Mach Punch', power: 40, type: 'Fighting', pp: 30 },
  188: { name: 'Sludge Bomb', power: 90, type: 'Poison', pp: 10 },
  189: { name: 'Mud-Slap', power: 20, type: 'Ground', pp: 10 },
  200: { name: 'Outrage', power: 90, type: 'Dragon', pp: 15 },
  202: { name: 'Giga Drain', power: 60, type: 'Grass', pp: 5 },
  210: { name: 'Fury Cutter', power: 10, type: 'Bug', pp: 20 },
  214: { name: 'Sleep Talk', power: 0, type: 'Normal', pp: 10 },
  216: { name: 'Return', power: 0, type: 'Normal', pp: 20 },
  218: { name: 'Frustration', power: 0, type: 'Normal', pp: 20 },
  223: { name: 'Dynamic Punch', power: 100, type: 'Fighting', pp: 5 },
  225: { name: 'Dragon Breath', power: 60, type: 'Dragon', pp: 20 },
  231: { name: 'Iron Tail', power: 100, type: 'Steel', pp: 15 },
  237: { name: 'Hidden Power', power: 0, type: 'Normal', pp: 15 },
  239: { name: 'Twister', power: 40, type: 'Dragon', pp: 20 },
  240: { name: 'Rain Dance', power: 0, type: 'Water', pp: 5 },
  241: { name: 'Sunny Day', power: 0, type: 'Fire', pp: 5 },
  242: { name: 'Crunch', power: 80, type: 'Dark', pp: 15 },
  245: { name: 'Extreme Speed', power: 80, type: 'Normal', pp: 5 },
  246: { name: 'Ancient Power', power: 60, type: 'Rock', pp: 5 },
  247: { name: 'Shadow Ball', power: 80, type: 'Ghost', pp: 15 },
  249: { name: 'Rock Smash', power: 20, type: 'Fighting', pp: 15 },
  250: { name: 'Whirlpool', power: 15, type: 'Water', pp: 15 },
  252: { name: 'Fake Out', power: 40, type: 'Normal', pp: 10 },
  253: { name: 'Uproar', power: 50, type: 'Normal', pp: 10 },
  // Gen 3 new moves (commonly encountered)
  265: { name: 'Smelling Salts', power: 60, type: 'Normal', pp: 10 },
  276: { name: 'Superpower', power: 120, type: 'Fighting', pp: 5 },
  280: { name: 'Brick Break', power: 75, type: 'Fighting', pp: 15 },
  282: { name: 'Knock Off', power: 20, type: 'Dark', pp: 20 },
  290: { name: 'Secret Power', power: 70, type: 'Normal', pp: 20 },
  291: { name: 'Dive', power: 60, type: 'Water', pp: 10 },
  295: { name: 'Luster Purge', power: 70, type: 'Psychic', pp: 5 },
  299: { name: 'Blaze Kick', power: 85, type: 'Fire', pp: 10 },
  301: { name: 'Ice Ball', power: 30, type: 'Ice', pp: 20 },
  303: { name: 'Slack Off', power: 0, type: 'Normal', pp: 10 },
  304: { name: 'Hyper Voice', power: 90, type: 'Normal', pp: 10 },
  306: { name: 'Crush Claw', power: 75, type: 'Normal', pp: 10 },
  307: { name: 'Blast Burn', power: 150, type: 'Fire', pp: 5 },
  308: { name: 'Hydro Cannon', power: 150, type: 'Water', pp: 5 },
  309: { name: 'Meteor Mash', power: 100, type: 'Steel', pp: 10 },
  311: { name: 'Weather Ball', power: 50, type: 'Normal', pp: 10 },
  314: { name: 'Air Cutter', power: 55, type: 'Flying', pp: 25 },
  315: { name: 'Overheat', power: 140, type: 'Fire', pp: 5 },
  317: { name: 'Rock Tomb', power: 50, type: 'Rock', pp: 10 },
  318: { name: 'Silver Wind', power: 60, type: 'Bug', pp: 5 },
  323: { name: 'Water Pulse', power: 60, type: 'Water', pp: 20 },
  326: { name: 'Extrasensory', power: 80, type: 'Psychic', pp: 30 },
  327: { name: 'Sky Uppercut', power: 85, type: 'Fighting', pp: 15 },
  328: { name: 'Sand Tomb', power: 15, type: 'Ground', pp: 15 },
  330: { name: 'Muddy Water', power: 95, type: 'Water', pp: 10 },
  331: { name: 'Bullet Seed', power: 10, type: 'Grass', pp: 30 },
  332: { name: 'Aerial Ace', power: 60, type: 'Flying', pp: 20 },
  334: { name: 'Iron Defense', power: 0, type: 'Steel', pp: 15 },
  337: { name: 'Dragon Claw', power: 80, type: 'Dragon', pp: 15 },
  338: { name: 'Frenzy Plant', power: 150, type: 'Grass', pp: 5 },
  340: { name: 'Bounce', power: 85, type: 'Flying', pp: 5 },
  341: { name: 'Mud Shot', power: 55, type: 'Ground', pp: 15 },
  342: { name: 'Poison Tail', power: 50, type: 'Poison', pp: 25 },
  344: { name: 'Volt Tackle', power: 120, type: 'Electric', pp: 15 },
  345: { name: 'Magical Leaf', power: 60, type: 'Grass', pp: 20 },
  346: { name: 'Water Sport', power: 0, type: 'Water', pp: 15 },
  348: { name: 'Leaf Blade', power: 70, type: 'Grass', pp: 15 },
  352: { name: 'Water Spout', power: 150, type: 'Water', pp: 5 },
  354: { name: 'Psycho Boost', power: 140, type: 'Psychic', pp: 5 },
};
