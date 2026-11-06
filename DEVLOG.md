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
  4. Housekeeping: every fifth session (15, 20…) or when this file passes ~45 KB, move all but the last three entries to DEVLOG-archive.md.
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

Sessions 0–9c (planning, Phase 0, the headless Phase 1 model, the ×3 scale, the faction decisions, settlements on the map, the UI pass, the starting position and the realism knobs, the cluster/tithe decisions) live in **DEVLOG-archive.md**. Entries are moved there in batches when this file grows past ~45 KB; the Current state block above is always complete on its own. The per-module inventories that used to live in the Current state block ("What works (Session N)") were folded into the repo's **ARCHITECTURE.md** on 2026-11-05 (Session 12b); the session entries below keep the detail.

---

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

## 2026-11-05 — Session 11 — Buildings, materials, pull factor

**Phase:** 1 — **Goal of session:** starter buildings with effects + a build queue; materials; the pull factor (DEVLOG next steps 2). Omer decided at the start: the proposed building set plus military buildings (Archery Range, Stables with pasture, a melee training building); **materials now**, in his model — every cluster accumulates its own timber and stone, a settlement can build with what its cluster has, a share of the surplus goes to the faction's central stockpile for the player to ship, the share to grow with administration; pull at 4 %/yr; one project at a time with cancel.

**Done:**
- Data: `data/buildings.json` (table in DESIGN §3.3 — costs, months, labour, required hex, effects; military and Phase-4 buildings as data only), `data/economy.json` `materials` (timber by terrain yield 0/60/120/180/240 per 30 hands; stone 90 per 30 hands on a Stone hex; reserve 300/150; surplus share 10 %), `data/demography.json` trickle on at 0.04 with `requireVacancies`.
- Sim: see Current state → What works (Session 11). Labour order is now buildings → fields → **construction** → **gathering**, all of the last two from the spare hands; "idle hands" renamed "spare" in the UI (the sim field keeps its name).
- Commands: `queueBuilding` (pays at once from the cluster, own stock first) ⇄ `cancelBuilding` (exact refund) ⇄ `restoreProject`; `transferMaterials` between `faction:<id>` and a settlement, capped at the source, self-inverse.
- UI: Build picker + Start + Cancel + Materials row in the settlement panel; stockpile in the cluster panel; realm stockpile, treasury and a Send form in the realm panel; the hover card shows the running project. Player actions go through `editor.execute`, so Ctrl+Z undoes a build order in edit mode and the autosave carries projects and stocks.
- Headless: `--scenario start --builder 1 --vacancies 0|1 --surplus X`; the yearly table gained materials, vacancies, buildings, treasury and the realm stockpile; a cluster table with stockpiles and Stone hexes.
- Tests: 16 new (112) — data sanity; gathering by spare hands only (a hands-short village gathers nothing); cluster pooling and own-stock-first payment with an exact record; canBuild reasons (tier, duplicate, running project, river/shore/pasture hex, stockpile); queue/cancel/undo round trip; construction time at full and partial labour with the event; effects (mill +15 % farming only, great granary 36 mo / half spoilage, workshop → goods, market → treasury, goods conserved); December surplus share proportional to holders; transferMaterials cap and inverse; pull: a rich town pulls nobody, a hands-short town pulls at most its vacancies, the old unconditional trickle still works with the condition off; v3 → v4 save migration; 20-year determinism with a project.

