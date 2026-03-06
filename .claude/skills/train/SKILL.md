---
name: train
description: Train a Pokemon via switch-training or direct training in Pokemon Ruby/Sapphire
user-invocable: true
argument: [direct] [target_level]
---

# /train — Pokemon Training Bot

You are monitoring a training bot in a GBA emulator running in a browser. The bot walks grass, encounters wilds, and defeats them to gain EXP. Two modes are supported:

- **Switch training** (default): Slot 0 (trainee) enters battle, switches to slot 1 (KO'er) who defeats the wild. Trainee earns half EXP.
- **Direct training** (`/train direct [level]`): Slot 0 fights directly — no switching. Full EXP.

The bot is fully autonomous — you do NOT make per-battle decisions. Your job is to start the bot, monitor progress, and handle pause/resume events.

**IMPORTANT**: Keep the user informed. Output a short status update every time you check the bot state.

## Prerequisites

- **Slot 0 (first)**: The Pokemon to train
- **Slot 1 (second)**: KO'er — a strong Pokemon that can one-shot wilds (only needed for switch mode)

**Argument parsing**: The argument string may contain a strategy keyword (`direct` or `switch`) and/or a target level number. Examples:
- `/train 15` → auto-detect mode, train to level 15
- `/train direct 15` → force direct training to level 15
- `/train switch 15` → force switch training to level 15
- `/train direct` → force direct training indefinitely

If the user specifies `direct` or `switch`, use that mode. Otherwise, auto-detect the best mode (see Strategy Selection below).

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

3. Check the current location and party (must be sequential — both use the same memory reader).
Do NOT load save states — the browser auto-loads the most recent cloud save on startup, so the game is already in the correct state:
```js
// browser_evaluate
() => window.getLocation().then(loc => window.getParty().then(party => JSON.stringify({ location: loc, party })))
```

This returns:
```json
{
  "location": { "mapName": "ROUTE 116", "x": 30, "y": 13 },
  "party": [
    { "slot": 0, "level": 8, "hp": 28, "maxHp": 28, "status": "none" },
    { "slot": 1, "level": 35, "hp": 102, "maxHp": 102, "status": "none" }
  ]
}
```

Slot 0 is the trainee, slot 1 is the KO'er. Use both to advise the user. Wild Pokemon levels by route in Ruby/Sapphire:

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

### Strategy Selection

Unless the user explicitly said `direct`, choose the mode automatically based on the trainee level vs wild levels on the current route:

- **Direct training** if slot 0's level is **≥ 5 levels above** the route's max wild level. The trainee can comfortably one-shot or two-shot wilds and earns full EXP.
- **Switch training** if slot 0's level is **below or close to** the wild levels (within 4 levels above). The trainee is too weak to fight safely — switch to the KO'er. Requires a healthy slot 1.
- **Warn the user** if the trainee's level is below the wild levels AND you're in switch mode — the trainee might get KO'd before the switch completes. Suggest moving to an easier route.
- **Warn the user** if there is no slot 1 (or slot 1 is fainted) and switch training is needed.

Example: Trainee Lv18 on Route 116 (wilds Lv6-8) → direct (18 is 10+ levels above). Trainee Lv11 on Route 116 → switch (only 3 levels above max).

Tell the user which mode you chose and why before starting.

5. Start the training bot:
```js
// browser_evaluate
// For switch training:
() => { window.startTraining({ targetLevel: <number_or_undefined> }); return "Training started (switch)"; }
// For direct training:
() => { window.startTraining({ targetLevel: <number_or_undefined>, direct: true }); return "Training started (direct)"; }
```

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
- **Switch mode**: trainee earns half EXP (Gen 3 switch-training mechanic). **Direct mode**: trainee earns full EXP.
- If the active Pokemon runs out of PP or faints, the bot will ERROR. The user needs to heal at a Pokemon Center.
- Memory addresses are for Pokemon Ruby/Sapphire. Other games may not work.
- The player must already be standing on or near grass.
