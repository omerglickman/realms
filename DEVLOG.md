# Realms, Kings and Other Stuff — Development Log

Every chat session appends an entry here at the end, **even if the work is unfinished or broken**. The next session reads the "Current state" block first, then the latest entries. Keep entries factual: what was done, how, what broke, where to continue.

---

## CURRENT STATE (overwrite this block every session; keep it under ~6 KB, present tense, no session history)

- **Phase 2 — units, movement and building the land — IN PROGRESS.** Phase 1 signed off 2026-11-07 (numbers deliberately untuned until the Phase 2 sinks exist). **Session 14 (1a) built the unit sim; session 1b — the unit UI — is next.** The Government & Institutions design session comes after Phase 2.
- **Repository:** GitHub `omerglickman/realms` (private), branch `main`. **Read `CLAUDE.md` there for the session protocol and commands, `ARCHITECTURE.md` for the module map, `UI-DESIGN.md` before touching `src/ui/`.** Tests: 140 passing. `npm run smoke` checks the built game in headless Chrome; `npm run shots` screenshots every ledger page.
- **How Omer plays:** open `realms.html` from disk. It opens on his starting position (`scenarios/start.json`, "vinral-start" rev 1: 60 settlements, ≈248k people, February year 1); "Start position" reloads it, "Bare map" loads the empty test map (`maps/testmap.json`, "vinral" rev 3). When Omer sends a new map or position: `npm run mapdiff`, validate with `inspect.ts`, `rebaseAsStart`, bump `meta.revision`, commit, rebuild, deliver. Saves are state v6 (older saves migrate).
- **What the build does now:**
  - *Phase 1 (see ARCHITECTURE.md for the modules):* 160×100 hex map with yields and resources and a map editor; four settlement tiers with work / influence zones, contested hexes, subordination and derived **clusters**; cohort demography with hunger, famine migration, the granary brake and the pull factor; farming (60/40 Sept/Oct, ±12.5 %), herding, fishing, hunting, granaries, surplus up, the 10 % tithe; timber/stone/goods in capped stockpiles with instant shipping (placeholder), private hands → tax and goods, Markets, 16 buildable buildings. **Partial staffing of a hex** (§3.2b rule 1, Session 14): ≥ 75 % → output = staffing; 50–75 % → 2 × staffing − 0.75; under 50 % the hex is dropped and its hands try a smaller job (`data/units.json` `staffing`).
  - *Units (Session 14 — sim only, nothing on screen yet):* `GameState.units`; **settlers** raisable (`data/units.json`; work-band and levy are data with `enabled: false`). **Raise** at a settlement with a **muster** from cluster members and own settlements within 3 hexes (a proportional slice of cohorts), provisions in months from the sources' granaries (settlers default: months to the October harvest + 2), 1,000 coins + 90 timber from the cluster, the rest from the realm with a notice; the party forms on the hex and acts from the next end of turn. **Orders:** move (A*; terrain costs 1/2/3, mountains a whole month, lake/sea impassable; **a river hex is two bank nodes**, crossed only where a settlement stands on it) with an optional "then settle / disband"; **settle** (land but mountains, outside every other work zone → a village "New <home>" with the people and the provisions); **disband** into the closest non-starving own settlement within 3 hexes (walks there; refused if none). Monthly: **inside own borders** the party eats from and refills out of the covering cluster's granaries; **outside** it forages hex + ring 1 (fish/game full, farming 20 %, herding 30 %) and eats its bags; empty → hunger. **Send food** between cluster members by hand. Every command has an inverse.
  - *UI:* the Sessions 13–13e ledger strip, hover cards and settlement / cluster / realm ledgers (UI-DESIGN.md is the reference). **Units are not drawn and have no controls yet** — session 1b.
  - *Headless:* `npm run sim -- --scenario start --years 40 --builder 1 [--settlers 1|2] [--reach 10]` — `--settlers` is the **settler-spammer** (`src/headless/settlers.ts`): every cluster raises a party from its members' spare hands for the best unclaimed site within reach (hexes nobody works), walks and founds; 2 = reckless (also 10 % of everyone). Prints the **sprawl curve** (settlements per year), parties raised, hunger in old vs new villages. ~15–40 s a run.
