# Product

## Register

product

## Users

Church AV operators and worship tech teams at ICGC FMT (International Central Gospel Church, Fidel Memorial Temple) and similar Ghanaian churches. They sit at a laptop during a live service — one eye on the screen, one ear on the preacher — and need to push the right scripture or lyric to the projector within seconds. They are not developers; they are deacons, volunteers, and church media staff. They work under pressure, in low-light environments, often with no second chance.

Secondary surface: the congregation, who sees the projector output. That surface needs to feel reverent, readable at distance, and on-brand with the church's identity.

## Product Purpose

ICGC FMT Live Word is an Electron desktop app that lets a church operator display Bible scriptures and song lyrics on a projector screen during live services. It listens to the preacher via microphone, auto-detects scripture references from speech (including Ghanaian accent patterns and possessive/spoken forms), and queues them for one-click display. The operator can also manually search, browse by chapter, select verse ranges, manage a service queue, show notes and media, and push content to vMix via WebSocket or XML DataSource.

Success looks like: the operator never misses a reference, the congregation always sees what the preacher is reading from, and the system never crashes mid-service.

## Brand Personality

Reliable, focused, fast. This is a tool that earns trust by never failing in the moments that matter. It doesn't call attention to itself — the worship experience does. The interface should feel like a professional broadcast tool that happens to be built for a church: dark, precise, responsive, with just enough warmth in the accent color to signal that this is a sacred space, not a trading terminal.

## Anti-references

- **Generic SaaS dashboard** — cream backgrounds, rounded cards everywhere, gradient text, hero metrics. AI-default aesthetic that reads as corporate product, not ministry tool.
- **Old church presentation software** — Windows-era clunkiness, poor visual hierarchy, Comic Sans energy. Feels amateur.
- **Consumer social apps** — Instagram/TikTok vibes. Too casual and playful for a broadcast control surface.
- **Cold corporate tools** — Dark navy + data tables that feel like accounting software. Removes the warmth the church context requires.

## Design Principles

1. **Never fail during service.** Every interaction should be obvious and fast. No modals that block, no hidden controls, no states that require explanation. If the operator has to think, we've lost.
2. **The operator is the conductor.** The interface surfaces what the preacher is saying and gets out of the way. AI detection is an assist, never an override.
3. **Warmth through restraint.** The orange accent is the only warmth. Everything else earns its place by being useful. Don't decorate — refine.
4. **Both screens matter.** The operator console is a tool; the projector output is a congregation experience. They share a brand but serve different masters: speed vs. legibility at distance.
5. **Built for Ghana.** Accent patterns, local musician lyrics, possessive scripture references, corrections mid-sentence — the product knows its users' speech and context.

## Accessibility & Inclusion

- Operator console: must be usable in low-light environments (already dark-themed). High contrast between active/inactive states is critical — operators glance, not read.
- Projector output: text must be readable from 10–30 meters. Large type, high contrast against dark backgrounds, no decorative flourishes that reduce legibility.
- WCAG AA minimum for interactive elements. Keyboard navigation for the operator console (operators sometimes tab when hands are full).
- Reduced motion: the projector output animates verse transitions — these must respect `prefers-reduced-motion`.
