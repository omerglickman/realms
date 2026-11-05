# Realms — Architecture and module map

Repo-only document (not mirrored to the Project). Updated **in place** whenever a module's job changes; it never grows by session. Read the part you need; the code and tests are the record of detail. Rules that bind every module are in ROADMAP.md Part B.

## The shape

- **`src/sim/`** — the rules. No rendering, no DOM; runs in Node. The whole game is one plain JSON object (`GameState`); every change goes through a command; `endTurn(state)` is deterministic (all randomness from `state.rng`). Numbers come from `data/*.json`, never from code.
- **`src/ui/`** — PixiJS map + plain-HTML panels. Reads the state, never mutates it except through `editor.execute(command)` (undo, autosave).
- **`src/headless/`** — CLI runners that import `src/sim` only.
- **`data/`** — the designer's numbers. `terrain.json`, `resources.json`, `settlements.json` tiers are **index-stable** (append only).
- **`maps/testmap.json`** — the canonical map ("vinral", 160×100, format `realms-map` v2). **`scenarios/start.json`** — Omer's starting position (a whole `GameState`, format `realms-scenario` v1); the build opens on it.
- **`tests/`** — one file per sim module + scenario tests (Vitest). Tests zero the noise knobs (`setNoise(NO_NOISE)`) and usually abandonment (`setAbandonBelow(0)`).

## Turn order (one month)

`turn.ts endTurn` → `economy.ts economyMonth` (January: harvest factors; per settlement in rank order — villages before towns before cities: plan labour → produce → tithe up → consume + hunger → gather, tax, goods, sales, construction → spoil & cap; then the cluster stockpile-cap pass; surplus up; abandonment; famine migration; yearly totals) → in December `demographyYear` (epidemic roll, births/deaths/aging with the granary brake, the pull factor, faction year roll-over, pop history).

## `src/sim/` — one line each

| File | Job |
|---|---|
| `state.ts` | `GameState` (version 5), `createGameState`, `calendar`, `logEvent`, serialize/deserialize with migrations v1→v5 |
| `rng.ts` | seeded sfc32: `seedRng`, `nextFloat`, `nextU32`, `nextGaussian` |
| `hex.ts` | pointy-top hexes, axial ↔ odd-r offset, rings, distance — the only file that knows geometry |
| `map.ts` / `mapfile.ts` | `MapData` (terrain + resource index arrays), bounds, neighbours; map file v2 read/write |
| `mapgen.ts` | the noise draft generator (new drafts only — the test map is a file) |
| `terrain.ts` / `resources.ts` | `TERRAIN` (fertility/pasture/timber 0–4, passability), `RESOURCES` with spawn weights and spacing |
| `water.ts` | `isShore` (sea touching land), `isFishable` |
| `settlements.ts` | `Settlement`, `TIERS`, `BUILDINGS` + `buildingDef`, `BuildProject`, `SettlementReport` (last month), `YearTotals` (running year / `lastYear`), work & influence zones, contested-hex assignment (`workedCellsBySettlement`), parent resolution, `settlementsByRank`, `abandonBelow` |
| `demography.ts` | cohort `Population` (sex × 5 bands), `workingHands`, `yearlyUpdate` (births, deaths, aging, crowding, epidemic, Poisson sampling, granary brake `granaryBrakeFactor`), `applyHunger`, `takeSlice`/`addPopulation` |
| `economy.ts` | labour plan (`planLabour`: buildings → fields → construction → gathering; private hands, tax, goods, admin quality), food jobs per hex, `monthlyProduction`, granary terms, `reserveFood`/`forecastBeforeHarvest`, tithe (`titheShare`), `economyMonth`, `abandonEmptySettlements`, `demographyYear` (pull factor), `PRIVATE`/`taxRate` |
| `materials.ts` | `Materials` {timber, stone, goods}; `clusterStock`, `clusterCap`/`realmCap` (+ `setStockCaps`), `payFromCluster` (own stock first, exact record) / `refund`, `takeFromCluster` (proportional) |
| `buildings.ts` | `buildableFor`, `canBuild` (tier, duplicate, running project, required hex, stockpile, treasury), `cellMeets`, `hasStone`, `sumEffects` (`BuildingEffects`), `monthsLeft`, `moneyCost` |
| `clusters.ts` | derived clusters from parent links: `clustersOf`, `clusterOf`, `clusterRootOf`, `clusterMembers`, `clusterInfluenceCells`, `realmReport` — never stored |
| `factions.ts` | `Faction` (treasury, stock, yearly ledger `FactionYear`), `initialFactions`, colours |
| `noise.ts` | the realism knobs read live from data (sampling, epidemic, harvest variance, pull factor): `noise()`, `setNoise`, `NO_NOISE` |
| `commands.ts` | `applyCommand(state, cmd) → inverse`: terrain/resource edits, found/remove/restore/rename/edit settlement, `queueBuilding` ⇄ `cancelBuilding` ⇄ `restoreProject`, `transferMaterials` (`factionStockKey`) |
| `scenario.ts` | scenario file ↔ `GameState`, `rebaseAsStart` |
| `turn.ts` | `endTurn` |

