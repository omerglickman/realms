# Realms, Kings and Other Stuff — Development Log

Every chat session appends an entry here at the end, **even if the work is unfinished or broken**. The next session reads the "Current state" block first, then the latest entries. Keep entries factual: what was done, how, what broke, where to continue.

---

## CURRENT STATE (overwrite this block every session; keep it under ~6 KB, present tense, no session history)

- **Phase 1 — settlements, people and food — in progress** (Phase 0 signed off 2026-11-04). Sessions 5–12 built the model and Omer gave his verdicts on it (Session 12c); Sessions 13–13b rebuilt the UI around it (**UI-DESIGN.md** records the look). **Next: Omer's feedback on the new UI**, then tuning and the Phase 1 acceptance review. The Government & Institutions design session waits for a future session.
- **Repository:** GitHub `omerglickman/realms` (private), branch `main`. **Read `CLAUDE.md` there for the session protocol and commands, `ARCHITECTURE.md` for the module map, `UI-DESIGN.md` before touching `src/ui/`.** Tests: 117 passing. `npm run smoke` checks the built game in headless Chrome; `npm run shots` screenshots every ledger page to `/tmp/ui_*.png` for a visual check.
- **How Omer plays:** open `realms.html` from disk. It opens on his starting position (`scenarios/start.json`, "vinral-start" rev 1: 60 settlements, ≈248k people, February year 1); "Start position" reloads it, "Bare map" loads the empty test map (`maps/testmap.json`, "vinral" rev 3). When Omer sends a new map or position: `npm run mapdiff`, validate with `inspect.ts`, `rebaseAsStart`, bump `meta.revision`, commit, rebuild, deliver.
- **What the build does now:**
  - *World:* 160×100 hex map with terrain yields and resources; a map editor (terrain, resources, settlement placement with tier/people/name; undo; export/import; autosave of the whole scenario).
  - *Settlements:* four tiers with work and influence zones, contested hexes to the higher tier, subordination to a parent, derived **clusters** (outlined on the map; cluster and realm panels). Settlements under 30 people are abandoned; events show in the top bar.
  - *People:* cohort demography (births, deaths, aging, crowding in villages, Poisson sampling, epidemics 1 %/yr), hunger deaths, famine migration to the parent, the **granary brake** on towns and cities, the **pull factor** (4 %/yr of a village's idle hands to a parent that is fed with ≥ 4 spare months).
  - *Food:* farming (harvest 60/40 Sept/Oct, ±12.5 % variance, regional), herding, fishing, hunting; granaries with spoilage and caps; surplus up to the parent; the **tithe** at 10 % in kind.
  - *Materials and money:* spare/private hands gather timber and stone into cluster stockpiles with **caps** (raised by Warehouses); overflow to the capped realm stockpile, which the player ships anywhere (instantly — placeholder). In towns and above, **private hands** pay tax into the treasury and make goods; only a **Market** turns the cluster's goods into money. **Buildings** cost money (1,500–30,000) + materials + hands + months, one project per settlement, cancel refunds; 16 buildable (Mill, Wharf, Chapel, Great Granary, Workshop and Market as multipliers, Warehouse, three military, five Phase-4 data-only).
  - *UI (Session 13 overhaul):* a **ledger strip** at the top with the bottom lines — date, treasury (net last year), people (growth), months of food (starved), one stockpile tile (timber · stone · goods, caps or losses underneath) — each with a hover tip and a click into the realm ledger; the strip drops its sublines below 1440 px and its labels below 1200 px; End month / Run years; a ☰ menu (realm, editor, start position, bare map, new draft, settings, keys). Everything else is a **hover card** (settlement: people, food gauge, land, tax, parent, warnings) or a **ledger modal** with tabs: settlement (Overview · People with age pyramid and growth line · Land & Food with the harvest calendar and every worked hex · Economy with the hands stack, tax, cluster stockpile, gathering · Buildings as small cubes — built, under construction, available, unavailable — whose explanation is a tooltip; click to start), cluster (Overview · Members tree · Food by settlement · Stockpile with Send), realm (Overview · Clusters · People · Food · Treasury · Stockpile with Send). The map stays live under a light backdrop; clicking another settlement swaps the ledger. Medieval palette (parchment / oak / ink / vermilion / lapis / verdigris / gold); headers and map labels in **Lugrasimo** (a Carolingian-style book hand; Almendra and Uncial Antiqua selectable in Settings), body in Alegreya — all bundled (SIL OFL) so `realms.html` works from disk. A thin status strip at the bottom shows the hovered hex, the last event and the fps. **Map (13b):** one icon set (`src/ui/icons.ts`) for the strip, the ledgers and the map — every resource as an ink-on-parchment badge on its hex, settlements as faction-colour discs with a tier icon (hut / houses / walls / towers), a Mill drawn on the settlement's river hex and a Wharf on its fishing hex, castle and road-station icons defined for later; four zoom levels (all · no village names · no town names or village markers · cities and the metropolis only).
  - *Headless:* `npm run sim -- --scenario start --years 40 --builder 1` with overrides `--tithe --brake --prosperous --caps --tax --preset baseline|noise|trickle|all --csv` — the A/B tool; `phase1` and `testmap` scenarios.
- **Placeholders and limitations:** money binds for the first ~20 years at the ×5 prices and then piles up until the sinks exist (upkeep, institutions, characters); the pull's "paying more per head" clause is not built; administration quality = hall staffing only; the realm cap is flat; goods in the realm stockpile must be shipped to a cluster with a Market to be sold; shipping is instant; mill/wharf bonuses are settlement-wide; one faction; no roads, no ports, no metropolis prerequisites; a placed settlement's tier can't be changed in the editor; the map export does not carry settlements (use Save scenario).
- **Numbers to remember:** model scale ×3 (a village 900, a town 9,000, a city 24,000; farm hex 600 fed / 90 hands); gates town 1,500 / city 6,000 / metropolis 36,000 (unscaled); influence rings 1/3/5/6; realism knobs as decided 2026-11-05 (sampling on, harvest sd 0.125, epidemics 1 %, pull 0.04 on prosperity).
- **Next steps (in order):**
  1. **Omer's feedback on the Session 13/13b UI** — what reads well, what is missing, Lugrasimo vs Uncial Antiqua (Settings), whether the modals should instead be side panels, the zoom thresholds; small UI fixes as he asks.
  2. Then tuning against the headless curves and the **Phase 1 acceptance review** (a faction with a city and villages survives and grows over 20 years; a lone city starves; Omer can read why from the ledgers).
  3. **Government & Institutions design session** (DESIGN §4.3) — a future session, not next: administration quality, the tax regime policy (the tithe becomes a policy), the Town Charter, the realm cap, `data/institutions.json`.
  4. Housekeeping: every fifth session (15, 20…) or when this file passes ~45 KB, move all but the last three entries to the current archive volume (DEVLOG-archive-2.md; a new volume when it would pass ~45 KB).
- **Open questions for Omer:** DESIGN §5.2 — the draft terrain yield rows (he asked what the question means; see Session 12c); culture groups and naming (later).

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
