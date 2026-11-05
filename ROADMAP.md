# Realms, Kings and Other Stuff — Roadmap, Technical Framework and Working Agreement

**Version 0.4d — 2026-11-05 — Status: ACTIVE (Phase 1 in progress — sessions 1–5 done)**

This document says *how* we build the game described in DESIGN.md, in what order, and how each chat session must behave. DEVLOG.md records what actually happened.

---

## Part A — Working agreement

### A.1 Roles

- **Omer** — designer and creative director. Decides what the game is, approves or rejects each phase, edits the map, tunes the numbers.
- **Claude** — implements, proposes, tests, documents. Never changes a DECIDED item in DESIGN.md on its own initiative. When something in the brief is ambiguous, Claude builds the simplest reading, marks it PROPOSED/placeholder, and asks.

### A.2 The three documents

| Document | Purpose | Who changes it |
|---|---|---|
| **DESIGN.md** | What the game is (the contract) | Claude edits only to record Omer's decisions or to add clearly-marked proposals |
| **ROADMAP.md** | How we build it, phases, tech, conventions, session protocol | Claude updates phase status; structural changes need Omer's OK |
| **DEVLOG.md** | What was done, session by session; current state; how to run; next step | Claude appends an entry every session, no exceptions |

The Project docs in the claude.ai Project ("Strategy Game") are the **canonical** copies. The same three files are committed to the code repository at the end of every session so that git history has them too. If the two ever disagree, the Project doc wins and the repo copy is overwritten.

### A.3 Session protocol — every future chat follows this

**Start of session**
1. Read DESIGN.md, ROADMAP.md and DEVLOG.md from the Project (`project_read`). The "Current state" block at the top of DEVLOG.md says where we are.
2. Attach and clone the repository `omerglickman/realms` (GitHub; see A.4). Run `npm install`, `npm test`, `npm run build` and confirm all pass before changing anything.
3. State in one or two sentences what this session will do, taken from "Next steps" in DEVLOG.md unless Omer says otherwise.

**During session**
4. Work in small, verifiable steps. Game rules go in `src/sim/`, rendering and UI in `src/ui/`, numbers in `data/`.
5. Anything not covered by a DECIDED item is implemented as a placeholder and marked as such in code comments and in the DEVLOG entry.
6. Run the tests and the headless simulation after any change to rules. Load the built `dist/realms.html` in a headless browser (Playwright, `file://` URL) and check for console errors before delivering.

**End of session (mandatory, even if the work is unfinished)**
7. Build passes; tests pass. If not, say so loudly in the DEVLOG entry.
8. Commit and push to the repository with a clear message.
9. Append a DEVLOG entry (template in DEVLOG.md) and update its "Current state" block: phase, what works, what is broken, exact next steps, open questions for Omer.
10. Mirror DESIGN.md / ROADMAP.md / DEVLOG.md into the repo (and the Project).
11. Deliver the playable build to Omer (see A.5).

### A.4 Where the code lives (DECIDED 2026-11-03)

**GitHub, private repository `omerglickman/realms`.** Claude handles every git operation; Omer never needs to touch it. Each session attaches the repo, clones it, works, commits and pushes. Omer can download the whole project at any time from the repository page ("Code → Download ZIP").

### A.5 How Omer plays each build (DECIDED 2026-11-03)

At the end of every session Claude builds and hands Omer **one self-contained file, `realms.html`**, which he opens in a browser straight from disk (no server, no install, works from a Dropbox folder on any computer). The build uses a single-file bundler setting so that it works over `file://`. Map files and saves are exported/imported as small JSON files through the browser's download/upload.

As a backup, Claude may also publish the same build as a private web page (artifact) so Omer can open it from anywhere.

Running locally (`npm run dev`) remains available if Omer ever wants it, but is not required.

---

## Part B — Technical framework

Written for a non-programmer first; the technical specifics follow.

### B.1 In plain terms

- The game runs **in a web browser**, like IMPERIUM did. No installer for the player.
- It is built with **TypeScript** (a language that catches many mistakes before the game runs) and **PixiJS** (a fast 2D drawing library) for the map. Menus, panels and reports are ordinary web page elements laid over the map, because text-heavy screens are much easier that way.
- **The rules of the game and the drawing of the game are kept strictly apart.** The whole state of a game — every hex, settlement, person, character — is one plain block of data. The rules are functions that take that data and produce the next turn. Three practical consequences:
  1. **Saving is free**: the state *is* the save file.
  2. **Every game is reproducible**: a game started from the same seed with the same actions plays out identically, so any bug can be replayed.
  3. **The game can run without graphics ("headless")**: Claude can run dozens of AI-vs-AI games in a minute and hand Omer a spreadsheet — how fast do cities starve, how often do levies win, which faction persona dominates. This is how a designer tunes a game without programming.
