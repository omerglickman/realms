# Realms, Kings and Other Stuff — Roadmap, Technical Framework and Working Agreement

**Version 0.5 — 2026-11-05 — Status: ACTIVE (Phase 1 in progress — sessions 5–12 done; working agreement revised in Session 12b)**

This document says *how* we build the game described in DESIGN.md, in what order, and how each chat session must behave. DEVLOG.md records what actually happened.

---

## Part A — Working agreement

### A.1 Roles

- **Omer** — designer and creative director. Decides what the game is, approves or rejects each phase, edits the map, tunes the numbers.
- **Claude** — implements, proposes, tests, documents. Never changes a DECIDED item in DESIGN.md on its own initiative. When something in the brief is ambiguous, Claude builds the simplest reading, marks it PROPOSED/placeholder, and asks.

### A.2 The three documents

| Document | Lives | Purpose | Who changes it |
|---|---|---|---|
| **DESIGN.md** | Project + repo | What the game is (the contract). Rules and decisions only — findings and implementation notes go in the DEVLOG | Claude edits only to record Omer's decisions or to add clearly-marked proposals |
| **ROADMAP.md** | Project + repo | How we build it, phases, tech, conventions, working agreement | Claude updates phase status; structural changes need Omer's OK |
| **DEVLOG.md** | Project + repo | A **Current state** block (overwritten each session; under ~6 KB; present tense, by feature, no session history) + one entry per session with the detail, the findings and the measurements | Claude, every session, no exceptions |
| **DEVLOG-archive.md** | Project + repo | Older session entries | Moved in batches (below) |
| **CLAUDE.md** | repo | The session protocol in short, the commands, the close checklist | Claude, with Omer's OK for protocol changes |
| **ARCHITECTURE.md** | repo | Module map, turn order, data files, state versions — updated **in place**, never by session | Claude, whenever a module's job changes |

**Archive rule (Omer, 2026-11-05):** every fifth session (15, 20, 25…), and sooner if DEVLOG.md passes ~45 KB, the closing step moves every entry except the last three sessions into DEVLOG-archive.md, unedited and in order. The Current state block is always complete on its own.

**Why the split (Session 12b):** mirroring a doc to the Project requires reading it in full, so every kilobyte in the three Project docs is read at least twice a session. The Project docs therefore stay small and are read selectively (A.3); the repo docs carry the detail a session needs only when it touches a module.

The Project docs in the claude.ai Project ("Strategy Game") are the **canonical** copies. The same files are committed to the code repository at the end of every session so that git history has them too. If the two ever disagree, the Project doc wins and the repo copy is overwritten.

### A.3 Session protocol — every future chat follows this

