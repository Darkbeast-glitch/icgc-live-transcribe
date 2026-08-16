# Design

## Theme

Dark operator tool. The interface runs in a near-black environment to reduce eye strain during services, preserve operator night-vision, and feel like professional broadcast software. The projector output is a separate surface — full-screen, typographically centred, audience-facing.

## Color Palette

All values are in hex (Tailwind utility classes are the current token layer). No CSS custom properties defined — colors live in class names.

### Operator Console

| Role | Value | Usage |
|---|---|---|
| Body bg | `#0f172a` (slate-900) | Root background |
| Surface 0 | `#111113` | TopBar, deepest panels |
| Surface 1 | `#161619` | Detection cards |
| Surface 2 | `#1e1e22` | Inputs, secondary buttons, raised items |
| Surface hover | `#1a1a1e` / `#2a2a2f` | Hover states |
| Border subtle | `#252528` | Panel dividers, section borders |
| Border default | `#333338` | Input/button borders |
| Accent | `#f97316` (orange-500) | Primary CTA, live indicator dot, logo mark, active state highlight |
| Accent dim | `orange-500/20`, `orange-950/30` | Active queue item bg, ghost present button |
| Accent text | `#fb923c` (orange-400) | Hover text, LIVE WORD badge |
| Text primary | `#ffffff` | Headings, reference labels, active content |
| Text secondary | `#94a3b8` (slate-400) | Panel labels, control text |
| Text muted | `#64748b` (slate-500) / `#475569` (slate-600) | Verse preview, supporting copy |
| Text ghost | `#334155` (slate-700) | Empty state placeholders |
| Danger | `#f87171` (red-400) / `red-700` border | Clear/remove hover states |
| Range selection | `blue-500/20` with `blue-400` text | Verse range highlight in ChapterBrowser |

### Projector Output

The projector supports user-configurable themes (`buildTheme()`). The default ("classic"):

| Role | Value |
|---|---|
| Background | `linear-gradient(135deg, #0f0c29, #302b63, #24243e)` (deep purple) |
| Text | `#ffffff` |
| Reference / accent | `#f97316` (orange-500) — same as operator accent |
| Timer warning | `#f87171` (red-400) at ≤30s |

Background image support: user can set a photo bg with `bg-black/55` overlay when content is showing.

## Typography

No custom web font loaded. System font stack throughout:
```
-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
```

### Operator Console Scale

Extremely compact — this is a dense tool, not a reading surface.

| Use | Size | Weight | Notes |
|---|---|---|---|
| Panel labels, section headers | `text-xs` (12px) | `font-medium` (500) | Uppercase + `tracking-wide` for section kickers |
| Body copy / verse text in panels | `text-xs` (12px) | `font-normal` | |
| Supporting / muted text | `10px` | `font-normal` | Via `text-[10px]` |
| Logo wordmark | `text-sm` (14px) | `font-semibold` | `tracking-wide` |
| Session timer | `text-xs` font-mono | `font-medium` | Monospace for stable width |

### Projector Scale

Responsive `clamp()` — designed for 1280×720 minimum, up to 4K.

| Use | Size | Weight | Notes |
|---|---|---|---|
| Verse / lyric body | `clamp()` per fontSize preset (sm/md/lg/xl) | `font-light` (300) | `lineHeight: 1.55`, user-configurable |
| Reference label | `clamp(0.9rem, 2vw, 1.3rem)` | `font-semibold` | `tracking-widest uppercase` |
| Translation label | `text-sm` | `font-normal` | `tracking-widest uppercase`, 70% opacity |
| Timer display | `clamp(6rem, 18vw, 14rem)` | `font-weight: 200` | `letter-spacing: -0.03em`, tabular-nums |
| Timer label | `clamp(1rem, 2.5vw, 1.8rem)` | `font-normal` | `tracking: 0.12em uppercase` |
| Blank watermark | `text-sm` | `font-normal` | `tracking-widest uppercase`, 7% opacity |

Reference decoration: a 64px `h-px` horizontal rule on each side of the reference text in the projector's accent color.

## Spacing

Base unit: 4px (Tailwind default). The operator console is intentionally tight.

