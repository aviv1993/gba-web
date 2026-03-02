---
name: catch
description: Catch a specific Pokemon in Pokemon Ruby/Sapphire using the GBA emulator bot
user-invocable: true
argument: <pokemon_name>
---

# /catch — Pokemon Auto-Catcher

You are controlling a Pokemon catching bot in a GBA emulator running in a browser. The bot handles walking, encountering Pokemon, and running from non-targets autonomously. Your job is to make catching decisions when the target Pokemon is found.

## Setup

1. Navigate to the emulator:
```js
// browser_navigate to http://localhost:5173 (or wherever the dev server is)
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

Poll the bot status by reading `window.botStatus`:

```js
// browser_evaluate: check status
() => window.botStatus
```

- **WALKING** / **RUNNING** / **BATTLE_ENTERING**: Bot is working autonomously. Check again in a few seconds using `browser_wait_for` with a short time.
- **WAITING_FOR_DECISION**: Target Pokemon found! Read battle state and decide.
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
    "wild": { "name": "Pikachu", "hp": 34, "maxHp": 45, "level": 12, "status": "none" },
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

Strategy:
1. **If HP is high (>50%)**: Use a weak, non-super-effective move to lower HP. Avoid STAB moves and high-power moves.
2. **If HP is moderate (25-50%)**: Consider throwing a ball. Great Balls are better than Poke Balls.
3. **If HP is low (<25%)**: Throw the best available ball. Use Ultra Ball > Great Ball > Poke Ball.
4. **If status is "none"**: Consider using a status move (Sleep Powder, Thunder Wave, etc.) if available — status conditions greatly increase catch rate.
5. **If no balls left**: Report failure to the user.

### Injecting Actions

**Use a move** (moveIndex 0-3 corresponding to the move slot):
```js
// browser_evaluate: use move
() => { window.botAction = { type: "use_move", moveIndex: 0 }; return "Action set: use move 0"; }
```

**Throw a ball**:
```js
// browser_evaluate: throw ball
() => { window.botAction = { type: "throw_ball", ballType: "pokeball" }; return "Action set: throw pokeball"; }
```

After setting the action, resume monitoring. The bot will execute the action and return to WAITING_FOR_DECISION for the next turn, or transition to DONE if the catch succeeds.

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

- The bot runs at 4x speed while searching. Normal speed during battles.
- Memory addresses are for Pokemon Ruby/Sapphire (US). Other games may not work.
- The bot walks up and down — the player must already be standing on or near grass.
- If memory reading fails, the bot will report an ERROR status.
- Each monitoring check is very cheap (text only, no screenshots needed).
