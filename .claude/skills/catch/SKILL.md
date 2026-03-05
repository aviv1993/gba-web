---
name: catch
description: Catch a specific Pokemon in Pokemon Ruby/Sapphire using the GBA emulator bot
user-invocable: true
argument: <pokemon_name>
---

# /catch — Pokemon Auto-Catcher

You are controlling a Pokemon catching bot in a GBA emulator running in a browser. The bot handles walking, encountering Pokemon, and running from non-targets autonomously. Your job is to make catching decisions when the target Pokemon is found.

**IMPORTANT**: Keep the user informed throughout. Output a short status update to the user every time you check the bot state — don't stay silent while polling. Examples: "Bot started, searching for Pikachu...", "Still searching... 3 encounters so far", "Found Pikachu! Reading battle state...", "Threw a Great Ball... checking result". The user should always know what's happening.

## Setup

1. Navigate to the emulator:
```js
// browser_navigate to https://gba.mini-mil.com
```

2. Verify the emulator is ready:
```js
// browser_evaluate: check window.startBot exists
() => typeof window.startBot === 'function'
```

3. Start the bot with the target Pokemon:
```js
// browser_evaluate: start the bot
() => { window.startBot("$ARGUMENTS"); return "Bot started"; }
```

## Monitoring Loop

Poll the bot status and encounter count together:

```js
// browser_evaluate: check status
() => JSON.stringify({ status: window.botStatus, encounters: window.botState?.encounterCount ?? 0 })
```

- **WALKING** / **RUNNING** / **BATTLE_ENTERING**: Bot is working autonomously. **Tell the user** the current status and encounter count (e.g. "Searching... 7 encounters so far, no Pikachu yet"), then check again in a few seconds using `browser_wait_for` with a short time.
- **WAITING_FOR_DECISION**: Target Pokemon found! **Tell the user** immediately (e.g. "Found Pikachu on encounter #12!"), then read battle state and decide.
- **DONE**: Pokemon was caught! Report success.
- **ERROR**: Something went wrong. Read `window.botState.error` and report.

### When status is WAITING_FOR_DECISION

Read the full battle state:
```js
// browser_evaluate: get battle state
() => JSON.stringify(window.botState, null, 2)
```

This returns:
```json
{
  "status": "WAITING_FOR_DECISION",
  "targetName": "Pikachu",
  "encounterCount": 5,
  "battleState": {
    "wild": { "name": "Pikachu", "hp": 34, "maxHp": 45, "level": 12, "status": "none", "catchRate": 190 },
    "player": { "name": "Mudkip", "hp": 78, "maxHp": 78, "level": 15, "moves": [
      { "id": 55, "name": "Water Gun", "pp": 25, "maxPp": 25, "power": 40, "type": "Water" },
      { "id": 33, "name": "Tackle", "pp": 35, "maxPp": 35, "power": 35, "type": "Normal" },
      { "id": 45, "name": "Growl", "pp": 40, "maxPp": 40, "power": 0, "type": "Normal" },
      { "id": 189, "name": "Mud-Slap", "pp": 10, "maxPp": 10, "power": 20, "type": "Ground" }
    ]},
    "bag": { "pokeball": 10, "greatball": 3, "ultraball": 0, "masterball": 0 }
  }
}
```

### Making Decisions

**Goal**: Catch the Pokemon without fainting it.

**Never use Master Ball** — it is not available to the bot (blocked and hidden from bag state).

**IMPORTANT — You MUST compute the actual catch probability before every throw decision.** Use the Gen 3 catch formula below. Do NOT throw a ball unless the computed probability is **≥ 50%**. The only exception is if the Pokemon knows Teleport, Roar, Whirlwind, or self-destruct moves — then throw immediately since you'll lose the encounter.

### Gen 3 Catch Probability Formula

Compute `a`:
```
a = ((3 * maxHp - 2 * currentHp) * catchRate * ballModifier) / (3 * maxHp) * statusModifier
```

Ball modifiers: Poke Ball = 1, Great Ball = 1.5, Ultra Ball = 2
Status modifiers: sleep/freeze = 2, paralysis/poison/burn = 1.5, none = 1

If `a >= 255`, catch is guaranteed (probability = 100%).

Otherwise compute shake probability:
```
b = 1048560 / sqrt(sqrt(16711680 / a))
```

