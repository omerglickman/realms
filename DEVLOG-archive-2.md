# Realms, Kings and Other Stuff — Development Log, archive volume 2

Sessions 10 onward, moved out of DEVLOG.md in batches (volume 1, DEVLOG-archive.md, holds Sessions 0–9c). Each volume stays under ~45 KB so a session can read and mirror it whole; when this one passes that, start DEVLOG-archive-3.md.

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
