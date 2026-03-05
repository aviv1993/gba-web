import type { MemoryReader } from './memory.ts';
import type { BagSlot, FullBag, GameState, Location, PartyOverview, Screen } from './types.ts';
import {
  ADDR_SAVE_BLOCK_1,
  ADDR_GMAIN_CALLBACK2,
  SB1_POS,
  SB1_LOCATION,
  SB1_PARTY_COUNT,
  SB1_PARTY,
  SB1_MONEY,
  SB1_BAG_ITEMS,
  SB1_BAG_KEY_ITEMS,
  SB1_BAG_BALLS,
  SB1_BAG_TMS,
  SB1_BAG_BERRIES,
  BAG_ITEMS_SIZE,
  BAG_KEY_ITEMS_SIZE,
  BAG_BALLS_SIZE,
  BAG_TMS_SIZE,
  BAG_BERRIES_SIZE,
  PARTY_MON_SIZE,
  PARTY_MON_STATUS,
  PARTY_MON_LEVEL,
  PARTY_MON_HP,
  PARTY_MON_MAX_HP,
  readBattleState,
} from './game-data.ts';
import { getMapName } from './map-data.ts';

/** Status condition masks (same as in game-data.ts) */
const STATUS_SLEEP_MASK = 0x07;
const STATUS_POISON = 0x08;
const STATUS_BURN = 0x10;
const STATUS_FREEZE = 0x20;
const STATUS_PARALYSIS = 0x40;
const STATUS_TOXIC = 0x80;

function decodePartyStatus(bits: number): string {
  if (bits === 0) return 'none';
  if (bits & STATUS_SLEEP_MASK) return 'sleep';
  if (bits & STATUS_POISON) return 'poison';
  if (bits & STATUS_BURN) return 'burn';
  if (bits & STATUS_FREEZE) return 'freeze';
  if (bits & STATUS_PARALYSIS) return 'paralysis';
  if (bits & STATUS_TOXIC) return 'toxic';
  return 'unknown';
}

/**
 * Known callback2 addresses (EU ROM, empirically validated).
 * gMain.callback2 is the function pointer for the current screen handler.
 */
const CB2_OVERWORLD = 0x080543C5;

function readScreen(mem: MemoryReader): Screen {
  const callback2 = mem.readU32(ADDR_GMAIN_CALLBACK2);

  if (callback2 === CB2_OVERWORLD) {
    return { type: 'overworld' };
  }

  if (callback2 === 0) {
    return { type: 'unknown', callback2: 0 };
  }

  // Any non-overworld callback is treated as battle.
  // This is a simplification — menus/transitions also have different callbacks,
  // but for the bot's purposes, "not overworld" is the signal that matters.
  return { type: 'battle' };
}

function readLocation(mem: MemoryReader): Location {
  const sb1 = ADDR_SAVE_BLOCK_1;
  const x = mem.readU16(sb1 + SB1_POS);
  const y = mem.readU16(sb1 + SB1_POS + 2);
  const mapGroup = mem.readU8(sb1 + SB1_LOCATION);
  const mapNum = mem.readU8(sb1 + SB1_LOCATION + 1);
  const mapName = getMapName(mapGroup, mapNum);
  return { mapGroup, mapNum, mapName, x, y };
}

export function readParty(mem: MemoryReader): PartyOverview[] {
  const sb1 = ADDR_SAVE_BLOCK_1;
  const count = mem.readU8(sb1 + SB1_PARTY_COUNT);
  const partyBase = sb1 + SB1_PARTY;
  const party: PartyOverview[] = [];

  for (let i = 0; i < Math.min(count, 6); i++) {
    const base = partyBase + i * PARTY_MON_SIZE;
    const level = mem.readU8(base + PARTY_MON_LEVEL);
    // Skip empty slots (level 0)
    if (level === 0) continue;
    const hp = mem.readU16(base + PARTY_MON_HP);
    const maxHp = mem.readU16(base + PARTY_MON_MAX_HP);
    const statusBits = mem.readU32(base + PARTY_MON_STATUS);
    party.push({
      slot: i,
      level,
      hp,
      maxHp,
      status: decodePartyStatus(statusBits),
    });
  }

  return party;
}

function readBagPocket(mem: MemoryReader, offset: number, maxSlots: number): BagSlot[] {
  const slots: BagSlot[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const addr = ADDR_SAVE_BLOCK_1 + offset + i * 4;
    const itemId = mem.readU16(addr);
    const quantity = mem.readU16(addr + 2);
    if (itemId === 0) break;
    slots.push({ itemId, quantity });
  }
  return slots;
}

function readFullBag(mem: MemoryReader): FullBag {
  return {
    items: readBagPocket(mem, SB1_BAG_ITEMS, BAG_ITEMS_SIZE),
    keyItems: readBagPocket(mem, SB1_BAG_KEY_ITEMS, BAG_KEY_ITEMS_SIZE),
    balls: readBagPocket(mem, SB1_BAG_BALLS, BAG_BALLS_SIZE),
    tms: readBagPocket(mem, SB1_BAG_TMS, BAG_TMS_SIZE),
    berries: readBagPocket(mem, SB1_BAG_BERRIES, BAG_BERRIES_SIZE),
  };
}

/**
 * Read the full game state from memory.
 * Call mem.refresh() before this to get fresh data.
 */
export function readGameState(mem: MemoryReader): GameState {
  const screen = readScreen(mem);
  const location = readLocation(mem);
  const party = readParty(mem);
  const bag = readFullBag(mem);
  const money = mem.readU32(ADDR_SAVE_BLOCK_1 + SB1_MONEY);
  const battle = screen.type === 'battle' ? readBattleState(mem, true) : null;

  return { screen, location, party, bag, money, battle };
}