- **All the numbers live in data files, not in code.** Terrain yields, unit costs, building effects, resource spawn chances, institution prerequisites — all in editable `data/*.json` files. Omer (or any chat) can change a number without touching logic.
- **The map editor is part of the game** from the first phase.

### B.2 Stack (as installed in Session 1)

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript 5.9 (strict) | Catches errors early; same as IMPERIUM |
| Build / dev server | Vite 7 + `vite-plugin-singlefile` | Fast, simple; produces the one-file `realms.html` |
| Map rendering | PixiJS 8 | Proven on IMPERIUM (v7); handles 100k hexes with chunking and culling |
| UI panels | Plain HTML/CSS | Text-heavy UI is easier outside the canvas |
| Tests | Vitest 5 | Fast unit tests for the rules |
| Headless runner | `tsx` (`npm run sim`) | Runs `src/sim` in Node without a browser |
| Data | JSON in `data/` (CSV allowed for big tables) | Editable without code |
| Save format | JSON (download/upload + browser autosave) | State is already JSON |
| Random numbers | Seeded sfc32 PRNG, state stored inside `GameState` | Reproducibility |
| Pathfinding | A* on hexes; hierarchical (region graph) for long routes | Needed at 400×250 (Phase 2) |
| Simulation thread | Web Worker (from Phase 2 onward) | Keeps the UI smooth during AI turns |
| Hosting of code | GitHub `omerglickman/realms` | See A.4 |
| Node (for development only) | 22 | — |

### B.3 Architecture rules (binding for every session)