- **Placeholders and limitations:** instant shipping and instant muster; no unit UI; no roads/bridges; foraging ignores ownership and depletes nothing; levies and work-bands not raisable yet; pull's "paying more per head" clause unbuilt; administration quality = hall staffing; flat realm cap; map export carries no settlements.
- **Numbers to remember:** model scale ×3 (a village 900, a town 9,000, a city 24,000; farm hex 600 fed / 90 hands); gates town 1,500 / city 6,000 / metropolis 36,000; influence rings 1/3/5/6; realism knobs as decided 2026-11-05; settlers 4 move points, default ≈ 1,290 people for seven farm hexes.
- **Next steps (in order):**
  1. **Phase 2, session 1b — the unit UI** (UI-DESIGN §4–6, 1.5): the **Recruitment** tab (cubes like Buildings; raise dialog: size slider with the reckoning from `defaultSize` / `destinationHands`, muster rows from `musterSources`, provisions from `defaultProvisionMonths`, destination picked on the map with the route preview from `routeFor`); **unit markers** (faction-colour heater shields with the settlers / work-band / levy icons) with the gliding move animation; the **unit card** (people, months of food, home, order, months left, Move / Settle / Disband, warnings from `unit.report`); **Send food** in the cluster ledger; `commandTouchesUnits` for redraws; units in `smoke.py` / `shots.py`. Sim API: `raiseCheck`, commands `raiseUnit` / `orderUnit` / `settleUnit` / `disbandUnit` / `sendFood`, `disbandTarget`, `canSettle`, `canFoundAt`.
  2. Session 2 — work-bands, roads and bridges (`data/infrastructure.json`; "road from X to Y" as one order; **forts/castles with their own clusters to be designed first**, §5.14; `isBridged` is the hook for built bridges); session 3 — levies (`takeMen` exists) with upkeep, tier upgrades as a command; session 4 if needed — groups, hierarchical pathfinding, tuning with Omer; **roads and food sharing** at the end of the phase (§5.15).
  3. **Government & Institutions design session** (DESIGN §4.3) — after Phase 2: opens with the sprawl curve (Session 14 entry) and the §4.3 hooks list.
  4. Housekeeping: **Session 15 is the archive point** — move all but the last three entries to DEVLOG-archive-2.md (new volume if it would pass ~45 KB).
