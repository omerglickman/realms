# Realms, Kings and Other Stuff — Development Log

Every chat session appends an entry here at the end, **even if the work is unfinished or broken**. The next session reads the "Current state" block first, then the latest entries. Keep entries factual: what was done, how, what broke, where to continue.

---

## CURRENT STATE (always kept up to date — overwrite this block, don't append to it)

- **Phase:** **1 (settlements, people and food) — sessions 5–10 done: the model runs at the ×3 scale on Omer's starting position with the decided realism knobs; clusters, cluster/realm panels and the tithe are in.** Phase 0 signed off 2026-11-04.
- **Repository:** GitHub `omerglickman/realms` (private). Claude has push access. Default branch `main`.
- **How to run:** open `dist/realms.html` in a browser. Development: `npm install`, `npm run dev`. Build: `npm run build` → `dist/realms.html`. Tests: `npm test` (96 passing). Map diff: `npm run mapdiff -- <file>`. Headless draft map: `npm run sim -- --seed vinral --continents 2 --islands 6 --land 45 --turns 24` (add `--out maps/x.json`). **Phase 1 scenarios: `npm run sim -- --scenario phase1 [--years 20] [--csv …] [--cityRings N --crowding X]`** (eight cases on ideal land) and **`npm run sim -- --scenario testmap [--sites 5] [--years 20]`** (cities on the real vinral map). **`npm run sim -- --scenario start [--years 60] [--preset baseline|noise|trickle|all] [--seed x] [--csv …]`** runs Omer's starting position with the Session 9 knobs (`--tithe X` overrides the tithe, `--brake 0|1` the granary brake; `baseline` runs with both off) and prints hunger by tier; `npx tsx src/headless/inspect.ts <scenario>` lists a scenario's settlements.
- **Last playable build:** `realms.html` from Session 10b (2026-11-05) — the **granary brake** (towns and cities stop growing before famine), plus Session 10 — **cluster outlines** on the map (pale solid line inside the faction border, faint for lone villages), a **Cluster** line in the hover card and panel that opens the **cluster panel** (people and food of the whole unit, year's balance, member tree), the **Realm** button / K for the realm panel (sum over clusters), the **tithe** at 10 % in kind; plus Session 9 — opens on **Omer's starting position** (`scenarios/start.json`; "Start position" button reloads it, "Bare map" loads the empty test map); the demographic realism knobs at Omer's decided values (sampling, harvest ±12.5 %, epidemics; trickle off), settlements under 30 people are abandoned automatically and the last event shows in the top bar; plus everything from Session 8 — collapsible top bar; editor in three tabs (Terrain / Resources / Settlements), Settlements tab with Place and Pick; settlement hover card next to the marker; worked hexes + dotted influence edge on hover; settle mode hatches every worked hex and dots the influence edges of all towns/cities; name and population editable in the panel; End turn / Run N years; Save scenario / Import; autosave of the whole scenario.
- **The map:** `maps/testmap.json` = "vinral", 160×100, revision 3 (file v2, with 881 resources). Canonical; the generator only makes new drafts. **The starting position:** `scenarios/start.json` ("vinral-start", revision 1) — Omer's placed and pre-run realm, 60 settlements, ≈248k people, calendar rebased to February year 1. When Omer sends a new one: validate with `inspect.ts`, rebase with `rebaseAsStart`, bump `meta.revision`, commit. `data/resources.json` and `data/settlements.json` are index-stable.
- **Model scale (DESIGN §5.8, implemented Session 6):** every yield and hands figure in `data/economy.json` / `data/buildings.json`, and every scenario population, is **×3** the Session-5 draft (`modelScale: 3` in economy.json). Gates: town 1,500, city 6,000 (unscaled), metropolis 36,000. `tests/scale.test.ts` proves the curves are invariant. When quoting or writing any people-count from now on, use the ×3 numbers (a village of 900, a town of 9,000, a city of 24,000; farm hex 600 fed / 90 hands…).
- **Files:** `maps/testmap.json` = terrain + resources (format `realms-map` v2). A **scenario** (format `realms-scenario` v1, `src/sim/scenario.ts`) = the whole `GameState` — map, settlements, people, granaries, calendar — exported with "Save scenario"; the game's starting position will be such a file once Omer has placed and pre-run his settlements (DESIGN §4.8). Import accepts either kind. The editor's autosave (localStorage) is now a scenario, so settlements and the calendar survive a reload.
- **What works (Session 10b):** granary brake — `data/demography.json` `granaryBrake` (appliesTo town/city/metropolis, spareFull 4, spareEmpty 0, minFactor 0.25); `demography.ts` `granaryBrakeFactor(tierId, spareMonths)`, `granaryBrakeTiers()` / `setGranaryBrakeTiers()`; `yearlyUpdate` takes `birthFactor`; `demographyYear` computes spare = December stock in months − 9 months to the September harvest.
- **What works (Session 10):** `src/sim/clusters.ts` — clusters derived from parent links (`clustersOf`, `clusterOf`, `clusterRootOf`, `clusterInfluenceCells`, `realmReport`), never stored; settlements carry yearly totals `year` / `lastYear` (`YearTotals`); the tithe in `economyMonth` (`titheShare()` / `setTitheShare()`, `data/economy.json` `sharing.titheShare` 0.10, `report.titheOut/In`); `src/ui/panels/clusterPanel.ts` (cluster panel, realm panel, `clusterLine`); `settlementLayer.ts` cluster outlines (inset, lightened faction colour; dotted influence edge only on hover / in settle mode); app panel modes settlement / cluster / realm (Realm button, K).
- **What works (Phase 1, UI — Session 7):** `data/factions.json` (player faction only, placeholder name/colour) → `src/sim/factions.ts`; `GameState` v3 (`factions`, `playerFaction`; settlements carry `popHistory` of year-end totals and `foundedTurn`; v1/v2 saves migrate); `canSettleAt`, `growthTrend`, `childrenOf`, `renameSettlement` command; `src/ui/render/settlementLayer.ts` (influence zones as faction-coloured fill + outer border, worked hexes of the hovered/selected settlement, tier markers, labels at constant screen size, Z toggles zones); `src/ui/panels/settlementPanel.ts` (hover line: name, tier, people, growth %/yr, food months + amount, parent; panel: hands staffed/field/idle, land worked vs capacity, granary terms, buildings, parent/dependants links, last month/year, rename + remove in edit mode); editor Settle tool (T) with tier/people/name, hover shows the tier's influence reach, placement refused on water/mountains/occupied, warning when a higher tier already works part of the zone; HUD: date, End turn (Space), Run N years, click a settlement to open its panel, Esc closes.
- **What works (Phase 1):** `data/demography.json`, `data/economy.json`, `data/settlements.json` (4 tiers incl. metropolis), `data/buildings.json` (halls + granaries with hands); `src/sim/demography.ts` (cohort model sex × 5 bands, yearly update in December, hunger deaths, slices for migration); `src/sim/settlements.ts` (Settlement entity, work/influence zones per tier, contested hexes → higher tier wins, parent resolution by influence/tier/faction with override); `src/sim/economy.ts` (labour plan: buildings first then jobs best-per-hand; farm/herd/fish/hunt jobs incl. shore detection; harvest 60/40 Sept/Oct; consume + hunger; granary spoilage/cap by staffing; surplus to parent keeping food-until-harvest + 3 months; migration of 10 % idle hands/month with dependants); `endTurn` runs the economy monthly and demography yearly; `GameState` v2 (settlements, nextId; v1 saves migrate); commands `foundSettlement` / `removeSettlement` / `restoreSettlement`; headless scenario `src/headless/phase1.ts`.
- **What works (Phase 0):** unchanged — hex math, map store, terrain/resources tables, generator, map file v2, command layer, renderer, camera, HUD, map editor.
- **Demographic realism knobs (DECIDED 2026-11-05):** `src/sim/noise.ts` reads them live from `data/demography.json` (`noise.vitalSampling` = 1, `noise.epidemic` 1 %/yr ×2, `migration.trickle.sharePerYear` = 0 — rule kept, off until towns have work) and `data/economy.json` (`farming.harvest.variance.sd` = 0.125, regional 0.5). Tests zero them (`setNoise(NO_NOISE)`); the scale-invariance test only holds with them off and with abandonment off (`setAbandonBelow(0)`). **Abandonment:** `data/settlements.json` `abandonment.abandonBelow` = 30; `abandonEmptySettlements` runs every month end; `state.events` logs it (`logEvent`, capped at 200).
- **Known broken / limitations:** a placed settlement's tier cannot be changed (remove and re-place; name and population can); no move; undo history survives End turn (undoing a placement after turns ran removes the grown settlement — acceptable in an editor); the map export does not carry settlements (by design — use Save scenario); one faction only; no roads (surplus only moves inside influence zones); fishing on offshore sea (ports) not implemented; metropolis upgrade prerequisites not implemented (tier exists); growth is birth-limited, so coast and inland villages grow identically when both are fed; metropolis gate 36,000 is above every roadless orbit ceiling by design (best test-map site ~33,000 at year 20).
- **Decided 2026-11-04 evening (Sessions 5b–5c):** city influence 5 rings, metropolis from 12,000 with 6 rings; village crowding birth penalty 1.0; migration trigger = forecast of running out before the next harvest.
- **Phase 1 scenario results (×3 scale, 2026-11-04):** lone village 900 → 1,244 in 20 y (+1.6 %/y, never hungry); lone town 9,000 → ≈10,070 = its land; city 24,000 alone → ≈10,000 (hunger); city 24,000 + 10 villages of 1,800 → 16,462 (villages 18,000 → 19,007); town 9,000 + 6 villages → 12,437; city 24,000 + 24 villages (G) → 24,945 stable; real map: best site 33,164 at year 20, median site 18,059. (Exactly 3× the Session 5–5c figures.)
- **Next steps (in order):**
  1. Whenever Omer attaches a newly exported map `.json`: `npm run mapdiff -- <file>`, set `name` "vinral", bump `meta.revision`, commit, rebuild, deliver.
  2. **Next chat: starter buildings with effects + build queue** (DESIGN §3.3 starter list; hands per building already in `data/buildings.json`), then the **pull factor** Omer decided on (the migration trickle's jobs-at-destination condition, turning the trickle back on); tuning against the headless curves (the granary brake's three knobs are draft — towns settle ~20 % smaller than before; Omer may want a softer `minFactor`); Phase 1 acceptance review. Also Omer's look at the cluster outlines on his screen.
  3. Every fifth session (15, 20…) or when DEVLOG.md passes ~45 KB: move all but the last three sessions to DEVLOG-archive.md (ROADMAP A.2).
  4. Later: the tithe share becomes a §4.3 policy (light / customary / heavy); requisition in Phase 4; an "abandoned settlement" entity.
- **Scheduled design sessions:** "Government & Institutions" (DESIGN §4.3) before Phase 2.
- **Open questions for Omer:** DESIGN.md §5 (desert; draft yield rows; culture groups and naming schemes — later; village/metropolis hall names; river 600+225; metropolis prerequisites).

---

## Entry template (copy for each session)

```
## YYYY-MM-DD — Session N — <one-line title>
**Phase:** <n> — **Goal of session:** <what was agreed at start>
**Done:**
- …
**How it was done / decisions of note:**
- …  (e.g. "food sharing implemented as PLACEHOLDER per DESIGN §3.3; losses 5%/hex")
**Design decisions made by Omer this session (also written into DESIGN.md):**
- …
**Broken / unfinished:**
- …
**Tests & build:** pass / fail (details)
**Commit(s):** <hash or message>
**Build delivered:** <file name / artifact link / "none">
**Next session should:**
1. …
```

---

## Archive

Sessions 0–6b (planning, Phase 0, the headless Phase 1 model, the ×3 scale, the faction decisions) live in **DEVLOG-archive.md**. Entries are moved there in batches when this file grows past ~45 KB; the Current state block above is always complete on its own.

---

## 2026-11-05 — Session 7 — Settlements on the map

**Phase:** 1 — **Goal of session:** settlements placeable in the editor (player faction only), zones drawn, hover + panel, end turn / run years, scenario export/import.

**Done:**
- `data/factions.json` + `src/sim/factions.ts`: the player faction (placeholder name "The Realm", colour `#c8323c`), `culture` reserved; `GameState` v3 adds `factions` and `playerFaction`; v1/v2 saves migrate.
- `settlements.ts`: `popHistory` (year-end totals, capped at 30 — pushed by `demographyYear`), `foundedTurn`, `growthTrend` (last two Decembers), `childrenOf`, `canSettleAt` (passable land, not occupied); settlements founded without a faction belong to the player. `commands.ts`: `renameSettlement`.
- `src/sim/scenario.ts`: scenario file = envelope around the serialized state with meta (settlements, people, date); `detectFile` tells map and scenario files apart.
- `src/ui/render/settlementLayer.ts`: zone fill + outer border per faction (edge detection against the union of influence cells), worked-hex highlight of the hovered/selected settlement, markers by tier (circle / circle / diamond / star) never smaller than ~5 px, labels at constant screen size (cities always labelled; others from zoom 0.45). Z toggles zones.
- `src/ui/panels/settlementPanel.ts`: hover line and detail panel as Omer specified (name, population, growth trend %, available food, parent) plus hands, land, granary, buildings, dependants, last month, founding.
- Editor: Settle tool (T; tier / people / name; defaults 900 / 9,000 / 24,000 / 36,000); hover shows the tier's influence reach; placing selects; clicking an existing settlement selects it; rename and remove from the panel in edit mode; "Save scenario" button; Import takes map or scenario files; autosave is now the whole scenario and the editor opens itself when there is an autosave to restore.
- HUD: date, End turn (Space), Run N years (10 default, ≤200; 5 years ≈ 15 ms on the test map with 4 settlements), click a settlement outside edit mode to open its panel, Esc closes, "Test map" asks before discarding settlements.
- Tests: 8 new (68 total) — factions in state, default faction, v2 migration, popHistory/trend/cap, foundedTurn, canSettleAt, rename inverse + childrenOf, scenario round-trip and file detection.

**How it was done / decisions of note:**
- Scenario vs map: the map file stays the hand-edited canvas (committed to the repo); the scenario is the state. `maps/testmap.json` is unchanged this session.
- Growth trend needs two year-ends; until then the panel says so rather than showing a misleading number. "Since founding" uses the first year-end as the base.
- Placement rule implemented as PLACEHOLDER (DESIGN §3.3 says nothing about where a centre may stand): any passable land hex. Water and mountains refused.
- Headless check in Chromium: placed a town and three villages, End turn, Run 5 years, hover line, undo/redo of placements, Save scenario → reload → autosave notice → Import scenario → same date and settlements. Zero console errors. Screenshots `session7.png`, `session7_zoom.png`.

**Design decisions made by Omer this session (DESIGN v0.3c):** see Session 6b (factions; player faction alone; editor placement + pre-run; hover contents).

**Broken / unfinished:** see Current state → limitations. Village hall name still the placeholder "Moot Hall".

**Tests & build:** pass (68/68; `tsc` clean; build clean; headless browser run clean).

**Commit(s):** `phase1: settlements on the map — …` (07b045b) + docs commit.

**Build delivered:** `realms.html` (Session 7).

**Next session should:**
1. Read Omer's feedback; commit his scenario file if he sends one and make the build open on it.
2. Yearly report / faction panel; buildings with effects; edit population/tier of a placed settlement.

## 2026-11-05 — Session 8 — UI pass

**Phase:** 1 — **Goal of session:** Omer's six UI requests after trying the Session 7 build.

**Done (all six):**
1. **Top bar** replaces the HUD box: one line across the top — title, date, End turn, Run N years, Edit map, Test map, New draft (drops down), hex readout, and a ▾/▸ toggle that collapses the second line (map info, perf, help). The collapsed state is remembered. Panels sit below the bar whatever its height (`--bar-h`).
2. **Editor tabs** — Terrain (brush / fill / pick, sizes, palette), Resources (palette, spawn), Settlements (Place / Pick). Switching tabs drops the previous tool; keyboard shortcuts are per tab (Tab cycles tabs).
3. **Pick mode** on the Settlements tab opens an existing settlement for editing without placing anything; the panel gets a *Set people* field (new `editSettlement` command: every cohort scaled, granary months kept, exact inverse) next to the rename box and Remove.
4. **Hover card** (`#popover`): name, tier, people, growth %/yr, food months (+ amount), subordinate to, hunger warning; appears to the right of the marker (flips left at the screen edge, clamped vertically), follows pans/zooms, stays while the cursor is on the card, closes when the cursor leaves both the settlement and the card (also when it jumps onto another panel). Clicking the card opens the full panel. The old hover line in the HUD is gone.
5. **Hover highlight**: worked hexes (as before) plus a **dotted line in the faction colour around the influence edge** for tiers whose influence exceeds their work zone (towns, cities, metropolis).
6. **Settle mode** (Place): every worked hex on the map is **hatched** so free hexes are obvious; the **dotted influence edges of all towns and cities** are drawn so the player can see which parent a new village would get; the white preview now outlines the new settlement's *work* zone rather than its influence reach.

**How it was done:** `settlementLayer.ts` gained an `outerEdges(set)` helper (edge detection against a hex set), a manual dash renderer (PixiJS has no dashed strokes) and a horizontal hatch per hex; `editor.ts` rewritten around tabs; `app.ts` owns the popover and the bar. Tests: 1 new (69). Headless Chromium: tabs, pick, set people 9,745 → 12,000 with the granary months unchanged, popover open/close incl. leaving for a panel, placement in settle mode, zero console errors; screenshots `s8_hover_town.png`, `s8_settle_mode.png`.

**Design decisions made by Omer this session:** UI only (recorded above); no DESIGN change.

**Broken / unfinished:** where the influence edge coincides with the faction border the dotted line sits on the solid one and is hard to tell apart (same colour by request). Tier of a placed settlement still not editable.

**Tests & build:** pass (69/69; `tsc` clean; build clean; headless browser run clean).

**Commit(s):** `phase1: UI pass — …` + docs commit.

**Build delivered:** `realms.html` (Session 8).

**Next session should:**
1. Omer's feedback on the UI pass; commit his scenario file when it arrives and make the build open on it.
2. Yearly report / faction panel; buildings with effects; tuning; Phase 1 acceptance.

## 2026-11-05 — Session 9 — Starting position + demographic realism pass

**Phase:** 1 — **Goal of session:** adopt Omer's first starting position; implement the two ideas from the morning's discussion (migration trickle; randomness in births, deaths and harvests) behind data knobs and measure them on that position.

**Done:**
- `scenarios/start.json`: Omer's export (60 settlements: Hugeopolis metropolis 31,721; Omerburg 25,583 and Hillside 15,065 cities; 7 towns 7,600–16,000; 50 villages, 11 of them independent; 247,673 people), calendar rebased from year 521 to **February, year 1** (`rebaseAsStart`), founding dates zeroed, populations and granaries untouched. The build opens on it; "Start position" reloads it; "Bare map" gives the empty test map. `src/headless/inspect.ts` lists a scenario.
- `src/sim/rng.ts`: `nextGaussian`, `nextPoisson`. `src/sim/noise.ts`: all knobs read live from the data files, `setNoise` / `NO_NOISE` for tests and the runner.
- **Vital sampling** (`demography.ts` `yearlyUpdate` with `{rng}`): births and each band's deaths are Poisson draws around the expected value when `noise.vitalSampling` is 1.
- **Harvest variance** (`economy.ts` `rollHarvestFactors`, January): factor = 1 + sd × (√share × regional + √(1−share) × local), regional = one gaussian per 12×12 block per year (seeded from one RNG draw + block key), floored at `minFactor`; `monthlyProduction` multiplies the farming part; forecasts use 1. Stored on the settlement (`harvestFactor`).
- **Epidemics**: `chancePerYear` → that year's deaths × `deathMultiplier`; `report.epidemic`.
- **Migration trickle** (December, after the yearly update, villages first): idle/hands > `minIdleShare` and parent fully fed this year → `sharePerYear` × idle hands (×(1 ± spread)) leave with dependants for the parent; `report.trickleOut/In`. `report.sufficiency` keeps the year's sufficiency for the parent check. Yearly report fields now survive the monthly reset.
- `src/headless/start.ts`: runs the start position N calendar years with presets `baseline` (all off), `noise`, `trickle`, `all` (= data defaults) and per-knob overrides; yearly table by tier, per-settlement table with hunger/yr, village spread, CSV.
- UI: hover card shows "Harvest this year: N %" and "⚠ epidemic"; panel adds a Harvest row and the trickle to "Last year".
- Tests: 10 new (79) — Poisson/gaussian moments; sampling off = seed-independent, on = reproducible and unbiased, cities less jittery than villages; harvest factors (regional sharing, floor, mean); a bad year leaves less grain; epidemic doubles deaths; trickle amount, conservation, threshold, hungry parent, zero share, spread bounds; everything-on determinism; data defaults.

**Findings on the start position (60 years; all figures from `--scenario start`):**
- **Baseline (deterministic):** the realm is at its food ceiling: 247,673 → 245,683, flat. The three cities starve steadily — Hugeopolis ≈ 940, Omerburg ≈ 860, Hillside ≈ 300 hunger deaths *per year* (≈ 2,100/yr, 126,000 over 60 years) — because each sits exactly at what its orbit feeds (3.9–5.4 months of grain); births replace the dead each year. Towns never go hungry. Village 63 (900 people on 4 hill hexes under Hillside) starves and empties into Hillside within a decade. 50 villages, **14 distinct sizes** — Omer's observation confirmed.
- **Sampling alone:** same totals, **47 distinct village sizes**; nothing else changes.
- **Noise (sampling + harvest ±15 % + epidemics 1 %):** the steady 2,100 deaths/yr become **famine years** — 6,000–7,400 dead in a bad year (year 25, year 60), nothing in good ones; towns dip 10–40 % in bad years and refill; 27–43 epidemic-years per run; realm 239k–248k at year 60 depending on the seed. With sd 0.10 the swings are about half.
- **Trickle alone:** 130–155 people/yr move village → town; towns +2.6k, villages −4.4k over 60 years; cities unchanged because they are never "fully fed" (the pull condition blocks them). Realm total unchanged.
- **Everything on:** the trickle pumps ≈ 90,000 people over 60 years up the hierarchy in good years — cities swell from 71k to 100–110k (Hugeopolis to 52,000, Omerburg to 43,000) and then starve them back (140,000 hunger deaths); towns shrink 91k → 72k, villages 65k → 56k. The realm's total stays ≈ 246k: **the land caps the realm, the knobs only move people around within the cap.**
- Reading: the realm as placed lives at the edge; every added realism exposes that (which is correct behaviour). The trickle's "parent is fed" pull is too weak a brake — the right brake is **work at the destination**, which doesn't exist until workshops (buildings session). Recommendation to Omer: adopt sampling; adopt harvest variance at 0.10–0.15 and epidemics; keep the trickle **off** (or tiny) until buildings give towns jobs, then add a jobs condition.

**Design decisions made by Omer this session:** the starting position (DESIGN §4.8). The knobs are PROPOSED (DESIGN §4.1) pending his verdict.

**Broken / unfinished:** knob values are drafts; the trickle lacks a jobs-at-destination condition (by design, until buildings).

**Tests & build:** pass (79/79; `tsc` clean; build clean; headless browser run clean — 20 years on the start position in 173 ms).

**Commit(s):** `scenario: Omer's starting position …` (3dd266a), `phase1: demographic realism knobs (PROPOSED) …` (298129b) + docs commit.

**Build delivered:** `realms.html` (Session 9) — note it runs with all knobs ON at draft values.

**Next session should:**
1. Set the knobs to Omer's verdict; record in DESIGN §4.1 (DECIDED); rerun `--scenario start`.
2. Buildings with effects + build queue (give towns work; then the trickle's jobs condition); yearly realm report; Phase 1 acceptance.

## 2026-11-05 — Session 9b — Knob decisions, abandonment

**Omer's decisions (DESIGN v0.3f):** vital sampling adopted; harvest variance adopted at sd 0.125; epidemics adopted for now (natural events to become a game-wide mechanic later, §4.9); trickle kept off (rule retained). Villages that empty out are removed automatically (an "abandoned settlement" entity may come later).

**Done:** data values set; `abandonment.abandonBelow` 30 in `data/settlements.json`; `abandonEmptySettlements` (monthly, after spoilage/capping, before migration: the remnant walks to the parent if any, granary lost, `resolveAllParents` rerun); `state.events` + `logEvent` (v3 saves without it get an empty log); the top bar's details row shows the last event; `abandonBelow()` / `setAbandonBelow()` live-readable so the scale test can switch it off. Tests: 1 new (80). Rerun of the start position at the decided values: Village 63 abandoned (49 villages, min 834, 47 distinct sizes); realm 247,673 → 240,892 over 60 years; cities still at their ceiling (≈2,100 hunger deaths/yr); famine years of up to 8,000 dead; 33 epidemic-years.

**Tests & build:** 80/80; `tsc` clean; build clean; headless browser run clean (12 years in the browser, zero errors). **Commit:** `phase1: Omer's knob decisions …; automatic abandonment …` (f100a4f) + docs. **Build delivered:** `realms.html` (Session 9b).

**Next session should:** take Omer's decisions on the sharing model and the Cluster (see Current state → Next steps 2), then buildings.

## 2026-11-05 — Session 9c — Sharing model and Cluster decided

**Omer's decisions (DESIGN v0.3g):** **Tithe** adopted at 10 % (draft) of all subordinate food production, in kind, as produced — to become a player policy when §4.3 policies are built; **requisition** waits for Phase 4; the **Cluster** adopted as a derived view: cluster outline replaces the dotted influence line on the map (hover keeps the dotted edge), singletons outlined faintly, cluster panel. **Order of work:** cluster view → tithe with an A/B on the start position → buildings. Work continued in the same chat as Session 10.

## 2026-11-05 — Session 10 — Clusters, realm panel, tithe

**Phase:** 1 — **Goal of session:** the cluster view (DESIGN §3.3), then the tithe (DESIGN §4.2) with an A/B on the start position.

**Done:**
- `src/sim/clusters.ts`: `clustersOf(state)` derives the clusters from the parent links (root = unparented settlement; members transitive; the tree keeps towns nested under their city and villages under their town; sorted by population), `clusterOf` / `clusterRootOf`, `clusterInfluenceCells` (union of the members' influence zones), `realmReport` (sum over the player's clusters). Nothing is stored in the state.
- Settlements carry **yearly running totals** (`year`, reset each December into `lastYear`): produced, consumed, hunger deaths, sent/received, tithe out/in, migrants out/in, months. Old saves load with empty totals.
- Map: **cluster outlines** — a solid line inset 0.16 hex from the edge of each cluster's influence union, in a lightened faction colour so it reads apart from the solid faction border; lone villages faint and thin; the cluster of the hovered/selected settlement brighter. The always-on dotted influence line is gone; hovering a town/city still shows its own dotted influence edge; settle mode still dots all towns and cities. Z hides zones and outlines together.
- Panels: the settlement panel and hover card gained a **Cluster** line ("Hugeopolis cluster · 22 settlements · 103,727 people" / "heads a cluster of …" / "lone village — a cluster of its own"); clicking it opens the **cluster panel** in the same place (settlements by tier, people by tier, months of food in all granaries, last year's and this year's food balance — grown, eaten, net in months of stock, tithed up, moved up inside, starved, migrated — and the member tree with tier, people, food months and a ⚠ for hunger; every member clickable; "Whole realm →"). The **realm panel** (Realm button in the top bar, or K) is the sum over clusters plus the cluster list with last year's hunger. Esc closes everything.
- **Tithe:** `data/economy.json` `sharing.titheShare` 0.10; in `economyMonth` every subordinate hands `titheShare × produced` to its parent the moment it produces (before eating or reckoning its reserve; subordinates are processed before parents so the grain arrives before the parent eats); `report.titheOut/titheIn`, yearly totals, "Last month" row. `titheShare()` / `setTitheShare()` are live-readable; `--tithe X` in the start runner (`--preset baseline` runs with tithe 0 so it stays the pre-Session-10 deterministic model); the runner now prints hunger deaths per year by tier.
- Tests: 7 (clusters: tree, totals, chain, influence union, yearly roll-over, save migration, realm report) + 7 (tithe: data, exact share each month, conservation, zero share = old model, lean year, no parent, people conserved) = 94 total.

**Findings (60 years on the start position; deterministic unless stated):**
- **Clusters on the start position:** 14 → 13 once Village 63 is abandoned: Hugeopolis 22 settlements / 104k (3 towns, 18 villages), Omerburg 19 / 91k (3 towns), Hillside 9 / 34k (1 town), and 10 lone villages.
- **The tithe barely moves hunger.** Tithe 0 vs 0.10, deterministic: hunger deaths per year by tier are villages 8 → 7, towns 0 → 0, cities 1,157 → 1,150, metropolis 942 → 937; total 126,435 → 125,646 over 60 years. With Omer's noise knobs: 128,464 → 126,138. What the tithe *does* move is **people from towns to cities**: towns 90.8k → 85.1k, cities 41.3k → 44.8k, metropolis 30.5k → 33.6k at year 60 (towns were self-sufficient and kept their reserve; now they hand over 10 % of their output and the cities grow on it). The villages are untouched because a fed village sent everything above its reserve anyway — the tithe comes out of the same grain (the tests show tithe + surplus ≈ old surplus; slightly *more* reaches the parent because grain taken at harvest never hits the village's 24-month granary cap).
- **Why city hunger is structural:** a city has no crowding brake (villages only, DESIGN §4.1), so it grows until hunger deaths equal its surplus births. More food (tithe, trickle, bigger orbit) → a bigger city with the *same* ≈2,100 hunger deaths a year; the Session 9 trickle finding was the same thing. The cities are not short of food in the sense of shrinking — they are at a births = deaths + hunger equilibrium. A rule that makes cities stop growing *before* famine (births falling with a thin granary, or a city-side crowding term tied to idle hands once workshops exist) is the thing that would remove the standing 2,100 deaths; it is Omer's call (see Next steps).
- A fed village's granary cannot hold a full harvest: capacity is 24 months of its own consumption and the September harvest alone is ~21 months' worth, so the un-tithed model quietly wastes part of the harvest at the cap. Worth remembering when granary buildings get effects.

**Design decisions made by Omer this session (DESIGN v0.3g):** see Session 9c.

**Broken / unfinished:** the cluster outline and the faction border are both drawn around the same hexes, so at the realm's edge they run parallel (by design — the outline is inset and lighter); whether that reads well on Omer's screen is for him to say. Towns are nested in the city's cluster, never clusters of their own (as decided).

**Tests & build:** pass (94/94; `tsc` clean; build clean; headless browser run clean — realm panel, cluster panel, member links, Esc, K, zero console errors; screenshots `s10_realm.png`, `s10_cluster.png`).

**Commit(s):** `phase1: clusters (derived view, outline on the map, cluster + realm panels, yearly totals per settlement); tithe 10% …` (8c2c2fb) + docs commit.

**Build delivered:** `realms.html` (Session 10).

**Next session should:**
1. Omer's verdict on the city-hunger equilibrium (above): leave it, or add a city-side growth brake; and his look at the cluster outlines.
2. Buildings with effects + build queue (then the trickle's jobs condition); tuning; Phase 1 acceptance.

## 2026-11-05 — Session 10b — Granary brake, archive rule

**Omer's decisions (DESIGN v0.3i):** city growth brake = **births fall when the granary is thin** (§4.1, implemented now) **plus a pull factor** once cities have jobs (with buildings). DEVLOG archive rule: every fifth session, or sooner past ~45 KB, all but the last three sessions move to DEVLOG-archive.md (ROADMAP A.2).

**Done:** `data/demography.json` `granaryBrake` (town/city/metropolis; spare months at the next harvest — December stock minus 9 months — ≥ 4 → factor 1, ≤ 0 → 0.25, linear between); `granaryBrakeFactor` in `demography.ts`, `birthFactor` option on `yearlyUpdate`, applied in `demographyYear`; `--brake 0|1` in the start runner (`baseline` = off). Tests: 2 new (96) — factor shape; a lone city of 9,000 on 19 grassland hexes levels off at ~11,500 with zero hunger instead of overshooting to 13,400 and starving back.

**A/B on the start position (60 years, Omer's knobs, tithe 10 %):** hunger deaths **126,138 → 7,350** (per year: cities 1,157 → 9, metropolis 938 → 106 — the remaining deaths are bad-harvest years); famine migration 1,252 → 184 a year; cities hold 11–17 months of stock in December instead of 5–7. Populations: Hugeopolis 31.7k → 43.1k (it now passes the 36,000 metropolis gate on its own), Omerburg 25.6k → 34.0k, Hillside flat at 15.6k; **towns 91k → 69.5k** (the brake makes a town at its ceiling hold a two-month margin, which costs it ~20 %); villages unchanged; realm 247.7k → 244.6k. A first measurement showed why the measure must be *spare months at the next harvest*, not months of stock: December is right after the harvest, so "8 months of stock" there already means starving in August.

**Tests & build:** 96/96; `tsc` clean; build clean; headless browser run clean. **Commit:** `phase1: granary brake …` + docs. **Build delivered:** `realms.html` (Session 10b).

**Next session should:** start a fresh chat on buildings with effects + build queue, then the pull factor (see Current state → Next steps 2).
