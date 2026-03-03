# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GBA Web is a browser-based Game Boy Advance emulator using mGBA compiled to WebAssembly (`@thenick775/mgba-wasm`). It's a React 19 + TypeScript SPA with an Express 5 backend for ROM/save file storage.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint (TypeScript files only) |
| `npm run server` | Express server (uses `node --experimental-strip-types`) |
| `npm run preview` | Preview production build |

No test framework is configured.

## Architecture

### Two-tier system

**Frontend** — Vite/React SPA. All emulator state lives in a single React Context (`src/emulator-context.tsx`). The mGBA WASM module initializes on canvas mount via `useEmulator` hook, then registers itself into context. Components read state via `useEmulatorContext()`.

**Backend** — Express server (`server/index.ts`). Flat-file REST API for saves (`/api/saves`) and ROMs (`/api/roms`) stored under `saves/`. Sets COOP/COEP headers required for `SharedArrayBuffer` (mGBA WASM threads). Serves the built frontend with SPA fallback.

### Key source layout

- `src/core/use-emulator.ts` — WASM module initialization, canvas binding
- `src/emulator-context.tsx` — central state: emulator instance, ROM loaded, paused, muted, speed
- `src/components/` — Screen (canvas), RomLoader (drag-drop/file picker/server ROMs), TouchControls (virtual gamepad), Toolbar, SaveSlots
- `src/hooks/` — `use-keyboard` (key→GBA button mapping), `use-rom-loader` (ROM fetch/upload/auto-load), `use-saves` (IndexedDB auto-sync + cloud save/load), `use-virtual-dpad` (touch joystick), `use-touch-speed` (double-tap fast-forward)
- `server/` — `index.ts` (Express app), `saves.ts` (save file CRUD), `rom.ts` (ROM file CRUD)

### Input systems

Two parallel input paths: `useKeyboard` for desktop (arrow keys, X/Z/A/S, Enter/Backspace, Space for fast-forward) and `TouchControls`/`useVirtualDpad` for touch devices (joystick zone with 8-sector angle detection, 18px dead zone).

### Save system

Two layers: local (mGBA in-memory state slots + IndexedDB via `FSSync` every 30s and on `visibilitychange`) and cloud (binary save files to/from Express server).

### Styling

Single CSS file (`src/index.css`) with CSS custom properties. Three layout modes via media queries: desktop (`pointer: fine`), mobile portrait, mobile/tablet landscape. Fullscreen mode supported.

### Deployment

Docker two-stage build. `scripts/deploy.sh` rsyncs to target host and runs `docker compose up --build`. Named volume at `/app/saves` for persistence.

## Important Configuration

- `vite.config.ts`: mGBA WASM package excluded from Vite pre-bundling (`optimizeDeps.exclude`). PWA workbox caches files up to 50MB (for the WASM binary). Dev/preview servers set COOP/COEP headers.
- `tsconfig.app.json`: `erasableSyntaxOnly: true` for compatibility with Node's `--experimental-strip-types`.
- The Express server must set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on all responses — these are required for `SharedArrayBuffer` used by mGBA's WASM threads.

## Bot System

The `/catch <pokemon>` skill automates catching a specific Pokemon in Pokemon Ruby/Sapphire. Architecture:

- `src/bot/` — Bot engine (state machine), memory reader, game data (Ruby/Sapphire addresses), Pokemon DB (Gen 3)
- `src/hooks/use-bot.ts` — React hook exposing `window.startBot()`, `window.stopBot()`, `window.setBotAction()`, `window.getBotState()`
- `src/components/BotControls.tsx` — Status indicator shown when bot is active
- `skills/catch-pokemon.md` — Claude Code skill prompt for `/catch`

The bot walks on grass autonomously at 4x speed (zero LLM cost). When the target Pokemon appears, it pauses and exposes battle state as text via `window.botState`. Claude Code reads this text, decides an action (attack/throw ball), and injects it via `window.botAction`.

### Memory Reading

mGBA runs its emulation loop in a pthread (Web Worker with `SharedArrayBuffer`). On ARM/Apple Silicon, the weak memory model means the main thread sees **stale cached values** when reading `Module.HEAPU8` directly — the emulator thread writes without `Atomics`, so stores may never become visible to the main thread.

**Solution: save-state-based reading.** Instead of reading HEAPU8, the bot triggers a save state (slot 9), which serializes the emulator's full state from its own thread. The save state is a PNG with a custom `gbAs` chunk containing zlib-compressed state data. The bot extracts and decompresses this chunk, then slices out the EWRAM region at a known offset.

Key constants (in `src/bot/memory.ts`):
- **EWRAM base address**: `0x02000000` (256KB region)
- **EWRAM offset within save state**: `0x21000` — state layout is header+CPU+IO+video (~0x21000 bytes), then EWRAM (0x40000), then IWRAM (0x8000). Total decompressed state = 397,312 bytes (0x61000).

The `MemoryReader.refresh()` method must be called before each batch of reads to get fresh data. Each refresh takes a save state, reads the PNG from the emulator's virtual filesystem, parses PNG chunks to find `gbAs`, decompresses via `DecompressionStream('deflate')`, and caches the EWRAM slice.

### Game State Detection

**Battle detection** uses fingerprinting rather than flag checking:
- `gBattleTypeFlags` (0x239FC) is at a different address in EU ROMs — unreliable
- `gBattleMons` data **persists in EWRAM after battles end** (the game doesn't zero it), so simply checking for valid species/HP always returns true once you've been in one battle
- **Fix**: `getBattleFingerprint()` hashes enemy species+level+HP+maxHP+move1+playerHP. A fingerprint *change* indicates a new battle started. On bot start, an initial fingerprint is recorded; during walking, the bot compares current fingerprint against the last known one.
- **Battle exit** is timeout-based (not memory-based) — after pressing RUN, wait a fixed number of ticks, then record the new fingerprint and resume walking.

Key addresses (in `src/bot/game-data.ts`, from [pret/pokeruby](https://github.com/pret/pokeruby)):
- `gBattleMons`: `0x02024A80` — array of `BattlePokemon` structs (0x58 bytes each). Index 0 = player, index 1 = enemy.
- `gBattleOutcome`: `0x02024D26` — u8, values: 1=won, 2=lost, 4=ran, 7=caught
- `gSaveBlock1`: `0x02023A60` — bag data lives here; balls pocket at offset 0x600
- Species IDs are Gen 3 internal format — use `internalToNational()` from `pokemon-db.ts` (+25 offset for standard species)

### Button Input Timing

The bot injects inputs via `emulator.buttonPress()`/`buttonUnpress()` with careful timing:
- **B for text advancement**: During battle intro, press B (not A) to advance text boxes. B advances text identically to A but does NOT select menu items, preventing accidental FIGHT selection if the battle menu appears mid-press.
- **Menu readiness gap**: gBattleMons data is populated in memory during battle init, **before the UI transition completes**. The bot must wait for the menu to be visually interactive before sending navigation inputs. `executeRun()` presses B three times to dismiss any lingering text, then waits 500ms for the menu animation, before pressing Down+Right+A.
- **Async with re-entry guard**: All tick functions are async (for save-state decompression). A `tickInProgress` flag prevents overlapping ticks. Async button sequences (like `executeRun`) must be `await`ed to prevent concurrent ticks from sending conflicting inputs.
- **Gen 3 battle menu**: Uses clamped (non-wrapping) navigation — Down always moves to the bottom row, Right always moves to the right column. So Down+Right reaches RUN from any starting cursor position.
