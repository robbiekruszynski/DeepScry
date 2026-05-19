# DeepScry

DeepScry is a browser-based toolkit for **Magic: The Gathering Commander** decks. Paste a decklist, resolve every card through [Scryfall](https://scryfall.com), and explore structure, odds, and play patterns in one place—without leaving the tab.

The app is aimed at deckbuilders who want quick, visual feedback: land counts, curve shape, color identity checks, opening-hand practice, and budget-aware swap ideas.

## What it does

### Import

- Paste a plain-text decklist (the formats used by **Moxfield**, **Archidekt**, and **EDHREC** work well).
- Set your commander and an archetype label (used for heuristics).
- Cards are resolved against Scryfall with progress feedback; import drafts are saved in `localStorage` so you can come back later.

### Overview

After a deck loads, the Overview tab summarizes the list:

- Commander preview, grouped decklist, and basic stats (lands, average CMC, creatures, ramp, interaction).
- **Deck health** notes and comparison scores against common Commander power “benchmarks” (heuristic targets, not live tournament data).
- **Commander legality** — off-color cards for the chosen commander’s color identity.
- **On-curve mana odds** — simulated probability of hitting enough lands by turns 1–4.
- **Budget tuner** — suggests cheaper replacements within a per-card price ceiling, with live USD pricing and purchase links when available.

### Hand (goldfish)

A lightweight playtest surface inspired by Moxfield-style sandboxes:

- Draw opening hands, get keep/mulligan guidance, shuffle, and advance turns.
- Drag cards on a free-form battlefield, tap/untap, and move cards between hand, library, graveyard, exile, and the command zone.
- No full rules engine—this is for feel and visualization, not adjudicated games.

### Curve

Charts for mana curve and card-type distribution built from the imported list.

### Probabilities

Hypergeometric odds for drawing tagged categories (ramp, interaction, draw, wincon) by turn. Tags combine automatic text heuristics with manual overrides per card.

## Tech stack

- [Next.js](https://nextjs.org) 14 (App Router) + React 18 + TypeScript
- [Tailwind CSS](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com)-style components
- [Chart.js](https://www.chartjs.org) for curve charts
- [Scryfall API](https://scryfall.com/docs/api) for card data, images, and prices (via server routes with rate limiting)

## Getting started

**Requirements:** Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use the **Import** tab to paste a decklist and load your commander.

Other scripts:

```bash
npm run build   # production build
npm run start   # run production server
npm run lint    # ESLint
```

## Project layout

| Path | Purpose |
|------|---------|
| `src/components/scry/` | Main app UI (tabs, import, overview, hand sandbox, etc.) |
| `src/lib/deck.ts` | Deck model, parsing, archetypes |
| `src/lib/deck-import.ts` | Import pipeline |
| `src/lib/scryfall.ts` | Scryfall client helpers |
| `src/lib/stats.ts` | Card classification heuristics |
| `src/lib/commander-tools.ts` | Benchmarks, warnings, mulligan advice, simulations |
| `src/lib/analysis.ts` | Probability calculations |
| `src/app/api/scryfall/` | Proxied Scryfall card/collection endpoints |

## Data and disclaimers

- Card names, images, and prices come from Scryfall and may be incomplete or stale.
- Benchmark scores, health warnings, mulligan tips, and budget suggestions are **heuristics for deckbuilding**, not guarantees of performance at any table.
- DeepScry is not affiliated with Wizards of the Coast, Scryfall, or third-party deck sites.

## License

Private project (`"private": true` in `package.json`). Add a license file if you plan to open-source or distribute the app.