## `src/ui/`

| File | Job |
|---|---|
| `app.ts` | wiring: state, camera, renderer, HUD/top bar, hover card, panel modes (settlement / cluster / realm; K, Esc, Z, G, R, E), End turn / Run N years, scenario save/import, autosave, `act(cmd)` → `editor.execute` |
| `camera.ts` | pan/zoom |
| `render/mapRenderer.ts` | chunked, culled hex terrain + resource glyphs (PixiJS 8) |
| `render/settlementLayer.ts` | influence zones, faction border, cluster outlines, worked-hex hatching, markers and labels |
| `panels/settlementPanel.ts` | hover line/card and the settlement panel (people, hands/private, tax base, granary, land, cluster line, buildings + project, Build picker with `costText`, materials, last month); `PanelHost` callbacks |
| `panels/clusterPanel.ts` | cluster panel (members tree, year balance, stockpile vs cap, tax) and realm panel (sum over clusters, realm stockpile vs cap, treasury ledger, Send form); `clusterLine` |
| `editor/editor.ts` | undo/redo stack over commands, brushes, flood fill, resource tools, Settle tool, autosave |
| `style.css` | all styling |

## `src/headless/`

| File | Command |
|---|---|
| `run.ts` | `npm run sim -- …` dispatcher: draft maps (`--seed --continents --islands --land --turns --out`), `--scenario phase1 | testmap | start` |
| `phase1.ts` | eight ideal-land cases, 20 years |
| `testmap.ts` | cities on the real map |
| `start.ts` | Omer's starting position with knob presets and overrides (`--preset`, `--tithe`, `--brake`, `--prosperous`, `--caps`, `--tax`, `--builder 1` scripted builder that ships materials, `--csv`) — the A/B tool |
| `inspect.ts` | list a scenario's settlements |
| `mapdiff.ts` | `npm run mapdiff -- <file>` — diff an exported map against the canonical one |

## `scripts/`

| File | Command |
|---|---|
| `smoke.py` | `npm run smoke` — loads `dist/realms.html` in headless Chrome, runs years, opens realm → cluster → settlement, buys a building, sends materials; fails on any console error; screenshots to `/tmp/smoke_*.png` |

## Data files

| File | Holds |
|---|---|
| `economy.json` | `modelScale` 3; farming/herding/fishing/hunting yields and hands; harvest shares + variance; granary; sharing (reserve, `titheShare`); `privateEconomy`; `materials` (gathering yields, `cap`, `realmCap`) |
| `demography.json` | bands, rates, crowding, `granaryBrake`, hunger, migration (+ `trickle` = the pull factor), `noise` |
| `settlements.json` | tiers (rings, gates), abandonment, metropolis prerequisites (proposed) |
| `buildings.json` | mandatory halls/granaries per tier; buildable buildings (cost incl. money, months, hands, requires, effects, stockCap) |
| `factions.json` | the player faction (placeholder name/colour) |
| `terrain.json`, `resources.json` | index-stable tables |

## Save/state versions

v1 map+clock · v2 settlements · v3 factions, pop history · v4 stocks, projects · v5 faction ledger, `paidMoney`. `deserializeState` migrates forward; a test covers it.
