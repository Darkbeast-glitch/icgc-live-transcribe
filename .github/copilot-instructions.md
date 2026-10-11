# Copilot instructions for ICGC FMT Live Word

## Project overview

This repository is an Electron desktop app for church services. The operator console is one window; the projector output is a second window that shows a clean, full-screen congregation view. Content is staged in preview and only sent live on an explicit operator action.

This is a workflow-heavy app, not a standard CRUD web app. The codebase is organized around live display, service planning, scripture detection, and vMix/broadcast output.

## Build, test, and validation commands

Use the repo's actual scripts from `package.json`:

```bash
npm run dev          # electron-vite dev; opens the operator and projector windows
npm run build        # production build; the repo's verification step
npm run preview      # preview the built Electron app
npm run package      # build + electron-builder for the current platform
npm run package:win  # build + Windows NSIS installer
npm run package:mac  # build + macOS DMG installer
```

Important notes:

- There is no configured test suite and no lint script in this repo.
- `npm run build` is the main validation command to run after changes.
- Avoid relying on a bare `npx tsc --noEmit` as a project check; the repo intentionally has a `window.api` typing quirk in raw TypeScript invocations, while the Vite/Electron build resolves it correctly.

## High-level architecture

The project follows the standard Electron split:

- `electron/main/` — Node.js main process, database setup, IPC handlers, window management, and output integration.
- `electron/preload/` — exposes a sanitized `window.api` bridge to renderer windows.
- `src/renderer/operator/` — React app for the operator console.
- `src/renderer/projector/` — React app for the congregation-facing display.
- `src/renderer/shared/` — shared types, themes, note sanitization, and scripture detection logic.

Key runtime flow:

- The operator UI sends display commands to the main process over IPC.
- The main process forwards display content to the projector window and also broadcasts it to vMix output.
- The projector never sends content back to the operator; the display pipeline is intentionally one-way.

Core handlers in `electron/main/handlers/`:

- `bible.ts` — verse/chapter lookup with local SQLite first, then remote fallback sources.
- `songs.ts` — song CRUD, FTS search, and lyrics loading.
- `semantic.ts` — Smart Search embedding index (`Xenova/all-MiniLM-L6-v2`).
- `whisper.ts` — local speech-to-text (`@xenova/transformers` Whisper model).
- `vmix-output.ts` — vMix HTTP/WebSocket output on port 7788.
- `export.ts` — service export.

Data layer:

- SQLite via `better-sqlite3` under the app's user data directory.
- Schema is created idempotently at startup in `electron/main/database.ts`.
- Related tables include `bible_verses`, `songs`, `songs_fts`, and `service_history`.
- Offline Bible data is cached locally before a service for reliability.

If a new display type is added, update all four places involved in the flow:

1. the main-process IPC handler in `electron/main/index.ts`
2. the preload bridge in `electron/preload/`
3. the shared type in `src/renderer/shared/types.ts` (`ActiveDisplay`)
4. the projector rendering branch in `src/renderer/projector/App.tsx`

## Key repository conventions

### Preview is not live

This is the most important workflow rule in the app. `onPreview` stages content while `onPresent` sends it to the congregation. Do not wire automatic or incidental actions to the live path. A wrong slide in front of a live congregation is the major failure mode the app is designed to avoid.

### EasyWorship is the reference workflow

The project deliberately borrows the workflow conventions of EasyWorship, especially:

- live/preview split
- service plan as the spine of a service
- library vs running order separation
- operator console + projector output model
- per-verse/per-slide stepping with easy out-of-sequence control

The visual language is not meant to mimic EasyWorship; the workflow is the reference.

### Projector rendering and capture constraints

Some runtime rules are load-bearing:

- `app.disableHardwareAcceleration()` in `electron/main/index.ts` is required for projector capture to work in vMix/OBS/NDI.
- `projectorWindow.webContents.setBackgroundThrottling(false)` is required to prevent Chromium from throttling the unfocused projector window.

Do not remove these without an explicit reason and verification.

### Styling conventions

The project uses Tailwind utility classes with hard-coded hex colors and explicit spacing/typography values. The repo has a design book in `DESIGN.md`; match the values there instead of inventing near-neighbor shades or tokens.

### Sanitization and safety

Notes and user-generated rich text are sanitized before rendering through `src/renderer/shared/sanitizeNoteHtml.ts`. Preserve this behavior when modifying note content or rendering note HTML.

### Local ML and offline behavior

The app intentionally keeps transcription and embeddings local. The Whisper and embedding models are downloaded to a user-data cache and run on-device. Progress streaming events exist for first-load model downloads (`whisper:progress`, `semantic:model-progress`).

### Product-specific UX patterns

- The operator can browse freely while content is live; the Chapter Browser is intentionally not tightly synchronized with the active display state.
- The service plan and library are separate data flows; keep that mental model when changing search or planning features.
- When changing scripture detection or matching logic, remember these features are tuned for Ghanaian speech patterns and local phrasing.

## Relevant docs and existing guidance

- `README.md` — product overview, feature set, install and quick-start workflow
- `PRODUCT.md` — user goals and product principles
- `DESIGN.md` — project visual system and color/typography guidance
- `CLAUDE.md` — existing repo-specific AI guidance; keep its product and workflow conventions aligned with future changes

## Working style for this codebase

When making changes, prefer updates that match the app’s service-flow mental model rather than generic web-app patterns. In practice, that means preserving:

- preview-before-live behavior
- one-way push-to-projector flow
- direct integration with vMix and local output
- a dark, broadcast-oriented UI optimized for legibility at a distance