**Start of session** (revised Session 12b — the short form is the repo's CLAUDE.md)
1. Read the **Current state** block of DEVLOG.md from the Project; the latest entry only if Current state points at it.
2. Clone `omerglickman/realms` (A.4); read **CLAUDE.md** and the parts of **ARCHITECTURE.md** the session will touch. Run `npm install`, `npm test`, `npm run build` — all green before changing anything.
3. Read **DESIGN.md by section** (the §§ the session implements); in full only in a design session. Read ROADMAP.md at phase boundaries or when the agreement is in question.
4. State in one or two sentences what this session will do, taken from Current state → Next steps unless Omer says otherwise. **One feature cluster per session** — the fixed cost of a session is the argument for fewer, not smaller, sessions, but scope creep is what makes one long.

**During session**
5. Work in small, verifiable steps. Game rules go in `src/sim/`, rendering and UI in `src/ui/`, numbers in `data/`.
6. Anything not covered by a DECIDED item is implemented as a placeholder and marked as such in code comments and in the DEVLOG entry.
7. Run the tests and the headless simulation after any change to rules; before delivering, `npm run build` and **`npm run smoke`** (headless Chrome over `dist/realms.html`; fails on console errors).

**End of session (mandatory, even if the work is unfinished)**
8. Build passes; tests pass. If not, say so loudly in the DEVLOG entry.
9. Commit and push with a clear message.
10. DEVLOG.md: overwrite the Current state block; append a session entry (template in DEVLOG.md) with what was done, how, the findings and measurements, what broke, next steps. Update ARCHITECTURE.md in place if a module's job changed. Record Omer's decisions in DESIGN.md the same session.
11. Mirror DESIGN.md / ROADMAP.md / DEVLOG.md (and DEVLOG-archive.md when it changed) to the Project and the repo.
12. Deliver the playable build to Omer (A.5).

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
| Smoke test | `scripts/smoke.py` (`npm run smoke`; Python Playwright + system Chrome) | Loads the built game headless, exercises the panels and a purchase, fails on console errors |
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
/                 README.md, CLAUDE.md, ARCHITECTURE.md; DESIGN.md, ROADMAP.md, DEVLOG.md, DEVLOG-archive.md (mirrors of Project docs)
/scripts          smoke.py (npm run smoke)
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

Progress: **Session 5 (2026-11-04)** — design decisions (zones, tiers incl. metropolis, contested hexes, water hexes, staffed buildings, migration) recorded in DESIGN v0.3; `demography.ts`, `economy.ts`, `settlements.ts`, four data files, `foundSettlement` command, headless scenario `npm run sim -- --scenario phase1`, 20 new tests. Remaining: factions data, settlements on the map + editor placement + zones drawn, panels, end-turn in the UI, buildings with effects, tuning. **Session 6 (2026-11-04)** — model scale ×3 applied (DESIGN §5.8) with a scale-invariance test. **Session 7 (2026-11-05)** — settlements placeable in the editor, zones drawn, hover + panel, end turn / run years, scenario files; player faction only (Omer's decision, DESIGN §4.8). **Session 8 (2026-11-05)** — UI pass: top bar, tabbed editor with Place/Pick, hover card, dotted influence edges, hatched worked hexes, population editing. **Session 9 (2026-11-05)** — Omer's starting position committed (`scenarios/start.json`, build opens on it); demographic realism knobs with a 60-year A/B on the start position; Omer decided the values (sampling on, harvest ±12.5 %, epidemics, trickle off) and automatic abandonment of emptied settlements. **Session 10 (2026-11-05)** — clusters (derived view, outlines, cluster and realm panels, yearly totals) and the tithe, with the finding that city hunger is a growth equilibrium, not a food shortage; 10b the granary brake. **Session 11 (2026-11-05)** — player-built buildings with effects and a build queue, materials (timber/stone/goods gathered by spare hands into cluster stockpiles, a surplus share to the realm stockpile, shipping), the pull factor into vacancies; finding: the pull is inert on the start position (DESIGN §5.10). **Session 12 (2026-11-05)** — the private economy (DESIGN §4.2b): private hands pay tax and make goods, money on every building, Workshop/Market as multipliers, Warehouse, stockpile caps with overflow to the realm, the pull factor on prosperity; findings: money does not bind yet, caps + shipping make stone move, the prosperity condition is what keeps the pull from starving the cities (DESIGN §5.11).

Suggested order (each session ends with a build): (1) numbers first — propose the demographic and food model constants to Omer, build `demography.ts` + `economy.ts` in `src/sim` with a headless 20-year village/town/city scenario and a results table, *before any map UI*; (2) settlements and factions as data + on the map, editor placement, influence/work zones drawn; (3) buildings, build queue, panels, end-turn; (4) tuning with Omer against the headless curves.

- [~] Factions (data-defined; **6 on the test map**) with colours and a treasury; one player faction. *(Session 7: player faction only, by decision; the rest are added after Phase 3.)*
- [x] Settlements (village/town/city/metropolis) — entity, zones, contested hexes, parents (Session 5); drawn on the map and placeable in the editor (Session 7).
- [x] Demographic cohort model; births, deaths, aging; working hands; hunger; migration. *(Session 5)*
- [~] Economy loop: gather → consume → store → share done for food (Session 5) and for timber/stone (Session 11: cluster stockpiles, realm stockpile, instant shipping placeholder; Session 12: caps, Warehouses); produce and trade (private hands → goods, sold into the treasury; Workshop/Market multipliers) and **tax on private hands** (Session 12); roads later.
- [x] Buildings inside settlements — halls and granaries with hands (Session 5); starter list with effects, military buildings as data, one-at-a-time build queue with cancel (Session 11); money + labour + materials + time on every building (Session 12).
- [x] Turn structure: 12 months, harvest in Sept/Oct, yearly update in December. *(Session 5; winter effects belong to armies, Phase 4)*
- [~] Settlement panel, end-turn button, run-years, scenario save/load (Session 7); realm panel with the treasury's yearly ledger and the realm stockpile (Sessions 10–12); a fuller yearly report: pending.
- [x] **Cluster view** (DESIGN §3.3, decided 2026-11-05): derived clusters, cluster outline on the map, cluster panel; realm report as the sum over clusters. *(Session 10)*
- [x] **Tithe** (DESIGN §4.2, decided 2026-11-05): 10 % in kind from subordinates; headless A/B on the start position. *(Session 10 — finding: it moves people from towns to cities, not hunger; see DEVLOG)*
- [x] **Pull factor** (DESIGN §4.1, decided 2026-11-05): 4 %/yr of spare hands to a fed parent with vacancies. *(Session 11 — inert on the start position; DESIGN §5.10)* → to a **prosperous** parent (fed with ≥ 4 spare months) *(Session 12 — fires; the prosperity condition halves the hunger the unconditional pull causes)*.
- [x] **Private economy** (DESIGN §4.2b, decided 2026-11-05): private hands → tax and goods; money costs; stockpile caps. *(Session 12 — money non-binding until sinks exist; DESIGN §5.11)*
- [ ] Tuning against the headless curves with Omer; **Phase 1 acceptance review**.
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

- 0.5 (2026-11-05, Session 12b): working agreement revised for shorter sessions — CLAUDE.md and ARCHITECTURE.md in the repo, Project docs kept small and read selectively, `npm run smoke`, one feature cluster per session (A.2, A.3, B.2, B.4).
- 0.4j (2026-11-05): Session 12 — private economy, money, caps, pull on prosperity done; Phase 1 checklist updated.
- 0.4i (2026-11-05): Session 11 — buildings, materials, pull factor done; Phase 1 checklist updated.
- 0.4h (2026-11-05): archive rule (A.2) agreed — every fifth session or past 45 KB.
- 0.4g (2026-11-05): Session 10 — cluster view and tithe done; DEVLOG-archive.md introduced (A.2).
- 0.4f (2026-11-05): Session 9c — cluster view and tithe added to the Phase 1 checklist.
- 0.4e (2026-11-05): Session 9b noted.
- 0.4d (2026-11-05): Session 9 noted.
- 0.4c (2026-11-05): Session 8 noted.
- 0.4b (2026-11-05): Session 7 progress; Phase 1 checklist updated.
- 0.4a (2026-11-04): Session 6 (×3 scale) noted.
- 0.4 (2026-11-04): Phase 1 marked in progress with a checklist; Session 5 progress noted.
- 0.3 (2026-11-04): Phase 0 signed off; Phase 1 marked next with a suggested session order.
- 0.2b (2026-11-04): Phase 0 checklist updated through Session 4 (resources).
- 0.2 (2026-11-03): hosting (GitHub) and delivery (single HTML file) decided; stack versions recorded; Phase 0 checklist with progress; Government & Institutions design session added before Phase 2.
- 0.1 (2026-11-03): first draft.