- **TopBar height**: 48px (`h-12`)
- **Panel padding**: `px-3 py-2` for section headers
- **Item padding**: `px-3 py-2` for list rows
- **Card padding**: `p-2.5` for detection cards
- **Gap between controls**: `gap-1` to `gap-2.5`
- **Projector content padding**: `px-16` horizontal, centred vertically

## Border Radius

| Element | Radius |
|---|---|
| Inputs, buttons | `rounded` (4px) |
| Logo mark | `rounded-md` (6px) |
| Badge / tag | `rounded` (4px) with `px-1.5` |
| Count badge | `rounded-full` |
| Detection cards | `rounded-xl` (12px) |
| Detection action buttons | `rounded-lg` (8px) |

No card-level over-rounding. 12px is the ceiling.

## Motion

### Operator Console

- **Button/input state changes**: `transition-colors` (Tailwind default, 150ms ease)
- **Live indicator pulse**: `animate-pulse` on orange dot in active queue item
- No layout animations. No entrance animations.

### Projector Output

- **Content crossfade**: A/B slot system. New content loads into the inactive slot, then slots swap via `opacity 600ms ease-in-out`. This gives a smooth dissolve between verses without layout reflow.
- **Timer hide**: `opacity 400ms ease` when content replaces timer
- **Timer color change**: `color 500ms ease` when dropping to warning red at ≤30s

`@media (prefers-reduced-motion: reduce)` not yet applied to projector transitions — this is a known gap.

## Components

### TopBar

`h-12 bg-[#111113] border-b border-[#252528]`. Three zones: logo left (`w-52`), session timer center, controls right (`w-52`). Logo mark is a `w-7 h-7 bg-orange-500 rounded-md` with "C" letterform.

### Panel Sections

Consistent pattern: `flex flex-col`, section header row `px-3 py-2 shrink-0` with `border-b border-[#252528]`, scrollable body below. No cards wrapping panels — flat structure.

### Buttons

Three variants:
1. **Primary** (present/CTA): `bg-orange-500 hover:bg-orange-400 text-white`
2. **Secondary** (preview/queue): `bg-[#1e1e22] hover:bg-[#252528] border border-[#333338]`
3. **Ghost danger** (clear/remove): no background, `hover:text-red-400`

Icon buttons: `w-6 h-6 flex items-center justify-center` — square touch targets.

### Queue Item

`flex items-center gap-2 px-3 py-2 border-b border-[#1e1e22]`. Active state: `bg-orange-950/30` + orange pulse dot. Always-visible action row (Preview · Present ▶ · ✕).

### Detection Card

`p-2.5 bg-[#161619] border border-[#252528] rounded-xl`. Orange dot + reference + excerpt + three action buttons in a row.

### Inputs / Selects

`bg-[#1e1e22] border border-[#333338]`, `focus:border-orange-500`. Text `text-xs` to match panel density.

### Scrollbar

Custom: `width: 6px`, track `#1e293b`, thumb `#475569 border-radius: 3px`.

## Layout

The operator console is a single-screen `100vh` flex layout with no scroll on the root:

```
┌─────────────────────────────────────────────────────────┐
│ TopBar (h-12)                                           │
├──────────────┬──────────────────────────┬───────────────┤
│              │                          │               │
│  Left panel  │   Center (main content)  │  QueuePanel   │
│  (tabs/nav)  │                          │  (w-72)       │
│              │                          │               │
└──────────────┴──────────────────────────┴───────────────┘
```

- Panel widths are fixed (`w-72`, `w-52`, etc.) — no responsive breakpoints (Electron desktop only)
- `overflow: hidden` on root, `overflow-y-auto` only on scrollable list bodies
- `shrink-0` on fixed-height elements to prevent flex compression

## Z-Index

No defined z-index scale. Current usage:
- Projector background: `absolute inset-0` (implicit 0)
- Projector content: `z-10` (text container)
- Projector timer overlay: `z-20`

## Known Design Gaps

- No CSS custom properties / design tokens — colors are hardcoded hex in Tailwind classes. Hard to retheme.
- `prefers-reduced-motion` not applied to projector crossfade transitions.
- No focus-visible ring style defined for keyboard navigation.
- Font system stack only — no brand typeface to differentiate the operator UI.
- Projector blank state watermark uses `opacity: 0.07` — likely below minimum visibility for any practical use.
