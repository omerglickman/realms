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
| `app.ts` | wiring: state, camera, renderer, the ledger strip, hover card, the ledgers (`view` = settlement / cluster / realm / settings / help / draft; K, C, ?, Esc, Z, G, R, E), End month / Run N years, the ☰ menu, scenario save/import, autosave, `act(cmd)` → `editor.execute`, the header-font setting |
| `camera.ts` | pan/zoom |
| `render/mapRenderer.ts` | chunked, culled hex terrain + resource icon badges (PixiJS 8) |
| `icons.ts` | the icon set (UI-DESIGN.md §4): SVG bodies, `icon()` for the DOM, `iconTexture` / `preloadIconTextures` for the map (badge and mark styles) |
| `zoomLevels.ts` | the four zoom levels: which tiers show markers and names, when resources show (UI-DESIGN.md §6) |
| `render/settlementLayer.ts` | influence zones, faction border, cluster outlines, worked-hex hatching, faction-disc markers with tier icons, mill / wharf badges on hexes, labels by zoom level (`setLabelFont`) |
| `panels/format.ts` | shared display helpers: `fmt`, `esc`, tier words, `foodMonths`, `clusterLine`, `costText`, `projectText`, gauges / bars / stacks / stat tiles / `kv` tables, the sparkline, the inline-SVG `ICON` set |
| `panels/hud.ts` | the ledger strip (Session 13): date, treasury, people, food, realm stockpile tiles with hover tips; clicks open the realm ledger |
| `panels/hoverCard.ts` | the settlement hover card |
| `panels/modal.ts` | the modal shell (`ModalShell.show(key, spec, host)`, `wireLinks`) |
| `panels/tooltip.ts` | the one shared tooltip (`data-tip` + a hidden `.tip` child) |
| `panels/settlementModal.ts` | the settlement ledger: Overview · People (age pyramid, growth line, crowding / granary brake) · Land & Food (harvest calendar, every worked hex) · Economy (hands stack, tax, stockpile, gathering) · Buildings (cubes: built → project → available → unavailable, tooltips, click to start); editor footer (rename / people / remove) |
| `panels/clusterModal.ts` | the cluster ledger: Overview · Members · Food · Stockpile (+ the Send form helpers `sendForm` / `wireSend`, `stockBars`, `yearFoodText`) |
| `panels/realmModal.ts` | the realm ledger: Overview · Clusters · People · Food · Treasury · Stockpile |
| `fonts/` | bundled woff2 fonts (SIL OFL): Lugrasimo, Almendra, Uncial Antiqua (header hands), Alegreya (body) |
| `editor/editor.ts` | undo/redo stack over commands, brushes, flood fill, resource tools, Settle tool, autosave |
| `style.css` | all styling: the medieval palette as CSS variables, `@font-face` for the bundled fonts, strip / menu / status / hover card / modal / editor rules |

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
| `smoke.py` | `npm run smoke` — loads `dist/realms.html` in headless Chrome, runs years, opens the realm → cluster → settlement ledgers, buys a building, sends materials; fails on any console error; screenshots to `/tmp/smoke_*.png` |
| `shots.py` | `npm run shots` — screenshots every ledger page, the menu, editor, settings and help to `/tmp/ui_*.png` for a visual check |

## Data files

| File | Holds |
|---|---|
| `economy.json` | `modelScale` 3; farming/herding/fishing/hunting yields and hands; harvest shares + variance; granary; sharing (reserve, `titheShare`); `privateEconomy` (tax and goods per private hand; `salesSharePerYear` 0 — only a Market sells); `materials` (gathering yields, `cap`, `realmCap`) |
| `demography.json` | bands, rates, crowding, `granaryBrake`, hunger, migration (+ `trickle` = the pull factor), `noise` |
| `settlements.json` | tiers (rings, gates), abandonment, metropolis prerequisites (proposed) |
| `buildings.json` | mandatory halls/granaries per tier; buildable buildings (cost incl. money, months, hands, requires, effects, stockCap) |
| `factions.json` | the player faction (placeholder name/colour) |
| `terrain.json`, `resources.json` | index-stable tables |

## Save/state versions

v1 map+clock · v2 settlements · v3 factions, pop history · v4 stocks, projects · v5 faction ledger, `paidMoney`. `deserializeState` migrates forward; a test covers it.
