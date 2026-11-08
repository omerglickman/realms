# Realms — Architecture and module map

Repo-only document (not mirrored to the Project). Updated **in place** whenever a module's job changes; it never grows by session. Read the part you need; the code and tests are the record of detail. Rules that bind every module are in ROADMAP.md Part B.

## The shape

- **`src/sim/`** — the rules. No rendering, no DOM; runs in Node. The whole game is one plain JSON object (`GameState`); every change goes through a command; `endTurn(state)` is deterministic (all randomness from `state.rng`). Numbers come from `data/*.json`, never from code.
- **`src/ui/`** — PixiJS map + plain-HTML panels. Reads the state, never mutates it except through `editor.execute(command)` (undo, autosave).
- **`src/headless/`** — CLI runners that import `src/sim` only.
- **`data/`** — the designer's numbers. `terrain.json`, `resources.json`, `settlements.json` tiers are **index-stable** (append only).
- **`maps/testmap.json`** — the canonical map ("vinral", 160×100, format `realms-map` v2). **`scenarios/start.json`** — Omer's starting position (a whole `GameState`, format `realms-scenario` v1); the build opens on it.
- **`tests/`** — one file per sim module + scenario tests (Vitest; `units.test.ts`, `pathfinding.test.ts` since Session 14). Tests zero the noise knobs (`setNoise(NO_NOISE)`) and usually abandonment (`setAbandonBelow(0)`).

## Turn order (one month)