Final catch probability:
```
p = (b / 65536) ^ 4
```

**Example**: Zigzagoon (catchRate=255), full HP (19/19), Poke Ball, no status:
- `a = ((3*19 - 2*19) * 255 * 1) / (3*19) * 1 = (19 * 255) / 57 = 85`
- `b = 1048560 / sqrt(sqrt(16711680 / 85)) = 1048560 / sqrt(sqrt(196608)) = 1048560 / sqrt(443.4) = 1048560 / 21.06 ≈ 49788`
- `p = (49788 / 65536)^4 ≈ 0.76^4 ≈ 0.33` → **33% per throw**

So even catch rate 255 at full HP is only ~33%. You must lower HP and/or apply status to reach ≥50%.

### Strategy

1. **Compute catch probability** with current HP, status, and best available ball. If ≥50%, throw.
2. **Lower HP**: Use weak moves (low power, non-STAB, non-super-effective) to chip HP down. Avoid overkill — don't use strong moves when HP is already low.
3. **Apply status conditions**: If the player has status moves that cause **sleep** (Sleep Powder, Spore, Hypnosis) or **paralysis** (Thunder Wave, Stun Spore, Glare), use them — they give 2x/1.5x catch multiplier. Growl, Leer, Tail Whip, Sand Attack etc. do NOT help catch rate; don't waste turns on them.
4. **Ball selection**: After computing probability for each available ball type, use the cheapest one that reaches ≥50%.
   - For common Pokemon (Wurmple, Zigzagoon, Poochyena, etc.): Prefer **Poke Balls** — they're cheap and common Pokemon are easy to re-encounter.
   - For uncommon/rare Pokemon: Use **Great Balls** or **Ultra Balls** to maximize catch chance.
5. **If no balls left**: Report failure to the user.

**Always tell the user the computed catch probability** when deciding to throw or to keep attacking (e.g. "Catch probability with Poke Ball: 33% — too low, using Tackle to lower HP" or "Catch probability with Great Ball: 62% — throwing!").

### Injecting Actions

**Use a move** (moveIndex 0-3 corresponding to the move slot):
```js
// browser_evaluate: use move
() => { window.botAction = { type: "use_move", moveIndex: 0 }; return "Action set: use move 0"; }
```

**Throw a ball** (ballType must be one of: `pokeball`, `greatball`, `ultraball`):
```js
// browser_evaluate: throw ball
() => { window.botAction = { type: "throw_ball", ballType: "pokeball" }; return "Action set: throw pokeball"; }
```

After setting the action, **tell the user what you did and why** (e.g. "Using Tackle to lower HP — catch probability is only 33%, need it higher"), then wait ~12 seconds and check status.

### Interpreting Post-Action Status

After an action executes, check `window.botStatus`:

- **DONE** → Catch succeeded! Go to Completion.
- **WAITING_FOR_DECISION** → You're back in battle. If you threw a ball, **the catch failed** (ball broke out). Read the battle state and decide the next action — throw again or attack first. Tell the user (e.g. "Ball broke out! Still at 13/22 HP, throwing another Poke Ball...").
- **EXECUTING_ACTION** → Still processing. Wait a few more seconds and check again.
- **WALKING** → The wild Pokemon fainted or the battle ended. Report this to the user and keep monitoring — the bot will resume searching automatically.

**Do NOT try to verify catches by reading battle state data** (HP, ball count, etc.) — battle data in memory is stale after the battle ends and will mislead you. The ONLY reliable indicator is `window.botStatus`.

## Completion

When `window.botStatus === "DONE"`:
```js
// browser_evaluate: get final state
() => JSON.stringify(window.botState)
```

Report to the user: "Caught [Pokemon] after [N] encounters!"

## Stopping

If the user wants to stop, or something goes wrong:
```js
// browser_evaluate: stop bot
() => { window.stopBot(); return "Bot stopped"; }
```

## Important Notes

- The bot runs at 4x speed while searching and during battles.
- Memory addresses are for Pokemon Ruby/Sapphire (US). Other games may not work.
- The bot walks up and down — the player must already be standing on or near grass.
- If memory reading fails, the bot will report an ERROR status.
- Each monitoring check is very cheap (text only, no screenshots needed).
