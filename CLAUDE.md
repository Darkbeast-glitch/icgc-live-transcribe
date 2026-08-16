# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**ICGC FMT Live Word** — an Electron desktop app that displays Bible scriptures and
song lyrics on a projector during live church services. Built for ICGC FMT
(International Central Gospel Church, Fidel Memorial Temple) and similar Ghanaian
churches.

Its distinguishing feature: it listens to the preacher through the microphone,
auto-detects scripture references from speech, and queues them for one-click display.
The operator can also search manually, browse chapters, build a service plan, and push
output to vMix for broadcast.

See `PRODUCT.md` for users, purpose, and design principles; `DESIGN.md` for the visual
system (colors, type scale, spacing).

## Reference product: EasyWorship

**EasyWorship is the reference app for this project.** It is the software most church AV
teams already know, and it defines the mental model our operators arrive with. When
designing a feature or resolving an interaction question, ask first: *how does
EasyWorship do this, and is there a reason to differ?*

What we deliberately take from it:

- **Live / Preview split.** Content is staged in a preview pane and only reaches the
  audience on an explicit operator action. Nothing goes live on a keystroke or an
  automatic trigger. This is the single most important borrowed convention — see
  "Preview is not Live" below.
- **The service plan as the spine of a service.** A pre-built ordered list of items
  (scriptures, songs, media, notes) the operator walks down, rather than searching from
  scratch mid-service. This is `ServicePlanner.tsx`.
- **Schedule / library separation.** A searchable library of songs and scriptures on one
  side, the running order for *this* service on the other.
- **Two-window operator + output model.** One control surface for the operator, one
  clean full-screen surface for the congregation, on a second display.
- **Per-slide / per-verse advancing**, with the operator always able to jump out of
  sequence.

Where we deliberately differ:

- **Speech-driven detection.** EasyWorship has nothing equivalent. Live transcription
  and auto-detection of spoken references is this app's reason to exist. It stays an
  *assist* — detected references land in a queue, never on screen by themselves.
- **Ghanaian-context aware.** Accent patterns, possessive spoken forms ("the book of
  John"), local musicians' lyrics. See `scriptureDetector.ts`.
- **Visual language.** EasyWorship's Windows-era chrome is an explicit anti-reference in
  `PRODUCT.md`. Borrow its *workflow*, not its *look*. Our surface is dark, dense, and
  broadcast-like.
- **vMix-native output.** WebSocket and XML/JSON DataSource endpoints are first-class,
  not an afterthought.

When a proposed change would make the app behave in a way that would surprise someone
who has run EasyWorship for years, that's a cost worth naming explicitly, even if we go
ahead anyway.

## Commands

```bash
npm run dev          # electron-vite dev — hot reload, opens both windows
npm run build        # type-aware build into out/
npm run package      # build + electron-builder for the current platform
npm run package:win  # NSIS installer (the main distribution target)
npm run package:mac  # DMG, arm64 + x64
```

There is no test suite and no linter configured. `npm run build` is the verification
step — run it after changes.

`npx tsc --noEmit` reports `Property 'api' does not exist on type 'Window'` across every
renderer file. This is a false positive: `window.api` is declared in
`src/renderer/shared/env.d.ts`, which a bare `tsc -p` invocation doesn't pull in. The
vite build resolves it correctly. Don't "fix" these errors.

## Architecture

Three processes, standard Electron split:

```
electron/main/          Node — DB, network, IPC hub, window management
electron/preload/       contextBridge — exposes window.api to renderers
src/renderer/operator/  React — the operator console (index.html)
src/renderer/projector/ React — the congregation-facing output (projector.html)
src/renderer/shared/    types, themes, scripture detection, sanitizers
```

**Content flows one way:** operator renderer → IPC → main → projector renderer, and
simultaneously → vMix WebSocket broadcast. The projector never sends content back. See
the `display:show-verse` / `display:show-lyrics` / `display:clear` handlers in
`electron/main/index.ts`.

Adding a new display type means touching four places: the IPC handler in
`electron/main/index.ts`, the bridge in `electron/preload/`, the type in
`shared/types.ts` (`ActiveDisplay`), and the render branch in `projector/App.tsx`.

### Main-process handlers

| File | Responsibility |
|---|---|
| `handlers/bible.ts` | Verse/chapter lookup. Local SQLite first, then remote APIs. |
| `handlers/songs.ts` | Song CRUD + FTS5 search, lyrics fetching |
| `handlers/semantic.ts` | Embedding index for Smart Search (`Xenova/all-MiniLM-L6-v2`) |
| `handlers/whisper.ts` | Local speech-to-text (`Xenova/whisper-base.en`) |
| `handlers/vmix-output.ts` | HTTP + WebSocket server on port **7788**, XML/JSON DataSource |
| `handlers/export.ts` | Service export |

### Data

SQLite via `better-sqlite3` at `<userData>/data/church.db`, WAL mode. Tables:
`bible_verses`, `songs` (+ `songs_fts` FTS5 virtual table), `service_history`. Schema
lives in `electron/main/database.ts` and is created idempotently on boot.

Bible text has three sources, in order: local `bible_verses` rows → `bible-api.com` (KJV,
WEB, ASV, NASB, BBE, YLT, DARBY) → API.Bible (NIV, NLT, NKJV) and the ESV API. KJV can be
bulk-downloaded for offline use from Settings — **do this before a service**, since the
building's WiFi is not a dependency you want on a Sunday.

Note: API keys for API.Bible and ESV are currently hardcoded in `handlers/bible.ts`.

### ML models

Both Whisper and the embedding model are `@xenova/transformers` models downloaded on
first use into a cache dir, then run locally. No audio or query text ever leaves the
machine. First load is slow and must show progress — `whisper:progress` and
`semantic:model-progress` IPC events exist for this.

## Conventions that matter here

**Preview is not Live.** `onPreview` stages content; `onPresent` puts it in front of the
congregation. Never wire an automatic or incidental action to `onPresent` — not a
keystroke, not a search result, not a detection. A wrong slide in front of 800 people
during a sermon is the failure mode this whole app is organised around avoiding. When in
doubt, preview.

**The operator browses freely while content is live.** `ChapterBrowser` intentionally
does *not* follow `activeVerse` — see the comment at the top of the component. Don't
"fix" this by syncing them; it locks the browser whenever something is presented.

**Styling is Tailwind utility classes with hardcoded hex values.** There are no CSS
custom properties and no token layer. Match the exact values in `DESIGN.md` rather than
picking a near-neighbour slate shade.

**Projector legibility beats projector cleverness.** That surface is read from 10–30
metres. Large type, high contrast, no decoration that costs readability. Animations must
respect `prefers-reduced-motion`.

**`app.disableHardwareAcceleration()` is load-bearing** (`electron/main/index.ts:16`).
Removing it makes the projector window capture as black in vMix/OBS/NDI. Same for
`setBackgroundThrottling(false)` on the projector window — without it, Chromium throttles
the unfocused output window mid-service.

**HTML from notes is sanitized** through `shared/sanitizeNoteHtml.ts` before rendering.
Keep it that way.

## Known rough edges

- The Book/Chapter/Verse reference form lives inside the **✨ Smart Search** tab under a
  "By Reference" toggle, which makes it hard to find from the Scripture tab. Reorganising
  this is pending a decision.
- Three separate paths reach a verse (Scripture-tab search bar, Scripture-tab verse list,
  Smart Search "By Reference"). At least one too many.
- API keys are committed in source.
