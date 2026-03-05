---
name: train
description: Train a Pokemon via switch-training in Pokemon Ruby/Sapphire
user-invocable: true
argument: [target_level]
---

# /train — Pokemon Switch-Training Bot

You are monitoring a switch-training bot in a GBA emulator running in a browser. The bot walks grass, encounters wilds, switches the trainee (slot 0) out to the KO'er (slot 1), KOs with the strongest move, and repeats. The bot is fully autonomous — you do NOT make per-battle decisions. Your job is to start the bot, monitor progress, and handle pause/resume events.

**IMPORTANT**: Keep the user informed. Output a short status update every time you check the bot state.

## Prerequisites

The user must arrange their party before starting:
- **Slot 0 (first)**: Trainee — the weak Pokemon to level up
- **Slot 1 (second)**: KO'er — a strong Pokemon that can one-shot wild encounters

## Setup

1. Navigate to the emulator:
```js
// browser_navigate to https://gba.mini-mil.com
```

2. Verify the emulator is ready:
```js
// browser_evaluate
() => typeof window.startTraining === 'function'
```

3. Check the current location:
```js
// browser_evaluate
() => window.getLocation().then(loc => JSON.stringify(loc))
```

This returns `{ "mapName": "ROUTE 101", "x": 5, "y": 10 }`. Use the map name to advise the user whether this is a good training spot for their target level. Wild Pokemon levels vary by route in Ruby/Sapphire:

| Route / Area | Wild Levels |
|---|---|
| Route 101 | 2-3 |
| Route 102 | 3-4 |
| Route 103 | 2-4 |
| Route 104 | 4-5 |
| Petalburg Woods | 5-6 |
| Route 110 | 12-13 |
| Route 116 | 6-8 |
| Route 117 | 13-14 |
| Route 118 | 24-26 |
| Route 119 | 25-27 |
| Route 120 | 25-27 |
| Route 121 | 26-28 |

If the wild levels are much higher than the trainee's current level, warn the user — the trainee could get KO'd before switching. If wild levels are very low relative to the KO'er, training will work but give minimal EXP. Recommend a route where wilds are close to or slightly above the trainee's level for optimal EXP gain.

4. Start the training bot:
```js
// browser_evaluate
() => { window.startTraining({ targetLevel: $ARGUMENTS || undefined }); return "Training started"; }
```

If `$ARGUMENTS` is empty or not a number, pass `{}` (no target level — trains indefinitely until stopped).

## Monitoring Loop

Poll the bot state every 10-15 seconds:

```js
// browser_evaluate
() => JSON.stringify(window.botState, null, 2)
```

### Status Handling

- **WALKING**: Bot is searching for encounters. Report progress: "Training Lv.12→20 | 3 battles won — searching..."
- **BATTLE_ENTERING** / **SWITCHING** / **ATTACKING**: Bot is handling a battle autonomously. Wait and check again.
- **PAUSED**: Bot needs user intervention. Read `pauseReason` and inform the user.
- **DONE**: Target level reached. Report success.
- **ERROR**: Something went wrong. Read `error` and report.

### When status is PAUSED

The bot pauses for two reasons:

1. **KO'er HP low**: The KO'er's HP dropped below 20%. Tell the user to heal and then resume.
2. **Level-up event**: An evolution or move-learn prompt is blocking. Tell the user to handle it manually (accept/decline evolution, choose move), then resume.

After the user handles the prompt:
```js
// browser_evaluate
() => { window.resumeTraining(); return "Training resumed"; }
```

**Before calling resumeTraining**, verify the user has returned to the overworld. If they haven't, tell them to finish handling the prompt first.

## Completion

When `window.botState.status === "DONE"`:
```js
// browser_evaluate
() => JSON.stringify(window.botState.trainingState)
```

Report: "Training complete! Reached Lv.X after Y battles."

## Stopping

If the user wants to stop:
```js
// browser_evaluate
() => { window.stopBot(); return "Bot stopped"; }
```

## Important Notes

- The bot runs at 4x speed during walking and battles.
- The bot is fully autonomous — do NOT inject battle actions (`window.botAction`). The bot handles switching and attacking on its own.
- The trainee earns half EXP from each battle (Gen 3 switch-training mechanic).
- If the KO'er runs out of PP or faints, the bot will ERROR. The user needs to heal at a Pokemon Center.
- Memory addresses are for Pokemon Ruby/Sapphire. Other games may not work.
- The player must already be standing on or near grass.