**Findings (start position, 40 years, Omer's knobs, scripted builder):**
- **The pull factor never fires.** Towns and cities have 50–86 % of their hands spare (Hugeopolis: 19,000 hands, 2,400 needed), so no settlement ever has vacancies; a 300-hand workshop changes nothing. The rule is right (tests: a hands-short town pulls, capped at its vacancies); urban work at this scale would have to employ thousands. Raised as DESIGN §5.10.
- **Stone is scarce, timber is not:** ~62,000 timber vs ~4,800 stone gathered realm-wide in 40 years; Omerburg's 19-settlement cluster works no Stone hex and can only build stone-free things unless the player ships it stone (which works). The realm stockpile reaches ~200,000 timber / 12,000 stone — the 10 % share over a 300 reserve is a lot when clusters hold 20,000.
- Only 4 of the 60 settlements work a river hex, so mills are rare on this map. The builder finished 55 buildings in 40 years (32 chapels, 6 workshops, 6 markets, 6 great granaries, 5 wharfs); six markets put 122,000 coins in a treasury with nothing to buy.
- Population is unchanged by any of it (242k at year 40 either way): buildings do not yet touch food except mills and wharfs, and those are few here.

**Design decisions made by Omer this session (DESIGN v0.4):** §3.3 buildings table incl. military; §4.2 materials model; §4.1 pull factor; shipping instant as a placeholder.

**Broken / unfinished:** see Current state → limitations. Mill and Wharf bonuses apply to the whole settlement's farming/fishing (not per hex) — a reading of "+15 % farming output", marked draft.

**Tests & build:** pass (112/112; `tsc` clean; build clean; headless Chromium: realm → cluster → settlement panels, Build picker with reasons, Start (cluster stock drops by the cost), 4 months of progress, Cancel (refund), rebuild and finish with the event in the top bar, Send 100 timber from the realm; zero console errors).

**Commit(s):** `phase1: buildings with effects + build queue, materials …` (f80f478) + docs commit.

**Build delivered:** `realms.html` (Session 11).

**Next session should:**
1. Omer's verdicts on §5.10 and the materials numbers; his feedback on the build UI.
2. Tuning; Phase 1 acceptance review; then the Government & Institutions design session.

## 2026-11-05 — Session 11b — The private economy decided

**Omer's decisions (DESIGN v0.4a), from his observation that the "spare" hands of cities are not idle — medieval townspeople mostly worked in the private sector and were visible to the crown as revenue:** §4.2b **private economy** — in towns and above, every hand not in a building or field is a *private hand* producing tax (faction treasury) and goods (cluster stock) by itself, scaled by administration; using them (construction, levies, settlers) costs the tax they would have paid; Workshop/Market become multipliers, not employers; the player does not micro-manage it. **Buildings cost money + labour + materials + time**; money is faction-wide. **Stockpile caps** (cluster cap raised by Warehouses, overflow to the realm, realm cap by administration) replace the flat surplus share. **Pull factor** runs on prosperity (fed with margin) instead of vacancies; §5.10 resolved. Hook noted for §4.3: a Town Charter policy. No code this entry; docs mirrored. **Next:** Session 12 builds it (Current state → Next steps 2).

## 2026-11-05 — Session 12 — The private economy built

**Phase:** 1 — **Goal of session:** build DESIGN §4.2b and the Session 11b decisions (DEVLOG next steps 2): private hands → tax and goods, money on every building, the pull factor on prosperity, stockpile caps with Warehouses; headless A/B; panels.

**Done:**
- **Private hands** (`economy.ts`, `data/economy.json` `privateEconomy`): in a town, city or metropolis every hand not in a building or a field is private; those not drawn to the building site or to gathering pay **0.2 coins a year** into the faction treasury and make **0.05 goods a year** into the settlement's stock, both × administration quality (the hall's staffing fraction). A village keeps *spare* hands and pays nothing. The dent — the tax forgone by the hands on the site — is reported as `taxLost`. Every town+ sells 20 % of its cluster's goods a year on its own (petty trade) at 1 coin each.
- **Money** (`data/buildings.json` `cost.money`, `commands.ts`, `buildings.ts`): every buildable building costs coins (Chapel 300 … Market 600, Workshop 800, Great Granary 900 … Walls 2,400, Citadel 6,000), paid from the treasury when queued (`paidMoney` on the project), refunded on cancel, taken back on undo; `canBuild` refuses with "the treasury lacks N coins". **Workshop** and **Market** are now multipliers with 30 hands each (+50 % goods per private hand; sells 60 % of the cluster's goods a year instead of 20 %). New **Warehouse** (town+, 600 coins / 150 timber / 60 stone, 6 months, 30 hands): +900 timber / +450 stone / +450 goods to the cluster's cap.
- **Stockpile caps** (`materials.ts` `clusterCap`/`realmCap`/`setStockCaps`): a cluster holds base 300 timber / 150 stone / 150 goods + 60 / 30 / 30 per member + its Warehouses; every month what it holds above that flows to the realm stockpile (taken proportionally from the holders); the realm holds 3,000 / 1,500 / 1,500 (a flat draft until administration exists) and loses the rest. The December 10 % share and the reserve are gone.
- **Pull factor on prosperity** (`data/demography.json` trickle `requireProsperous`, `prosperousSpareMonths` 4): the parent must be fully fed this year *and* hold ≥ 4 spare months at the next harvest (December stock in months − 9), reckoned before anyone moves. `requireVacancies` is gone.
- **Factions** carry a yearly ledger (`year`/`lastYear`: tax, sales, spent, overflowIn, lost); `GameState` v5.
- **Headless:** `--tax X`, `--caps 0|1`, `--prosperous 0|1`; the scripted builder now ships lacking materials from the realm stockpile before queuing, waits for the first thing on its list instead of skipping to cheaper ones, and has Market → Workshop → Warehouse → Great Granary first; the yearly table shows private hands, treasury, tax/sales/spent per year, realm stock and losses; the cluster table shows stock / cap, private hands, tax and buildings.
- **UI:** settlement panel — "private" wording, **Tax base** row (hands → coins and goods a year, the dent, the administration factor, the sales share), money in the Build picker and the gang's cost in tax in the blurb, tax in the Materials row; cluster panel — stock / cap, overflow this year, Tax row; realm panel — realm stock / cap with arrivals and losses, treasury with this year's and last year's tax / sales / spending, realm tax base.
- **Tests:** 117 (112 − the surplus-share test − the two vacancies pull tests + 8: money and goods per private hand, hall-staffing scaling, the dent, money pay/refund/undo/refusal, caps arithmetic and the ∞ switch, monthly overflow proportional to holders + realm loss + the faction's year roll-over, a Warehouse keeping the overflow, the pull on a prosperous vs a thin-granaried town, the unconditional trickle; the save test covers v3 → v5 and `paidMoney`; determinism now includes the treasury).

**Findings (start position, 40 years, Omer's knobs, scripted builder):**
- **The private economy pays ~14,000 coins a year** realm-wide (≈71,000 private hands) plus 3,500–5,700 from goods. A town of ~10,000 pays ~750 — Omer's "one modest building a year" rule holds *per town*. But the realm as a whole can afford ~20 modest buildings a year and builds 2–3: **money never binds** — stone does (Omerburg's 19-settlement cluster works no Stone hex) and so does one-project-at-a-time. The treasury reaches **675,000 coins** in 40 years with the builder on and 620,000 with it off; at `--tax 0.1` the builder finishes exactly the same 113 buildings. Money will only matter once the sinks exist (unit upkeep, institutions, characters' salaries, Phase 2 roads and settlers) or the prices rise ~×5. **Omer's call** (Next steps).
- **Caps + shipping make stone move.** With caps the realm stockpile fills to 3,000 timber / 1,500 stone within 5–10 years and the builder, shipping what a cluster lacks, finishes **113 buildings** in 40 years (59 chapels, 10 each of market / workshop / warehouse / great granary, 6 wharfs, 4 mills, 3 walls, 1 citadel) with 7,800 materials shipped; without caps (`--caps 0`) the clusters hoard 264,000 timber, the realm stockpile never fills, nothing is shipped and only 58 buildings are finished. The realm loses ~7,000 timber a year above its cap — timber is abundant, which is fine; the cap is a flat draft and belongs to the administration session.
- **The pull factor now fires** (23,000–34,000 people in 40 years, ~600–850 a year) and the **prosperity condition is the difference between growth and famine**: with it, hunger deaths total 6,657 (metropolis 118 a year) and the realm grows 247,700 → 259,200 (the great granaries and mills let the cities keep more and the brake lets them grow: Omerburg 25,600 → 53,900, Hugeopolis 31,700 → 51,700); with `--prosperous 0` (any fed parent) 61,000 people move, hunger is 15,492 (metropolis 346 a year) and the realm shrinks. With the pull off entirely, hunger is 2,913 and the realm is flat. Towns pay for it: 91,000 → 54,500 (the brake took ~20 % in Session 10b; the pull takes the rest to the cities). Villages are untouched (64,400 → 62,500) — they regrow what they send.
- Goods: ~2,500 in the clusters at any time, 1,000 goods a year made in Hugeopolis alone; the goods caps (810 for a 22-member cluster) are hit and overflow to the realm, where they are sold by nobody — the realm stockpile's goods are a loose end (a realm-level sale, or a Great Market).

**Design decisions made by Omer this session:** none new — this session built the Session 11b decisions (DESIGN v0.4a); DESIGN v0.4b records what is implemented and the two placeholder readings (gathering drawn from the private pool; realm cap flat).

**Broken / unfinished:** see Current state → limitations (money non-binding; gathering reading; the "paying more per head" clause; flat realm cap; realm goods unsold).

**Tests & build:** pass (117/117; `tsc` clean; build clean; headless Chrome on `dist/realms.html`: realm → cluster → settlement panels after 3 years, tax base "15,731 private hands → 3,146 coins and 787 goods a year", Build picker with money costs, Market bought for 600 coins (treasury −600, dent "−12 coins/yr while 60 build"), finished in 6 months with the event in the top bar and the sales share at 60 %, Send 30 stone from the realm; zero console errors; screenshots `s12_realm.png`, `s12_cluster.png`, `s12_settlement.png`).

**Commit(s):** `phase1: the private economy (DESIGN §4.2b) …` (71a2649) + docs commit.

**Build delivered:** `realms.html` (Session 12).

**Next session should:**
1. Omer's verdicts on the findings above — money (prices, tax rate, or wait for sinks), gathering as drawn-from-private, the cap numbers, what to do with the realm's goods.
2. Tuning against the headless curves; the Phase 1 acceptance review; then the Government & Institutions design session (DESIGN §4.3).

## 2026-11-05 — Session 12b — Reorganization for shorter sessions

**Why:** sessions were growing because of fixed overhead, not features — ~120 KB of Project docs read at the start and again at the close (the mirror needs a full read), no module map, no committed smoke test, and a DEVLOG Current state block that accumulated session history and API inventories.

**Done (Omer's OK 2026-11-05):**
- Repo: **`CLAUDE.md`** (the session protocol in short: what to read, commands, close steps) and **`ARCHITECTURE.md`** (module map, turn order, data files, state versions — updated in place, never by session); **`scripts/smoke.py`** as `npm run smoke` (headless Chrome: run years, open realm/cluster/settlement, buy a building, advance to completion, send materials; fails on console errors).
- DEVLOG Current state rewritten to a fixed shape (~5 KB, present tense, by feature); the inventories moved to ARCHITECTURE.md.
- DESIGN.md trimmed back to a contract (58 → 49 KB; the rest is the contract itself, read by section from now on): implementation notes and findings removed or cut to a pointer (they live in the DEVLOG entries), §5's resolved log and the change log condensed. No decision changed.
- ROADMAP A.2/A.3 updated: read DESIGN by section and ROADMAP only at phase boundaries; CLAUDE.md and ARCHITECTURE.md added to the document table; the smoke test in the protocol; one feature cluster per session.

**Tests & build:** unchanged (117/117; build clean; `npm run smoke` OK). **Commit:** `chore: CLAUDE.md, ARCHITECTURE.md, npm run smoke; docs slimmed (Session 12b)`. **Build delivered:** none (no code change; the Session 12 `realms.html` stands).

**Next session should:** follow CLAUDE.md; Current state → Next steps 1.

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