- **Open questions for Omer:** the **river-mouth reading** (Session 14: a river hex keeps its two banks where it meets the sea, a lake or the map edge, so a river cannot be crossed at its mouth; only a source or a fork is open — Claude's reading of "where the banks cannot be told apart"); §5.14 forts/castles clusters (before session 2); the unit marker shape (UI-DESIGN §7); §5.2 draft terrain yield rows; village naming ("New <home>" is a placeholder for §4.10).

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

Sessions 0–12b (planning, Phase 0, the headless Phase 1 model, the ×3 scale, the faction decisions, settlements on the map, the UI pass, the starting position and the realism knobs, the cluster/tithe decisions, clusters and the tithe, the granary brake, buildings and materials, the private economy, the reorganization) live in **DEVLOG-archive.md** (Sessions 0–9c) and **DEVLOG-archive-2.md** (Sessions 10–12b). Entries are moved there in batches when this file grows past ~45 KB, into volumes of under ~45 KB each; the Current state block above is always complete on its own. The per-module inventories that used to live in the Current state block ("What works (Session N)") were folded into the repo's **ARCHITECTURE.md** on 2026-11-05 (Session 12b); the session entries below keep the detail.

---

## 2026-11-05 — Session 12c — Omer's verdicts on the private economy

**Omer's decisions (DESIGN v0.4d):** (1) building prices **×5** (Chapel 1,500 … Market 3,000 … Citadel 30,000); (2) hands drawn from the private pool that pay no tax: construction gangs *and gatherers* (the Session 12 reading stands), plus levies, **professional soldiers**, settlers and work-bands — more may be added; (3) cap numbers left to Claude — cluster caps kept, **realm cap doubled** to 6,000 / 3,000 / 3,000 so the realm can bank stone for a Citadel and Walls; (4) **goods become money only through a Market** — the 20 % petty-trade sale is gone (`privateEconomy.salesSharePerYear` 0; Market `salesShare` 0.6); goods without a market pile up and overflow to the realm, from where they can be shipped to a market cluster; (5) no desert for now; (7) hall names Moot Hall / Great Hall; (8) river keeps farming + fishing; (9) metropolis prerequisites accepted as a draft. **Government & Institutions waits for a future session. Next session: a complete UI overhaul**, Omer leading, so he can read the mechanics from the screen.

**Open:** DESIGN §5.2 — Omer asked what "draft yield rows" means. It is the §3.1 terrain table: fertility / pasture / timber per terrain on a 0–4 scale; the rows he ruled on are marked "per Omer", the rest ("draft") are Claude's guesses — River copied from grassland, Tundra pasture 1, Swamp fertility 1 and timber 1, Forest fertility 1, Hills timber 1, Woodland and Grassland pasture 1. He can confirm or change them whenever convenient.

**Done:** `data/buildings.json` prices ×5, Market effect `salesShare` (replacing `salesShareBonus`), blurbs; `data/economy.json` `salesSharePerYear` 0, `realmCap` ×2; `buildings.ts` / `economy.ts` renamed effect; tests adjusted (market-only sales; money test reads the price). 40-year A/B with the builder: money now binds in the first two decades (treasury 19,600 at year 10 vs 140,000 before; 18,000 coins/yr spent), the same 113 buildings are finished by year ~27, then the treasury climbs again (420,000 at year 40 — the sinks are still to come); sales 0 until markets exist, ~5,000/yr with ten. Hunger 2,308 over 40 years; realm 247,700 → 253,400.

**Tests & build:** 117/117; build clean; `npm run smoke` OK. **Commit:** `phase1: Omer's verdicts — prices ×5, Market-only sales, realm cap ×2 (Session 12c)`. **Build delivered:** `realms.html` (Session 12c).

**Next session should:** the UI overhaul (Current state → Next steps 1).

## 2026-11-05 — Session 13 — The UI overhaul

**Phase:** 1 — **Goal of session:** Omer's brief: a complete UI overhaul — the bottom lines (funds, people, resources) always visible in a clear place that hides little of the map; everything else in hover summaries or modals that present resources, buildings, economic activity and demographics in an orderly, friendly way with graphics; headers in a font resembling Carolingian minuscule; a more medieval palette. Design left to Claude's discretion.

**Done:**
- **Ledger strip** (`src/ui/panels/hud.ts`): a 48-px parchment-on-leather bar — date; Treasury (coins, net last year); People (realm total, growth last year from the summed `popHistory`); Food (months of stock in all granaries, starved this/last year); Timber / Stone / Goods (realm stockpile vs `realmCap`, lost or arrived this year). Each tile has a hover tip with the figures behind it and opens the matching page of the realm ledger. End month / Run N years / Go, and a ☰ menu (realm ledger K, editor E, start position, bare map, new draft…, settings…, keys & help ?). A thin status strip at the bottom carries the hovered hex, the last event and the fps readout.
- **Modal shell** (`modal.ts`): one host, a light non-blocking backdrop (the map stays live; clicking another settlement swaps the ledger), header with a faction-colour stripe, tabs, scrolling body (scroll position survives the per-month re-render), footer; `wireLinks` for `data-focus` / `data-cluster` / `data-open` links.
- **Settlement ledger** (`settlementModal.ts`), five pages: *Overview* (stat tiles: people, granary gauge with the next-harvest mark, land, tax or spare hands, harvest; warnings — starving, will run out before the harvest, epidemic, hands short; the running project with a progress gauge and Cancel; last year / last month / hands / dependants / buildings / founded). *People* (hands, men 15–44, women 15–44; an SVG **age pyramid** by sex and band with the working bands darker; a **growth line** from `popHistory`; "what moves the numbers": the crowding rule for a village with its live births factor, the granary brake for towns and above with the spare months reckoned now; fed % this year). *Land & Food* (worked hexes, people fed, granary, forecast at the next harvest; a **harvest calendar** — 12 monthly bars from `monthlyProduction` with a dashed consumption line and the year's total vs eaten; a table of every worked hex with terrain chip, yields, resource and each job's fed-or-gathered a year now / full; flows: last month, last year, granary terms, sharing — tithe and surplus in words). *Economy* (hands, tax with the formula, goods, administration; a **stack** of where the hands go; the cluster stockpile vs cap as bars with own stock; gathering jobs; receipts last month / last year). *Buildings* (standing buildings as cards with staffing gauges; the project card; every buildable building as a card with cost chips — coins, timber, stone, months, builders, hands to run, lacking items in red — the blurb, the tax dent of the builders, the reason it cannot be started, and a Start button).
- **Cluster ledger** (`clusterModal.ts`): Overview (tiles, people by tier, the year), Members (the tree as a table: tier glyph, people, food-months bar, built, tax/yr, project and hunger marks), Food (the year's flows as a stack and a per-settlement table: grown / eaten / net / tithe / surplus / starved / months now), Stockpile (bars vs cap, Warehouses and Markets noted, the Send form from the realm, who holds what).
- **Realm ledger** (`realmModal.ts`): Overview (tiles, warnings — starved, materials lost above the cap, clusters without a Market; people by tier; the year; tax base), Clusters (table with food bars, net food, starved, stock, tax), People (born/died/pull/starved tiles, where they live, the realm's growth line, the largest settlements), Food (flows stack, by cluster, where people go hungry), Treasury (tiles, the ledger this year / last year, who pays by cluster), Stockpile (bars vs cap, arrivals and losses, Send to any cluster, what the clusters hold).
- **Hover card** (`hoverCard.ts`): name in the script hand, tier, people with trend, food months with a gauge marked at the 3-month reserve, land, tax, parent, cluster, project, harvest, warnings.
- **Theme** (`style.css` rewritten; `format.ts` with `fmt` / `esc` / gauges / bars / stacks / stat tiles / `kv` tables and ~30 original inline-SVG icons): palette parchment `#ecdfc2` / oak `#4a2f1a` / ink `#2b1d12` / vermilion `#a8321e` / lapis `#2f4f7f` / verdigris `#4f7a52` / gold `#c7972b`. Fonts bundled in `src/ui/fonts/` with their OFL licences: **Lugrasimo** (headers and map labels — the closest open font to a Carolingian book hand), **Almendra** and **Uncial Antiqua** as alternatives chosen in Settings (stored in the browser; `setLabelFont` restyles the Pixi labels), **Alegreya** for body text. The map's terrain colours are untouched; the void around it is now a dark leather brown.
- Editor restyled as a parchment drawer; its `edit-toggle` is now a menu item; the New-draft generator form moved into a dialog (the form element is moved between a hidden holder and the dialog so its ids and listeners stay).
- `scripts/smoke.py` rewritten for the modals (realm → clusters tab → cluster → members → settlement → buildings → Start → Space until built → realm stockpile → Send); `scripts/shots.py` (`npm run shots`) screenshots every page for a visual check.
- Old `settlementPanel.ts` / `clusterPanel.ts` removed (their helpers live in `format.ts`).

**How it was done / decisions of note:**
- Fonts came from the `@fontsource` npm packages (the only registry the workspace reaches); a comparison sheet of eight candidates was rendered and Lugrasimo chosen for the Carolingian feel. Omer may prefer another — hence the Settings switch.
- The backdrop does not block pointer events on purpose: a strategy player compares settlements by clicking around; Esc, ×, or a click on empty map closes.
- All numbers shown come from the existing sim reports and `planLabour`; no sim change. Units were checked: "feeds N a year" is people, "grown" is food (12 per person-year).
- `tierLabel` / `popByTierText` word tiers by how many settlements there are ("in the metropolis", "in cities").

**Design decisions made by Omer this session:** none (a UI direction, recorded here: bottom lines always visible, the rest in hover cards and modals, Carolingian-style headers, medieval palette).

**Broken / unfinished:** nothing known. Worth Omer's eye: whether modals (vs side panels) suit his play; the Buildings page is long for a metropolis (16 cards); the realm's growth line reaches back only as far as the youngest settlement remembers; the editor's tab for settlement editing (name / people / remove) is now the footer of the settlement ledger when the editor is on.

**Tests & build:** pass (117/117; `tsc` clean; build clean, `realms.html` 1.1 MB with fonts; `npm run smoke` OK with zero console errors; `npm run shots` reviewed page by page).

**Commit(s):** `phase1: UI overhaul — ledger strip, hover cards, settlement / cluster / realm ledgers, medieval theme and bundled fonts (Session 13)`.

**Build delivered:** `realms.html` (Session 13).

**Next session should:**
1. Take Omer's feedback on the UI (Current state → Next steps 1).
2. Tuning and the Phase 1 acceptance review.

## 2026-11-06 — Session 13b — UI follow-ups: icons on the map, zoom levels, cubes, UI-DESIGN.md

**Phase:** 1 — **Goal of session:** Omer's notes on the Session 13 UI: a design doc for the UI; keep both header hands; the End-month button colliding with the tiles; line icons for every resource, used in the strip and on the map; settlement icons in the same style; icons for future entities (castles ×3, road stations, watermills on the river hex); zoom levels that drop names and markers by tier; the Buildings page as small cubes with hover explanations, ordered built → available → unavailable.

**Done:**
- **UI-DESIGN.md** (repo + Project): principles, palette variables, type, the icon set and its rules, every component, the zoom levels, open questions, a change log. CLAUDE.md step 2 and ROADMAP A.2 point at it; ARCHITECTURE.md updated.
- **Icon set** (`src/ui/icons.ts`): one source for DOM and map — bodies on a 24-grid; `icon()` inline SVG; `iconTexture` / `preloadIconTextures` rasterise to 64-px textures in two styles: `MAP_BADGE` (ink on a parchment disc) and `MAP_MARK` (parchment lines for faction discs). New icons: game, iron, fish, furs, salt, wine, silver (also stone); village, town, city, metropolis; mill, wharf, castle1–3, station; chapel, market, workshop, warehouse, range, stables, drill, walls, barracks, ironworks, citadel. `data/resources.json` and `data/buildings.json` gained an `icon` field (`ResourceDef.icon`, `BuildingDef.icon`; the old glyph is the fallback).
- **Map:** resources are badge sprites per hex in `mapRenderer` (a Sprite container per chunk replaces the glyph Graphics); settlement markers are faction-colour discs with the tier icon on top (`markerIcons` container, sprites reused by id); **Mill** badge on the settlement's worked river hex and **Wharf** on its fishing hex (`hexBadges`), offset to the upper right so a resource badge stays readable.
- **Zoom levels** (`src/ui/zoomLevels.ts`): `villageNames` 2.0 / `townLevel` 1.0 / `cityLevel` 0.6 → everything / no village names / no town names or village markers / only cities and the metropolis with names (resources and hex badges hidden too). The old 0.45 label cut-off and 0.3 resource cut-off are gone.
- **Strip:** the collision fixed three ways — the three material tiles became one **Stockpile** tile (icon + number ×3; caps, arrivals or losses underneath), tiles shrink (`flex: 0 1 auto`, `#tiles` clips) and `#turn-controls` never shrinks, and media queries drop the sublines below 1440 px and the labels and title below 1200 px. Verified at 1500 and 1280 px.
- **Tooltips** (`src/ui/panels/tooltip.ts`): one fixed `#tooltip` fed by any element's hidden `.tip` child (`data-tip`), placed below or above, clamped, hidden on mousedown, on modal re-render and when its element is replaced. The tile tips moved to it (they were clipped by the strip's overflow before).
- **Buildings page** as cubes: icon, name, family, cost chips; ordered project → built (staffing gauge) → available (green outline, click starts) → unavailable (greyed); the tooltip carries the full cost, months, builders, hands, the blurb, the builders' tax dent and the reason when blocked. Project cube has Cancel.
- Smoke test clicks a `.cube.avail` and waits for `.cube.project` to go; `npm run shots` unchanged.

**How it was done / decisions of note:** the doc is named `UI-DESIGN.md` rather than "Design" because `DESIGN.md` is the rules contract. Icons are rasterised once at startup (`await preloadIconTextures` in `startApp`) so the layers stay synchronous. Castle and station icons are drawn and preloaded but unused until their entities exist. The watermill shows on the first worked river hex in the plan's cell order — a placeholder for a proper "which hex" rule when mills become per-hex (DEVLOG Session 11 note).

**Design decisions made by Omer this session:** UI only (recorded in UI-DESIGN.md 1.1): both hands kept; the icon style; the four zoom levels; cubes with hover explanations in the stated order.

**Broken / unfinished:** nothing known. The resource badges are small at zoom < 1 (they hide below 0.6); whether the thresholds suit Omer's screen is for him to say. Marker icons are the same parchment colour on every faction colour — fine for red, to be checked when the other five factions get colours.

**Tests & build:** pass (117/117; `tsc` clean; build clean; `npm run smoke` OK, zero console errors; screenshots at four zooms and two window widths reviewed).

**Commit(s):** `phase1: UI follow-ups — icon set on the map, zoom levels, stockpile tile, tooltips, building cubes, UI-DESIGN.md (Session 13b)`.

**Build delivered:** `realms.html` (Session 13b).

**Next session should:**
1. Omer's feedback (Current state → Next steps 1).
2. Tuning and the Phase 1 acceptance review.

## 2026-11-06 — Session 13c — Icon corrections, tapped vs untapped resources

**Omer's notes on 13b:** iron takes the ingot (the old silver icon); silver becomes a star in a circle; a simpler fish; an antlered head for game; on the map a slight colour difference between worked ("tapped") and unworked resources; every change applied everywhere.

**Done:** the four icons redrawn in `src/ui/icons.ts` (one source, so the strip, ledgers, hex readout and map all changed together; checked at 64 and 24 px); `MAP_BADGE_IDLE` (greyed badge) beside `MAP_BADGE` (warm parchment); `MapRenderer.setWorkedCells(set)` diffs the worked hexes and rebuilds only the chunks whose resource hexes changed state; `app.ts` passes the work assignment on every state change and preloads both styles. UI-DESIGN.md 1.2.

**Tests & build:** 117/117; build clean; `npm run smoke` OK. **Commit:** `phase1: icon corrections (iron, silver, fish, game); tapped vs untapped resource badges (Session 13c)`. **Build delivered:** `realms.html` (Session 13c).

**Next session should:** Omer's feedback (Current state → Next steps 1).

## 2026-11-06 — Session 13d — Shorelines

**Omer's request:** a small sand-coloured strip on the water hex wherever water touches land, as in IMPERIUM — "a meandering line biting inside the sea on the side adjacent to the shore".

**Done:** a first straight-band version put the strips one edge off (the edge → neighbour mapping assumed `AXIAL_DIRECTIONS` runs clockwise like `hexCorners`; it runs the other way). Omer attached IMPERIUM's archive (`IMPERIUM_v2_76_move4-5_committed.zip`, read-only); its `render.ts` `collectShoreFringe` was ported: per land-facing edge of a water hex, a light sand band (depth 0.30 − 0.12 of the radius) over a dark tide band (0.30) whose sea-side boundary meanders (amplitude 0.05, seeded sine, zero at vertices), with bridge wedges at every vertex toward the adjacent edges; colours `#d9b16a` / `#b8894a`; dark filled first, light on top, in a `shore` Graphics between the fill and the grid. The mapping is now `EDGE_DIR`, computed at load from the geometry (edge midpoint vs neighbour centre), so it cannot drift. `invalidateHex` also dirties the neighbours' chunks so a terrain edit redraws the coast across a chunk border. UI-DESIGN.md 1.3 §6.

**Tests & build:** 117/117; build clean; `npm run smoke` OK; screenshots at zoom 0.43 and 4.4 reviewed. **Commits:** `phase1: shorelines on water hexes (Session 13d)`, `phase1: shoreline fringe ported from IMPERIUM; edge mapping derived from geometry (Session 13d)`. **Build delivered:** `realms.html` (Session 13d, second build).

**Next session should:** Omer's feedback (Current state → Next steps 1).

## 2026-11-07 — Session 13e — Rivers as water

**Omer's request:** river hexes drawn like water — lake-blue base, and the shoreline fringe in grassland's colour (whatever grassland is drawn with, now a flat colour, later perhaps a texture) instead of sand; band depth to be tuned later.

**Done:** `mapRenderer` overrides river's fill colour with lake's at construction (the data colour stays for the palette and chips); the shoreline pass treats river as water and collects a second fringe for river hexes — light band = grassland's colour from `data/terrain.json`, inner meandering band = the same darkened 22 % (`BANK_DARKEN`, `darken()`); river–river / river–lake / river–sea edges get no fringe. UI-DESIGN.md 1.4 §6.

**Tests & build:** 117/117; build clean; `npm run smoke` OK; screenshots at zoom 0.43 and 4.4 reviewed. **Commit:** `phase1: rivers drawn as water with grassland banks (Session 13e)`. **Build delivered:** `realms.html` (Session 13e).

**Next session should:** Omer's feedback (Current state → Next steps 1); the river band depth if he wants it changed.

## 2026-11-07 — Session 13f — Phase 1 signed off; Phase 2 before Government & Institutions

**Phase:** 1 → 2 — **Goal of session:** a planning chat, no code. Omer reviewed where we stand and proposed building the playable mechanics (units, movement, work-bands, settlers, levies) before the Government & Institutions design session, so that a game loop exists before the layer of levers on it. Claude agreed with pushback on scope.

**Omer's decisions this session (recorded in ROADMAP 0.6 and DESIGN 0.5):**
- **Phase 1 is signed off.** The system (settlements, demography, food, materials, private economy, UI) is coherent; the **numbers stay untuned** until the Phase 2 sinks exist — tuning an economy with nothing to spend on would be redone.
- **Phase 2 comes next; the Government & Institutions design session moves to after it, before Phase 3.** Reasons agreed: units are the missing money sinks (Session 12 finding); administrative capacity is a brake on settlement count and cannot be designed before settlers exist or measured without them; institutions need the people of Phase 3 to staff them.
- Phase 2 runs **without an administrative-capacity placeholder** — the people cost of founding is the only brake and the headless sprawl is measured, not capped; that measurement opens the design session.
- **Fog of war and the Web Worker leave Phase 2 for Phase 5.** Levies in Phase 2 are one generic unit (raise / move / upkeep / disband), no roster, facilities or combat.
- Phase 2 session plan: (1) units + movement + settlers; (2) work-bands + roads, quarries/lumber camps, forts; (3) levies + tier upgrades; (4) if needed, groups, hierarchical pathfinding, tuning.

**Omer's verdicts on §3.2b (same session, DESIGN 0.5a):** all twelve decided — (1) family slice, levies men 15–44; hands leave idle → private → gatherers → food, buildings kept; a hex's output below 75 % staffing falls faster than its hands and a hex under 50 % is dropped (curve numbers pending his pick between the continuous and the steeper reading); (2) sizes chosen by the player, settlers defaulting to the hands the destination's seven hexes + hall + granary need (≈ 1,290 for seven farm hexes), work-band and levy 300; (3) raising also costs cluster materials, realm fallback with a notice; (4) provisions chosen at raising, default to the harvest calendar; units forage outside the borders — fish and game at full efficiency, other terrain a fraction; (5) mountains one hex a month, rivers crossed only by bridge with a unit confined to the bank it entered from, destination-based movement; (6) settle anywhere but mountains; (7) bridges, "road from X to Y" as one order including bridges, irrigation later, forts/castles with their own clusters OPEN, disband to the closest non-starving settlement within 3 hexes; (8) road food sharing deferred to the end of the phase; (9) levy disband = walk home; (10–12) as proposed.

**Sub-points confirmed by Omer (DESIGN 0.5b, UI-DESIGN 1.5):** the continuous staffing curve; foraging **20 % of farming / 30 % of herding**; the river-bank pathfinding and **a settlement on a river hex counts as a bridge**; raising materials and the disband refusal accepted as drafted. New: **muster** — a party may be gathered from several settlements of the cluster (and own settlements within 3 hexes), forming at the raising settlement next month (the walk abstracted until groups exist); **Send food** between cluster members by hand in the cluster ledger, never automatic (§5.16 resolved). UI: a **Recruitment** tab on the settlement ledger, cubes like Buildings with a raise dialog (size, muster rows, provisions, destination); **unit markers** as faction-colour heater shields with parchment unit icons (settlers cart, work-band pick and shovel, levy spear and shield — Claude's shape proposal, Omer may change it); a **gliding hex-to-hex animation** when units move. ROADMAP 0.6a: session 1 may split into 1a sim / 1b UI.

**Done:** ROADMAP.md 0.6 (Phase 1 DONE with the acceptance note; Phase 2 rewritten as the plan above with its acceptance; the design session moved; Phase 5 and the stack table amended). DESIGN.md 0.5 (§3.2b — twelve PROPOSED unit rules for Omer to rule on at the Phase 2 kickoff: who leaves, sizes, raising, provisions, movement points, settling rule, work-band projects, roads and food loss, levy upkeep, upgrade costs, disbanding, no capacity placeholder; §4.3 and §5.4 pointers moved; §5.12–13 opened). DEVLOG Current state rewritten. All three mirrored to the Project and the repo.

**§4.3 hooks carried forward (for the design session):** administration quality = hall staffing (§4.2b); the tithe as a constant (§4.2); the flat realm cap (§4.2); the pull factor's unbuilt "paying more per head" clause (§4.1); metropolis prerequisite "an institution" (§3.3); Chapel order (§4.4). Phase 2 will add: upkeep, capacity cost per settlement and per tier upgrade, road-building as a crown vs local decision.

**Broken / unfinished:** nothing — no code changed; the Session 13e build stands.

**Tests & build:** not run (docs only; HEAD `1209bd5` was green at 117/117).

**Commit(s):** `docs: Phase 1 signed off; Phase 2 plan; G&I session moved after Phase 2 (Session 13f)` · `docs: Omer's verdicts on the Phase 2 unit rules — DESIGN §3.2b DECIDED (Session 13f)` · `docs: §3.2b sub-points confirmed; muster, Send food; Phase 2 UI in UI-DESIGN 1.5 (Session 13f)`.

**Build delivered:** none (unchanged from 13e).

**Next session should:**
1. Phase 2 session 1a — units and movement, the sim (Current state → Next steps 1). Nothing to ask first; read DESIGN §3.2b, §2.3, §4.2 and UI-DESIGN §4–6 by section.

## 2026-11-07 — Session 14 — Phase 2 session 1a: units and movement, the sim

**Phase:** 2 — **Goal of session:** the unit entity, pathfinding, the raise / move / settle / disband commands, provisions and foraging, the partial-staffing curve, Send food, settlers founding villages, and the headless settler-spammer measuring 40 years of unconstrained sprawl. No UI (session 1b).

**Done:**
- `data/units.json`: the three types (settlers enabled; work-band and levy as data, `enabled: false`), costs, move points, defaults, provisions, foraging shares, the staffing curve, muster / disband reach, settle rule, the naming placeholder.
- `src/sim/pathfinding.ts`: A* over (hex, bank) nodes with a binary heap; `riverBanks` (runs of land between water / map-edge neighbours — exactly two → banks; a settlement on the hex bridges it); `stepsFrom`, `findRoute`, `stepsThisMonth` (a step needs its full cost, a unit that has not moved yet may always take one, mountains spend every point), `walkMonths`.
- `src/sim/units.ts`: `Unit` (type, faction, hex + bank, cohorts, provisions, provisionMonths, home, order, raisedTurn, report); `destinationHands` / `defaultSize` / `defaultProvisionMonths`; `musterSources`, `raiseCheck`, `raiseUnit` (slice of all cohorts, `takeMen` for levies; provisions from each source in proportion; cluster materials with realm fallback and a logged notice; coins), `cancelRaise`; `canFoundAt` / `canSettle` / `settleUnit` (`FoundOptions.pop` / `food` carry the exact cohorts and granary); `disbandTarget` / `disbandInto`; `coveringSettlement`, `forage`, `unitsMonth` (movement and arrival orders, then refill-or-forage, eat, hunger; a party with nobody left is removed).
- `src/sim/commands.ts`: `raiseUnit` ⇄ `cancelRaise`, `orderUnit` (validates the route), `settleUnit` ⇄ `unsettle`, `disbandUnit` ⇄ `undisband` (or a move order home), `sendFood` (same cluster only; own inverse); `commandTouchesUnits`.
- `src/sim/economy.ts`: `staffingOutput` and the curve in `planLabour` (`StaffedJob.staffing` = hands share, `fraction` = output share; a dropped hex frees its hands for the next smaller job). `turn.ts`: `unitsMonth` before `economyMonth`. `state.ts`: v6 with `units`, migration.
- `src/headless/settlers.ts` + `--settlers` / `--reach` in `start.ts`: the spammer and the sprawl table.
- Tests: `pathfinding.test.ts` (10) and `units.test.ts` (13): costs, mountains, lakes, river banks / mouth / source / bridge, the curve, defaults, muster with undo, realm fallback and refusals, the walk-and-found, refill vs forage vs starvation, settle rules, disband (now, by walking, refused), send food, save/load and migration.

**How it was done / decisions of note:**
- **River mouths.** The decision says a river hex is open "at a source, a mouth or a fork, where the banks cannot be told apart". Implemented by that principle: banks are the runs of *land* between water (river, lake, sea) and map-edge neighbours; exactly two runs → two banks. So a reach, a mouth into the sea, a hex beside a lake and a hex at the map edge all keep their banks (no crossing), while a source (one run) and a fork (three) are open. Flagged for Omer in Current state — if he wants mouths crossable, `riverBanks` is one line.
- A unit that enters a river hex from an open river hex (source, fork, bridge) may take either bank. A unit standing on a river hex whose bridge disappears (abandonment) keeps bank -1 and is treated as open there — an edge case, noted.
- Movement stepping: cost model is points; A* uses mountains = a full month's points. Settlers (4 points) cross a plains hex a month ×4; a forest costs 3.
- Inside the borders the unit's month of food is taken from the covering settlement first, then its cluster, and the bags are topped up to the chosen months — the granary feeds the party, not the bags. Outside, foraging is a twelfth of the shares' yearly yield, no harvest calendar.
- `economy.ts` reads the staffing curve from `data/units.json` directly (no import of `units.ts`, so there is no cycle; `state.ts` imports the `Unit` type only).
- The spammer: one party per cluster root at a time; muster from spare hands only (recklessShare 0) or + 10 % of everyone (`--settlers 2`); sites scored by the food of the hexes **nobody works** (the first version counted contested hexes too — it founded 149 villages, two thirds of them beside towns that took their ring, and hunger quadrupled); ≥ 5 free hexes and ≥ 1,500 fed/yr; route ≤ 6 months.

**Findings (the sprawl curve — for the Government & Institutions session):**
- Baseline with the curve, no settlers (`--builder 1`): realm 247,673 → 249,158 (+0.6 %; was +2.3 % before the staffing curve), hunger 2,816 over 40 years (was 2,308), treasury 422,006 at year 40, 113 buildings. The curve costs a little output on the one partly-staffed hex of every settlement.
- **Spare-hands spammer, reach 10:** settlements 60 → 98 in five years, 98 at year 15, 121 at year 40 (curve: 68 76 87 94 98 98 … 113 117 121); 62 parties (74,810 people), all founded; hunger 4,242 (3,672 old, 570 new); realm 357,179 (+44 %); treasury 171,001; 173 buildings. The brake is **people**: "waited for people" 21,694 cluster-months vs 266 short of coins and 2 of timber. Once the towns' stock of spare hands is spent (years 1–5) sprawl runs at ~1 village a year from the villages' own growth; land within reach also runs out ("no site" 3,250×).
- Reach 16: 60 → 130 (71 villages), same shape. **Reckless (10 % of everyone), reach 16:** 60 → 161 (102 villages), realm 386,738 (+56 %), hunger 6,036 — stripping towns of working hands costs little because the pull refills them.
- The contested-ignorant first run: 60 → 208, hunger 17,300, treasury pinned under 15,000 all game (164 × 1,000 coins while tax fell from 14k to 6k a year as private hands left the towns) — the one run in which **money bound**. With sensible sites, 1,000 coins a party does not bind.
- No party starved in the field in any run (provisions + foraging suffice at the calendar default). Runs take 15–40 s (site search and A*).

**§4.3 hooks carried forward:** administration quality = hall staffing (§4.2b); the tithe as a constant (§4.2); the flat realm cap (§4.2); the pull's "paying more per head" clause (§4.1); metropolis prerequisite "an institution" (§3.3); Chapel order (§4.4). **New this session:** the people cost of founding is the only brake (rule 12) — the curve above is what capacity must shape; raising cost 1,000 coins + 90 timber (rule 3 draft) did not bind; no upkeep on settlers in the field; who may muster from whom (cluster + 3 hexes) is a candidate for an administrative reach; village naming (§4.10).

**Design decisions made by Omer this session:** none (implementation of §3.2b as decided; the river-mouth reading is Claude's and is flagged).

**Broken / unfinished:** nothing known in the sim. Nothing is visible in the UI yet — units exist in the state and in saves, the map and ledgers ignore them (session 1b). The old UI still runs unchanged (smoke OK).

**Tests & build:** pass (140/140; `tsc` clean; build clean; `npm run smoke` OK, zero console errors).

**Commit(s):** `phase2: units and movement — the sim (Session 14, 1a)`; docs commit to follow.

**Build delivered:** `realms.html` (Session 14 — same screens as 13e; the unit sim underneath).

**Next session should:**
1. Phase 2 session 1b — the unit UI (Current state → Next steps 1). Read UI-DESIGN §4–6 and ARCHITECTURE's `src/sim/units.ts` / `pathfinding.ts` lines; the sim API is listed in Next steps.
2. Take Omer's answer on the river-mouth reading if he gives one.