1. `src/sim/` contains **no rendering code** and does not import from `src/ui/`. It must run in Node without a browser.
2. The game state is **one plain, JSON-serializable object** (`GameState`). No classes with methods inside the state, no references that can't be serialized (use ids). Typed arrays are not used in state (plain `number[]`), so `JSON.stringify` is the save format.
3. All state changes go through **commands** (`{type: 'moveUnit', ...}`) applied by `sim`. The UI never mutates state directly. This gives undo-safe editing, replays, and a clean seam for the AI (which issues the same commands as the player). *(Command layer arrives with the map editor in Phase 0.)*
4. `endTurn(state)` is deterministic; all randomness comes from `state.rng`.
5. Hex grid conventions: **pointy-top hexes, axial coordinates (q, r) for math, "odd-r" offset storage** `(col, row)` for the rectangular map array, index = `row * width + col`. Follow the Red Blob Games reference. Never mix conventions. `src/sim/hex.ts` is the only place that knows the geometry.
6. Rule numbers come from `data/`; a hard-coded number in `sim` is a bug unless it is a pure mathematical constant.
7. **`data/terrain.json` is index-stable**: never reorder or remove entries, only append. Maps store terrain as the index.
8. Every rule module has tests. Every phase has a headless scenario test ("50 turns of 4 AI factions do not crash and population stays within sane bounds").
9. Performance budget: a 400×250 map must pan and zoom smoothly (target 60 fps on Omer's machine; the HUD shows fps); an AI turn for 10 factions on the test map must finish under 2 seconds on a normal laptop (to be measured each phase).

### B.4 Repository layout

```
/                 README.md, DESIGN.md, ROADMAP.md, DEVLOG.md (mirrors of Project docs)
/data             terrain.json, resources.json, units.json, buildings.json,
                  institutions.json, factions.json, names/…
/maps             testmap.json (the hand-edited map), generated drafts
/src/sim          state.ts, hex.ts, map.ts, mapgen.ts, rng.ts, terrain.ts, turn.ts,
                  (later) economy.ts, demography.ts, settlements.ts, units.ts,
                  combat.ts, characters.ts, diplomacy.ts, ai/…, commands.ts
/src/ui           app.ts, camera.ts, style.css, render/ (Pixi map, chunks, layers),
                  (later) panels/ (HTML), editor/ (map editor)
/src/headless     run.ts — CLI: `npm run sim -- --seed realms --width 160 --height 100 --turns 24`
/tests            one file per sim module + scenario tests
/dist             built game `realms.html` (git-ignored; delivered to Omer each session)
```

---

## Part C — Phases

Each phase ends with a **playable build**, a **DEVLOG entry**, and **Omer's sign-off**. A phase is not "done" until Omer says so. Session counts are rough guesses for planning only.

### Phase 0 — Skeleton and map — DONE, signed off by Omer 2026-11-04

Goal: see the world, edit the world.

- [x] Repository, Vite + TypeScript + PixiJS + Vitest set up; single-file build; headless runner skeleton. *(Session 1)*
- [x] Hex grid math with tests; rectangular map store sized up to 400×250. *(Session 1)*
- [x] Map rendering with chunking, culling, pan/zoom, terrain colours (placeholder art), hex coordinates on hover. *(Session 1)*
- [x] Noise-based draft generator with seed and size. *(Session 1 — crude; parameters not yet exposed in the UI)*
- [x] **Map editor** (terrain): palette, brush sizes 1/2/3/5, flood fill, pick, undo/redo, export/import `.json`, autosave. *(Session 3)* — resource placement comes with resources.
- [x] Command layer (`commands.ts`) — editor edits go through it. *(Session 3)*
- [x] Generator parameters (continents, islands, land %) and the chosen canvas frozen as `maps/testmap.json`. *(Session 2)*
- [x] Resource spawning from `data/resources.json` terrain weights; resource layer in map + file (v2); editor: resource palette/eraser, Spawn / Fill empty / Clear, glyph rendering, hover readout. *(Session 4)*
- [x] Save/load of the map (download/upload JSON). *(Session 3)*
- [x] First test map draft (~160×100) generated, saved to `maps/testmap.json`, and handed to Omer for editing. *(Session 2)*
- [x] Omer's edited map committed back as `maps/testmap.json` (revisions 1–2, Sessions 3b–3c). Repeat as he edits.
- [x] Omer spawns/places resources on the test map and exports it (→ revision 3, first v2 file with resources). *(Session 4c)*
- [x] **Phase 0 acceptance**: met in practice (three edit round-trips, 60 fps at 400×250) and signed off by Omer 2026-11-04.

**Acceptance**: Omer can generate a draft, paint it, save it, reload it; 400×250 renders smoothly on his machine. ✔

### Design session — Government & Institutions (before Phase 2)

A chat devoted to DESIGN §4.3: government forms, the institution list and prerequisites, the policy list and trade-offs, administrative capacity. Output: DESIGN.md §4.3 moved from PROPOSED to DECIDED and `data/institutions.json` drafted.

### Phase 1 — Settlements, people and food (≈ 3–4 sessions) — IN PROGRESS

Goal: a living economy with no enemies.

Progress: **Session 5 (2026-11-04)** — design decisions (zones, tiers incl. metropolis, contested hexes, water hexes, staffed buildings, migration) recorded in DESIGN v0.3; `demography.ts`, `economy.ts`, `settlements.ts`, four data files, `foundSettlement` command, headless scenario `npm run sim -- --scenario phase1`, 20 new tests. Remaining: factions data, settlements on the map + editor placement + zones drawn, panels, end-turn in the UI, buildings with effects, tuning. **Session 6 (2026-11-04)** — model scale ×3 applied (DESIGN §5.8) with a scale-invariance test. **Session 7 (2026-11-05)** — settlements placeable in the editor, zones drawn, hover + panel, end turn / run years, scenario files; player faction only (Omer's decision, DESIGN §4.8). **Session 8 (2026-11-05)** — UI pass: top bar, tabbed editor with Place/Pick, hover card, dotted influence edges, hatched worked hexes, population editing. **Session 9 (2026-11-05)** — Omer's starting position committed (`scenarios/start.json`, build opens on it); demographic realism knobs (PROPOSED) with a 60-year A/B on the start position.

Suggested order (each session ends with a build): (1) numbers first — propose the demographic and food model constants to Omer, build `demography.ts` + `economy.ts` in `src/sim` with a headless 20-year village/town/city scenario and a results table, *before any map UI*; (2) settlements and factions as data + on the map, editor placement, influence/work zones drawn; (3) buildings, build queue, panels, end-turn; (4) tuning with Omer against the headless curves.

- [~] Factions (data-defined; **6 on the test map**) with colours and a treasury; one player faction. *(Session 7: player faction only, by decision; the rest are added after Phase 3.)*
- [x] Settlements (village/town/city/metropolis) — entity, zones, contested hexes, parents (Session 5); drawn on the map and placeable in the editor (Session 7).
- [x] Demographic cohort model; births, deaths, aging; working hands; hunger; migration. *(Session 5)*
- [~] Economy loop: gather → consume → store → share done for food (Session 5); produce/trade/tax and roads later.
- [~] Buildings inside settlements — halls and granaries with hands (Session 5); starter list with effects and build queue: pending.
- [x] Turn structure: 12 months, harvest in Sept/Oct, yearly update in December. *(Session 5; winter effects belong to armies, Phase 4)*
- [~] Settlement panel, end-turn button, run-years, scenario save/load (Session 7); faction panel and yearly report: pending.
- [x] Headless scenario: 20 years, six cases; population and food curves. *(Session 5)*; `--scenario start` runs the real starting position with knob presets *(Session 9)*.

**Acceptance**: a faction with a city and several villages survives and grows over 20 years; a city with no villages starves. Omer can read why from the panels.

### Phase 2 — Units, movement and building the land (≈ 3 sessions)

Goal: expand and connect.

- Units carrying population; settlers found villages; work-bands build roads, forts, mills, extraction sites.
- Movement with terrain costs; A* pathfinding; hierarchical pathfinding if needed at scale.
- Groups (stack, split, move together).
- Fog of war (simple).
- Simulation moved into a Web Worker.
- Upgrading village→town→city as a player decision with requirements.
- Administrative capacity, government forms, and the first institutions and policies.

**Acceptance**: Omer can expand a faction from one city to a region of villages connected by roads, and feel the administrative ceiling.

### Phase 3 — Characters (≈ 2 sessions)

- Character generation from faction properties; skills, traits, age.
- Positions: ruler, offices, governors, commanders; effects wired into economy and order.
- Lifecycle: aging, death, heir and succession; loyalty/ambition as numbers (events later).
- Character panel and court screen.

**Acceptance**: appointing a good governor visibly improves a city; the ruler's death triggers a succession with consequences.

### Phase 4 — Warfare (≈ 3–4 sessions)

- Military unit roster from `data/units.json`; levies vs professionals; facility requirements; upkeep.
- Recruitment draws from settlement demographics and lowers working hands/order.
- Battle resolution v1 (point system + randomness + commander + terrain) with a readable battle report.
- Supply/attrition, sieges, raids.
- Public order and revolts (rebel factions).

**Acceptance**: a war between the player and a scripted enemy on the test map can be fought and won/lost; levying a village measurably hurts its food.

### Phase 5 — Diplomacy and AI (≈ 4–5 sessions)

- Relations, treaties, client and subjugated states; diplomacy screen.
- AI in layers: economic (build, grow, feed) → expansion (settle, roads) → military (defend, raid, conquer) → diplomatic. Faction personas.
- Victory condition and end screen.
- Headless balancing: 20 AI-only games, stats reviewed with Omer.

**Acceptance**: a full game from start to victory is playable against AI factions that expand, trade, and fight.

### Phase 6 — Polish and depth (open-ended)

Candidates, ordered by Omer: events, culture, migration, real procedural map generation, better art, music, tutorial/help, performance passes, naval units, save slots, and the long-term goal of **directly playable battles**.

---

## Part D — Conventions

- Commit messages: `phase0: map editor brush sizes` style — phase prefix, then what.
- Placeholder art is fine throughout; never block a phase on art.
- Every PROPOSED rule implemented as a placeholder carries a `// PLACEHOLDER (DESIGN §x.y)` comment.
- A design decision made in chat is written into DESIGN.md **in the same session**, moving the item from PROPOSED/OPEN to DECIDED with the date.
- Numbers in `data/` are the designer's domain: sessions may add fields but must not silently retune values Omer has set; retuning is logged.
- Headless-browser fps numbers are meaningless (software rendering); real performance is judged on Omer's machine via the HUD readout.

---

## Change log

- 0.4d (2026-11-05): Session 9 noted.
- 0.4c (2026-11-05): Session 8 noted.
- 0.4b (2026-11-05): Session 7 progress; Phase 1 checklist updated.
- 0.4a (2026-11-04): Session 6 (×3 scale) noted.
- 0.4 (2026-11-04): Phase 1 marked in progress with a checklist; Session 5 progress noted.
- 0.3 (2026-11-04): Phase 0 signed off; Phase 1 marked next with a suggested session order.
- 0.2b (2026-11-04): Phase 0 checklist updated through Session 4 (resources).
- 0.2 (2026-11-03): hosting (GitHub) and delivery (single HTML file) decided; stack versions recorded; Phase 0 checklist with progress; Government & Institutions design session added before Phase 2.
- 0.1 (2026-11-03): first draft.