`turn.ts endTurn` → `units.ts unitsMonth` → `forts.ts fortsMonth` (Session 18; forts decay) (Phase 2: every unit in id order — walk its route for the month and carry out the arrival order (settle / disband); then eat (a work-band with a `build` order walks to its job and works instead — `workbands.ts buildMonth`): inside own borders from the covering settlement's cluster, topping the bags up to the chosen months; outside, forage hex + ring 1 and eat the bags; hunger when empty) → `economy.ts economyMonth` (January: harvest factors; per settlement in rank order — villages before towns before cities: plan labour → produce → tithe up → consume + hunger → gather, tax, goods, sales, construction → spoil & cap; then the cluster stockpile-cap pass; surplus up; abandonment; famine migration; yearly totals) → in December `demographyYear` (epidemic roll, births/deaths/aging with the granary brake, the pull factor, faction year roll-over, pop history).

## `src/sim/` — one line each

| File | Job |
|---|---|
| `state.ts` | `GameState` (version 10; `infra` since Session 16, `forts` since Session 18), `createGameState`, `calendar`, `logEvent`, serialize/deserialize with migrations v1→v10 |
| `rng.ts` | seeded sfc32: `seedRng`, `nextFloat`, `nextU32`, `nextGaussian` |
| `hex.ts` | pointy-top hexes, axial ↔ odd-r offset, rings, distance — the only file that knows geometry |
| `map.ts` / `mapfile.ts` | `MapData` (terrain + resource index arrays), bounds, neighbours; map file v2 read/write |
| `mapgen.ts` | the noise draft generator (new drafts only — the test map is a file) |
| `terrain.ts` / `resources.ts` | `TERRAIN` (fertility/pasture/timber 0–4, passability), `RESOURCES` with spawn weights and spacing |
| `water.ts` | `isShore` (sea touching land), `isFishable` |
| `settlements.ts` | `Settlement` (+ `castle?: CastleState`, Session 18), `TIERS` (seven ranks: village 0 · small castle 1 · town 2 · medium castle 3 · city 4 · large castle 5 · metropolis 6 by `rank`; array order is index-stable, castles at 4–6), `isCastle` / `isRuin` / `canCastleAt`, `foodParentOf` (nearest non-castle ancestor: tithe, migration, pull), `resolveParent` (a castle never overrides a covering town / city parent — PLACEHOLDER), two-pass `computeWorkAssignment` (castles take their own hex + best ring-1 hexes),  `BUILDINGS` + `buildingDef`, `BuildProject`, `UPGRADES` + `UpgradeProject` (Session 15b), `SettlementReport` (last month), `YearTotals` (running year / `lastYear`), work & influence zones, contested-hex assignment (`workedCellsBySettlement`), parent resolution, `settlementsByRank`, `abandonBelow` |
| `demography.ts` | cohort `Population` (sex × 5 bands), `workingHands`, `yearlyUpdate` (births, deaths, aging, crowding, epidemic, Poisson sampling, granary brake `granaryBrakeFactor`), `applyHunger`, `takeSlice`/`addPopulation` |
| `economy.ts` | labour plan (`planLabour`: buildings → fields with the partial-staffing curve `staffingOutput` (Session 14; `StaffedJob.staffing` vs `fraction`) → construction → gathering; private hands, tax, goods, admin quality), food jobs per hex, `monthlyProduction`, granary terms, `reserveFood`/`forecastBeforeHarvest`, tithe (`titheShare`), `economyMonth` (castles skipped in the rank loop; `castleMonth`: staffing, wages + upkeep into `FactionYear.upkeep`, ruin clock, reserve), `abandonEmptySettlements`, `demographyYear` (pull factor), `PRIVATE`/`taxRate` |
| `castles.ts` | Session 18 (DESIGN §3.5; `data/castles.json`): `CASTLES`, `castleKindOf`, `castleNeed`, `allocateService` (hands lent by settlements in the castle's rings, taken after buildings and before fields, ≤ ⅓ of a home's hands), `castleBuildCost`, `castleAt`, `restoreRuin`, `upgradeHandsAvailable`, `castleName`. Imports no value from `state.ts` (cycle) |
| `forts.ts` | Session 18: `state.forts`, `fortAt`, `canFortify` (unit flag; no unit has it yet), `fortify` (instant, PLACEHOLDER), `fortsMonth` (decay 12 months after the last unit leaves), `fortCells` (1-ring border) |
| `hexjobs.ts` | `hexJobs` / `Job` / `JobKind` (the food jobs of a hex), split out of `economy.ts` (which re-exports) to keep imports acyclic |
| `materials.ts` | `Materials` {timber, stone, goods}; `clusterStock`, `clusterCap`/`realmCap` (+ `setStockCaps`), `payFromCluster` (own stock first, exact record) / `refund`, `takeFromCluster` (proportional) |
| `buildings.ts` | `buildableFor`, `canBuild` (tier, duplicate, running project, required hex, stockpile, treasury), `cellMeets`, `hasStone`, `sumEffects` (`BuildingEffects`), `monthsLeft`, `moneyCost` |
| `clusters.ts` | derived clusters from parent links: `clustersOf`, `clusterOf`, `clusterRootOf`, `clusterMembers`, `clusterInfluenceCells`, `realmReport` — never stored |
| `factions.ts` | `Faction` (treasury, stock, yearly ledger `FactionYear`), `initialFactions`, colours |
| `noise.ts` | the realism knobs read live from data (sampling, epidemic, harvest variance, pull factor): `noise()`, `setNoise`, `NO_NOISE` |
| `commands.ts` | `applyCommand(state, cmd) → inverse`: terrain/resource edits, found/remove/restore/rename/edit settlement, `queueBuilding` ⇄ `cancelBuilding` ⇄ `restoreProject`, `transferMaterials` (`factionStockKey`); units (Session 14): `raiseUnit` ⇄ `cancelRaise`, `orderUnit` (move order and/or a work-band `build` order; its own inverse; validates), `settleUnit` ⇄ `unsettle`, `disbandUnit` ⇄ `undisband` (or a move order home), `sendFood` (same cluster; own inverse; logs an event); `commandTouchesUnits`; tier upgrades (Session 15b): `upgradeSettlement` ⇄ `cancelUpgrade` ⇄ `restoreUpgrade`, `finishUpgrade` ⇄ `revertUpgrade`; `setParents` (cluster leader / split, Session 15c; self-inverse) |
| `units.ts` | Phase 2 (DESIGN §3.2b): `Unit` (type, faction, hex + river bank, cohorts, provisions, provisionMonths, home, order, report), `UNIT_TYPES` from `data/units.json`; sizes and defaults (`destinationHands`, `defaultSize`, `defaultProvisionMonths`); raising with a muster (`musterSources`, `raiseCheck`, `raiseUnit`, `cancelRaise`, `takeMen`); settling (`canFoundAt`, `canSettle`, `settleUnit`, `villageName`); disbanding (`disbandTarget`, `disbandInto`); the field (`coveringSettlement`, `forage`); `unitsMonth` |
| `infrastructure.ts` | Session 16 (DESIGN §3.2b rule 7, §3.4): `data/infrastructure.json` (`INFRA`, `infraItem`), `InfraState` {roads by cell (1 dirt, 2 paved), bridges, sites (quarry / lumber camp by cell — Session 17, no economic effect yet), `infraBrushResult` = the editor's placement rules} on `state.infra`, `roadLevelAt` (a settlement's hex counts as dirt), `roadLink` (the lower level of two hexes), `stepCostBetween` — the movement rule (terrain cost × the road factor, never under the link level's `minCost` (dirt 0.5, paved 0.25); mountains a whole month without a road link), `takesWholeMonth`, `minStep` |
| `workbands.ts` | Session 16 (+ castles, Session 18: items `castle_small/medium/large`, coins from the treasury, ruin rebuilt at half price, a fort under it saves 25 % of the time): a work-band's build order (`BuildOrder` {item, route, i}, `WorkProject` {item, cell, progress, paid} on the unit), `makeBuildOrder` (plans "road from X to Y" with `planRoadRoute`, bridges inserted), `pendingSteps` / `orderSummary` (jobs, materials, months), `workRate` (people / `work.refPeople`), `buildMonth` (walk to the job, pay materials from the covering cluster then the realm, work the rest of the month, carry on to the next hex the same month; a bridge is built from the bank beside it), `checkBuildOrder` |
| `pathfinding.ts` | A* over (hex, bank) nodes; `blockedByCastle` (another faction's standing castle hex is impassable; optional `faction` argument to `stepsFrom` / `findRoute`); `stepsFrom` prices every step with `stepCostBetween` (roads); `needsBridge`, `planRoadRoute` (A* over cells for a road: rivers crossable at `bridgePenalty`, existing roads at `reuse`), `stepCost` (terrain only, for destination checks; mountains = the month's points; lake/sea impassable), `riverBanks` (runs of land between water / map-edge neighbours; exactly two → banks; a settlement bridges — `isBridged` — a settlement or a built bridge), `findRoute` → `Route {nodes, cost, months}`, `stepsThisMonth(state, start, path, …)` / `walkMonths(state, start, path, …)` (a step needs its full cost, a unit that has not moved yet may always take one) |
| `upgrades.ts` | tier upgrades (DESIGN §3.2b rule 10, Session 15b): `upgradeStep`, `canUpgrade` (gate, money, cluster materials), `startUpgrade`, `upgradeMonth` (fixed months, no builders; called from `economyMonth`), `completeUpgrade` (tier, hall, granary; keeps the old parent by override), `revertTier`, `clusterPeers` |
| `scenario.ts` | scenario file ↔ `GameState`, `rebaseAsStart` |
| `turn.ts` | `endTurn`: units, forts, then economy, then December's demography |

## `src/ui/`

| File | Job |
|---|---|
| `app.ts` | wiring: state, camera, renderer, the ledger strip, hover card, the ledgers (`view` = settlement / cluster / realm / settings / help / draft; K, C, ?, Esc, Z, G, R, E), End month / Run N years, the ☰ menu, scenario save/import, autosave, `act(cmd)` → `editor.execute`, the header-font setting; **units (Session 15):** `selectedUnitId`, the targeting `mode` (a unit's move / settle order, or the raise dialog's destination pick) with the route preview, `advance(1)` recording each ordered unit's route for the glide, the raise draft and dialog, the per-session map of raise inverses for Cancel |
| `camera.ts` | pan/zoom |
| `render/mapRenderer.ts` | chunked, culled hex terrain + resource icon badges (PixiJS 8) |
| `icons.ts` | the icon set (UI-DESIGN.md §4): SVG bodies (resources, tiers, units, buildings, interface), `icon()` for the DOM, `iconTexture` / `preloadIconTextures` for the map (badge and mark styles) |
| `zoomLevels.ts` | the four zoom levels: which tiers show markers and names, when resources show (UI-DESIGN.md §6) |
| `render/unitLayer.ts` | Phase 2 (Session 15): one heater shield per occupied hex (faction colour, type icon, count for a group, 60 % while forming, offset beside a settlement marker, vermilion dot when blocked), selection / hover rings, the selected unit's remaining route and the targeting preview as dotted lines, the glide (`animate` + `tick`), `unitAtWorld` hit test, `shieldAt` for the card |
| `render/infraLayer.ts` | Session 16: roads (dirt ribbon, paved band) and bridges (deck) between hex centres, drawn under the settlements, plus quarry / lumber-camp badges; redrawn when `state.infra` or the zoom bucket changes |
| `render/settlementLayer.ts` | influence zones, faction border, cluster outlines, worked-hex hatching, faction-disc markers with tier icons, mill / wharf badges on hexes, labels by zoom level (`setLabelFont`) |
| `panels/format.ts` | shared display helpers: `fmt`, `esc`, tier words, `foodMonths`, `clusterLine`, `costText`, `projectText`, gauges / bars / stacks / stat tiles / `kv` tables, the sparkline, the inline-SVG `ICON` set |
| `panels/hud.ts` | the ledger strip (Session 13): date, treasury, people, food, realm stockpile tiles with hover tips; clicks open the realm ledger |
| `panels/hoverCard.ts` | the settlement hover card |
| `panels/unitCard.ts` | the pinned unit card (Session 15): people, food gauge, home, bound for / arrives, `unitState`, warnings; Move · Settle at… · Settle here · Disband · Cancel order; for work-bands (Session 16) the road-kind select, Build here · Road to… · Bridge at… · the three castle buttons (cost / months in the tooltip) and the Building / Still to do / At work on rows (`buildPrefs`) |
| `panels/raiseDialog.ts` | the raise dialog (Session 15): `RaiseDraft`, `newRaiseDraft` / `distribute` (spare hands first, raising settlement first), `draftSpec`; size slider with the destination reckoning, provisions, destination + village name, muster rows, cost chips, Raise gated by `raiseCheck` |
| `panels/modal.ts` | the modal shell (`ModalShell.show(key, spec, host)`, `wireLinks`) |
| `panels/tooltip.ts` | the one shared tooltip (`data-tip` + a hidden `.tip` child) |
| `panels/settlementModal.ts` | the settlement ledger: Overview · People (age pyramid, growth line, crowding / granary brake) · Land & Food (harvest calendar, every worked hex) · Economy (hands stack, tax, stockpile, gathering) · Buildings (cubes: built → project → available → unavailable, tooltips, click to start) · Recruitment (Session 15: unit cubes mustering → available → unavailable, `unitCostChips`, parties here / afield); the upgrade card on Overview and the hex table's worked-first order with idle marks (Session 15b); editor footer (rename / people / remove) |
| `panels/castleModal.ts` | Session 18: the castle ledger (`castleSpec`: staffing, garrison room, siege reserve, cost, hexes, subordinates, upgrade card), `wireCastle`, `renderCastleHover` |
| `panels/clusterModal.ts` | the cluster ledger: Overview · Members · Food (+ `sendFoodForm` / `wireSendFood`, Session 15) · Stockpile (+ the Send form helpers `sendForm` / `wireSend`, `stockBars`, `yearFoodText`) |
| `panels/realmModal.ts` | the realm ledger: Overview · Clusters · People · Food · Treasury · Stockpile |
| `fonts/` | bundled woff2 fonts (SIL OFL): Lugrasimo, Almendra, Uncial Antiqua (header hands), Alegreya (body) |
| `editor/editor.ts` | undo/redo stack over commands (`lastInverse()` for the UI's Cancel of a raise), brushes, flood fill, resource tools, Settle tool, the Infrastructure tab (stroke = one undo step via the `setInfra` command), autosave |
| `style.css` | all styling: the medieval palette as CSS variables, `@font-face` for the bundled fonts, strip / menu / status / hover card / modal / editor / unit card / raise dialog rules |

## `src/headless/`

| File | Command |
|---|---|
| `run.ts` | `npm run sim -- …` dispatcher: draft maps (`--seed --continents --islands --land --turns --out`), `--scenario phase1 | testmap | start` |
| `phase1.ts` | eight ideal-land cases, 20 years |
| `testmap.ts` | cities on the real map |
| `start.ts` | Omer's starting position with knob presets and overrides (`--preset`, `--tithe`, `--brake`, `--prosperous`, `--caps`, `--tax`, `--builder 1` scripted builder that ships materials, `--settlers 1|2 --reach N` the settler-spammer with the sprawl table, `--csv`) — the A/B tool |
| `settlers.ts` | the settler-spammer (Session 14): per cluster root, one party at a time from the members' spare hands (2 = also 10 % of everyone) to the best unclaimed site within reach (food of the hexes nobody works, ≥ 5 free hexes, route ≤ 6 months); `fieldReport` |
| `roads.ts` | `npm run sim -- --scenario roads --from A --to B [--level dirt|paved] [--people 300]` — one band lays a road between two settlements of the start position; plan, months, and the walk before / after |
| `inspect.ts` | list a scenario's settlements |
| `mapdiff.ts` | `npm run mapdiff -- <file>` — diff an exported map against the canonical one |

## `scripts/`

| File | Command |
|---|---|
| `smoke.py` | `npm run smoke` — loads `dist/realms.html` in headless Chrome, runs years, opens the realm → cluster → settlement ledgers, buys a building, sends materials, raises settlers from the Recruitment page, forms and disbands them, sends food in a cluster; fails on any console error; screenshots to `/tmp/smoke_*.png` |
| `shots.py` | `npm run shots` — screenshots every ledger page, the raise dialog, the unit card and the move preview, the menu, editor, settings and help to `/tmp/ui_*.png` for a visual check |

## Data files

| File | Holds |
|---|---|
| `economy.json` | `modelScale` 3; farming/herding/fishing/hunting yields and hands; harvest shares + variance; granary; sharing (reserve, `titheShare`); `privateEconomy` (tax and goods per private hand; `salesSharePerYear` 0 — only a Market sells); `materials` (gathering yields, `cap`, `realmCap`) |
| `demography.json` | bands, rates, crowding, `granaryBrake`, hunger, migration (+ `trickle` = the pull factor), `noise` |
| `settlements.json` | tiers (rings, gates), abandonment, `upgrades.steps` (money, timber, stone, months per step; the metropolis step a placeholder), metropolis prerequisites (proposed) |
| `buildings.json` | mandatory halls/granaries per tier; buildable buildings (cost incl. money, months, hands, requires, effects, stockCap) |
| `factions.json` | the player faction (placeholder name/colour) |
| `infrastructure.json` | road and bridge items (months, materials), the work-rate rule (`refPeople`, `maxRate`), the movement rule (`minCost` per road level, road factors), route-planning weights (`bridgePenalty`, `reuse`) |
| `units.json` | unit types (settlers and work-bands enabled; levy data only), provisions rule, foraging shares, the partial-staffing curve, muster / disband reach, settle rule, naming placeholder |
| `terrain.json`, `resources.json` | index-stable tables |

## Save/state versions

v1 map+clock · v2 settlements · v3 factions, pop history · v4 stocks, projects · v5 faction ledger, `paidMoney` · v6 units · v7 `settlement.upgrade` · v8 `infra` (roads, bridges). `deserializeState` migrates forward; a test covers it.
