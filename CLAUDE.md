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

- `src/bot/` — Bot engine (state machine), memory reader (EWRAM via HEAPU8), game data (Ruby/Sapphire addresses), Pokemon DB (Gen 3)
- `src/hooks/use-bot.ts` — React hook exposing `window.startBot()`, `window.stopBot()`, `window.setBotAction()`, `window.getBotState()`
- `src/components/BotControls.tsx` — Status indicator shown when bot is active
- `skills/catch-pokemon.md` — Claude Code skill prompt for `/catch`

The bot walks on grass autonomously at 4x speed (zero LLM cost). When the target Pokemon appears, it pauses and exposes battle state as text via `window.botState`. Claude Code reads this text, decides an action (attack/throw ball), and injects it via `window.botAction`.
