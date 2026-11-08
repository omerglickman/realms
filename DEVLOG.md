# Realms, Kings and Other Stuff — Development Log

Every chat session appends an entry here at the end, **even if the work is unfinished or broken**. The next session reads the "Current state" block first, then the latest entries. Keep entries factual: what was done, how, what broke, where to continue.

---

## CURRENT STATE (overwrite this block every session; keep it under ~6 KB, present tense, no session history)

- **Phase 2 — units, movement and building the land — IN PROGRESS.** Phase 1 signed off 2026-11-07 (numbers deliberately untuned until the Phase 2 sinks exist). **Done: session 1 (units + movement: 1a the sim, Session 14; 1b the UI, Session 15; 15b tier upgrades; 15c sticky parents and cluster leadership), session 2 (work-bands, roads, bridges — Session 16).** **Next: session 2b — castles (DESIGN §3.5, decided 2026-11-08), then session 3 levies.** The Government & Institutions design session comes after Phase 2.
- **Repository:** GitHub `omerglickman/realms` (private), branch `main`. **Read `CLAUDE.md` there for the session protocol and commands, `ARCHITECTURE.md` for the module map, `UI-DESIGN.md` before touching `src/ui/`.** Tests: 162 passing. `npm run smoke` (headless Chrome over the built game: raising, forming, disbanding settlers; raising a work-band and ordering a road; send food); `npm run shots` screenshots every page.
- **How Omer plays:** `realms.html` from disk; it opens on his starting position (`scenarios/start.json`, "vinral-start" rev 1: 60 settlements, ≈248k people, February year 1); "Bare map" loads `maps/testmap.json`. A new map or position from Omer: `npm run mapdiff`, `inspect.ts`, `rebaseAsStart`, bump `meta.revision`, commit, rebuild, deliver. Saves are state v8 (older saves migrate).
- **What the build does now:**
  - *Phase 1 (ARCHITECTURE.md has the modules):* hex map + map editor; four tiers with zones, clusters, cohort demography with hunger, migration, the granary brake and the pull factor; farming / herding / fishing / hunting, granaries, the tithe; timber / stone / goods stockpiles, private hands → tax and goods, Markets, 16 buildings; partial staffing (§3.2b rule 1). The Session 13 UI: ledger strip, hover cards, ledgers, icons, zoom levels.
  - *Units (Sessions 14–15):* **settlers** and **work-bands** raisable (muster from the cluster and own settlements within 3 hexes; coins, timber, provisions); orders move (A*; mountains a month; a river hex is two banks, crossed by a bridge or a settlement) with then-settle / disband; **settle** on any land hex but mountains outside every work zone; foraging outside the borders; **Send food**; shield markers with the glide, the unit card, the Recruitment page and raise dialog.
  - *Tier upgrades (15b–c):* Become a town / city / metropolis at the gates 1,500 / 6,000 / 36,000 (metropolis step a placeholder); the settlement stays under its old parent; cluster Leadership (Make leader / Split off).
  - *Roads and bridges (Session 16; DESIGN §3.2b rule 7, §3.4):* `data/infrastructure.json`; `state.infra` {roads by cell (1 dirt, 2 paved), bridges}; a **work-band** takes a **build order** (`unit.build`; exclusive with the move order): *Build here*, *Road to…* (A* over cells, rivers crossable at a planning penalty, a bridge inserted wherever a river hex needs one), *Bridge at…* (built from the bank beside the hex); it walks to each job, pays the materials when work on a hex begins (covering cluster, then realm; waits if short), works at people / 300 speed (dirt 2 months + 30 timber, paved 6 + 60 stone over a dirt road, bridge 6 + 60 timber + 30 stone, which carries a dirt road) and carries on to the next hex the same month; a cancelled project keeps its progress and the same order resumes it. **Movement:** a step between two road hexes costs terrain × 0.5 (dirt) / 0.25 (paved), never under the minimum — **minimums dirt 0.5, paved 0.25 and paved factor ¼ (Omer, 2026-11-08)**; the link is the lower level, a settlement's hex counts as dirt road; mountains cost 4 × the factor with a road, a whole month without. Map: `render/infraLayer.ts` (dirt ribbon, stone band, bridge deck; each segment a seeded S-curve, so roads meander — bridges almost straight); unit card Build here / Road to… / Bridge at… with a preview (hexes, months, materials, bridges). Headless: `npm run sim -- --scenario roads --from Hugeopolis --to Omerburg [--level paved]`.
- **Placeholders and limitations:** instant shipping and instant muster; roads move units only (food sharing by road, §5.15, the end of the phase); no quarries / lumber camps / watchtowers yet; roads belong to no faction, no upkeep or decay; `replaceMap` leaves `infra` alone; levies not raisable; city → metropolis upgrade a placeholder; an upgrade runs beside the build queue; a mustering party is cancellable only in the session it was raised in; the glide moves a whole group's shield; flat realm cap; administration quality = hall staffing.
- **Numbers to remember:** model scale ×3 (a village 900, a town 9,000, a city 24,000; farm hex 600 fed / 90 hands); gates 1,500 / 6,000 / 36,000; influence rings 1/3/5/6; settlers 4 move points, work-band 5; a band of 300 lays a dirt-road hex in 2 months; a dirt step on plains costs 0.5 point (settlers: 8 hexes a month), paved 0.25 (16 a month).
- **Next steps (in order):**
  1. **Omer plays the Session 16e build**; open under DESIGN §5.17: work speed, bridges from the bank, materials per hex; his look at the (now clearly curved) roads up close.
  1b. **Docs:** DESIGN.md is split (Session 16c) into DESIGN.md (core + index + open decisions + glossary), DESIGN-units / -settlements / -people-economy / -history; every Project doc is under ~35 KB. Keep it that way: a file nearing 35 KB gets split again.
  2. **Session 2b — castles and forts** per DESIGN-units.md §3.5 (read it whole; `data/castles.json`; castle kinds on a seven-rank ladder — append castle tiers to `TIERS` with explicit ranks so saved tier indexes stay valid; castle service as a labour-planner job; the siege reserve; garrison capacity; fortify order; ruin / fort decay; pathfinding hook). Quarries / lumber camps (×2 a hex's material output; needs `economy.ts` gathering to read a per-hex multiplier) and watchtowers can ride along or follow.
  3. Session 3 — levies (`takeMen` exists) with upkeep; session 4 if needed — groups, hierarchical pathfinding, tuning; **roads and food sharing** at the end of the phase (§5.15).
  4. **Government & Institutions design session** (DESIGN §4.3) — after Phase 2: opens with the sprawl curve and the §4.3 hooks list.
  5. Housekeeping: DEVLOG-archive-2.md is at ~43 KB — **the next archive batch (Session 20) opens DEVLOG-archive-3.md.**
- **Open questions for Omer:** DESIGN §5.17 (work speed, bridges from the bank, materials per hex); whether an upgrade may run beside a building project; the castle numbers in §3.5 (all draft); the river-mouth reading (Session 14); the unit marker shape; the raise dialog's muster list for a metropolis; draft terrain yield rows; village naming ("New <home>" a placeholder for §4.10).

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

Sessions 0–13e (planning, Phase 0, the headless Phase 1 model, the ×3 scale, the faction decisions, settlements on the map, the UI pass, the starting position and the realism knobs, the cluster/tithe decisions, clusters and the tithe, the granary brake, buildings and materials, the private economy, the reorganization, Omer's verdicts on the private economy, the UI overhaul and its follow-ups — icons, zoom levels, cubes, shorelines, rivers) live in **DEVLOG-archive.md** (Sessions 0–9c) and **DEVLOG-archive-2.md** (Sessions 10–13e). Entries are moved there in batches when this file grows past ~45 KB, into volumes of under ~45 KB each; the Current state block above is always complete on its own. The per-module inventories that used to live in the Current state block ("What works (Session N)") were folded into the repo's **ARCHITECTURE.md** on 2026-11-05 (Session 12b); the session entries below keep the detail.

---

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

## 2026-11-07 — Session 15 — Phase 2 session 1b: the unit UI

**Phase:** 2 — **Goal of session:** everything the player sees of units (UI-DESIGN 1.5 §4–6): the Recruitment page, the raise dialog, shield markers with the gliding move, the unit card with its orders, Send food in the cluster ledger; the smoke test and the screenshots extended. No rule changes.

**Done:**
- `src/ui/icons.ts`: `settlers` (a covered cart), `workband` (crossed pick and shovel), `levy` (spear and round shield); preloaded in the `MAP_MARK` style with the tier icons.
- `src/ui/render/unitLayer.ts` (new): one heater shield per occupied hex (faction fill, ink border, the icon in parchment, a count for a group, 60 % while forming, offset to the upper-left of a settlement marker, never under 7 screen px, icon hidden at zoom level 3, a vermilion dot when `report.blocked`); white ring for the selected / hovered unit; the selected unit's remaining route as a dotted ink line with a ring on the destination; the **route preview** (dotted white line + a "N mo · settle" label) while targeting; `animate(paths)` + `tick()` — the glide, ≈ 120 ms a hex with ease-in-out, the settlement offset eased in over the last hex; `unitAtWorld` hit-tests shields; `shieldAt` / `shieldOffset` / `shieldSize` for the card.
- `src/ui/panels/unitCard.ts` (new): the pinned card (`#unitcard`, the hover card's shape, faction-colour edge): type icon and name, people · hands, food months with a gauge marked at the chosen months, home (a link), bound for + what on arrival, arrives in N months (or "no way there"), state (`unitState`: mustering / marching / marching to settle / going home / blocked / arrived / foraging / waiting), warnings (forming, blocked, starving, foraged vs eaten, bags nearly empty), and the orders **Move** / **Settle at…** / **Settle here** (disabled with the reason) / **Disband** (tooltip names the target and the walk; disabled with the reason) / **Cancel order**.
- `src/ui/panels/settlementModal.ts`: the **Recruitment** page — cubes ordered mustering (gold, Cancel, click selects the party) → available (green, click opens the dialog) → unavailable (greyed; disabled types say which session brings them); `unitCostChips`; tooltips carry the rule in words (who leaves, the muster reach, the tax dent in a town, what comes from the realm stockpile); tables "Parties here" and "Raised here, now afield" with links to the cards.
- `src/ui/panels/raiseDialog.ts` (new): `RaiseDraft` (type, at, muster per source, provisionMonths, dest, name), `newRaiseDraft` / `distribute` (the raising settlement's spare hands first, then the other sources by distance, then the raising settlement up to half its people), `draftSpec`; the dialog (`#dialog`, above the ledger): size slider (to three times the usual party, min 3,000, within the pool) with the reckoning ("750 hands at 62 % hands per head → 1,210 people"), provisions with what leaves the granaries and the harvest distance, destination (Pick on the map / Pick another / Clear; walk in months; founds a village or the reason not), village name, the muster table (people, spare hands ≈ people, food months, a field each), cost chips (coins, timber with the realm's share, people, food, the tax dent), Raise disabled with `raiseCheck`'s reason. Typing refreshes the derived parts in place so inputs keep focus.
- `src/ui/panels/clusterModal.ts`: `sendFoodForm` / `wireSendFood` on the Food page (from the fullest member to the hungriest by default; amount preset to what brings the hungriest to 3 months, capped at a quarter of the source's stock).
- `src/ui/app.ts`: `selectedUnitId` / `hoverUnitId`; targeting `mode` (`order` for a unit with `then` none / settle, `pickDest` for the dialog — the ledger and dialog hide, the status strip says what to click, Esc goes back); `previewTo` caches the A* per hovered hex; `targetClicked` (the unit's own hex = Settle here / clear the order; the raising settlement's own hex = no destination); `startOrder`; `advance(1)` records each ordered unit's route before `endTurn` and hands the walked prefix (`report.moved`) to the layer for the glide; clicks hit shields before settlements; opening a unit card closes a settlement / cluster ledger and vice versa; the raise's inverse is kept per unit for Cancel (`editor.lastInverse()`); the hovered hex's parties in the status strip; Esc order: menu → pick → dialog → targeting → ledger → card → selection; help page updated.
- `src/sim/commands.ts`: `sendFood` logs an event ("X sent N food to Y") — the one sim touch.
- `scripts/smoke.py`: raises settlers from the cluster root's Recruitment page, forms them, checks the card's orders, disbands on the spot, sends food in a cluster. `scripts/shots.py`: the Recruitment page, the raise dialog, the unit card, the move preview.

**How it was done / decisions of note:**
- The shield is drawn once per hex, not per unit — a group is one shield with a count — so the glide and the hit test work per hex. The side effect: when one unit of a group marches, the whole group's shield glides, and the stay-behinds reappear at the old hex after the glide (noted as a limitation; groups proper come in session 4).
- The glide needs the path, which the sim does not record; `advance` plans every ordered unit's route before the month and keeps the first `report.moved` nodes, which is exactly what `walk` followed (same route, same state). Run years does not animate.
- Cancelling a muster needs the raise's exact inverse (who gave what); the UI keeps it per unit for the session. After a reload the Cancel says so and the party forms. A sim-side record of the muster on the unit would make it durable — left for Omer to say whether it matters.
- The muster slider's upper bound was first "half of everyone in reach" (70,000 at Hugeopolis), which put the default at the far left; it now runs to three times the usual party.
- The raise dialog is a separate element above the modal, not a modal page, so a monthly re-render of the ledger does not destroy its inputs; it re-renders fully only on a state change.

**Design decisions made by Omer this session:** none (the UI as decided in 13f; details above are Claude's and listed as open questions).

**Broken / unfinished:** nothing known. Not verifiable headless: the glide itself (software rendering runs at ~5 fps, the frame lands after it ends) — Omer's eye. Worth his eye too: the unit card closing the ledger; the long muster table at a metropolis; the shield at the far zoom (7 px).

**Tests & build:** pass (140/140; `tsc` clean; build clean; `npm run smoke` OK with zero console errors; `npm run shots` reviewed).

**Commit(s):** `phase2: the unit UI — Recruitment page, raise dialog, shield markers, glide, unit card, Send food (Session 15)` (code and docs together).

**Build delivered:** `realms.html` (Session 15).

**Next session should:**
1. Fix what Omer reports from playing the build; take his answers on the open questions.
2. Phase 2 session 2 — work-bands, roads and bridges (Current state → Next steps 2); forts/castles clusters (§5.14) to be decided first.

## 2026-11-07 — Session 15b — Tier upgrades; unworked hexes marked

**Omer's notes on the Session 15 build:** everything works. (1) On Land & Food, mark the hexes and jobs that are not being worked — grey them, order them last, or tag them. (2) He needs the village → town → city → metropolis upgrade now to test whether a newly settled cluster is viable (it was planned for session 3). Otherwise continue.

**Done:**
- **Hex table** (`settlementModal.ts` `hexRows`): rows ordered worked → partly worked → not worked (most food first inside each); a job nobody works is greyed with "nobody works it" in its title; a "partly" (gold) or "not worked" (vermilion) tag per row; unworked rows faded; the note counts both.
- **Tier upgrades** (DESIGN §3.2b rule 10): `data/settlements.json` `upgrades.steps` (village → town 10,000 / 300 timber / 150 stone / 12 mo; town → city 40,000 / 600 / 600 / 24 mo — as decided; **city → metropolis 100,000 / 1,500 / 1,500 / 36 mo, `placeholder: true`**); `src/sim/upgrades.ts` (`upgradeStep`, `canUpgrade` — gate, already rising, money, cluster materials — `startUpgrade`, `upgradeMonth` in `economyMonth` after construction, `completeUpgrade` swaps hall and granary and sets the tier, `revertTier`); `Settlement.upgrade: UpgradeProject | null` (state **v7**, migration); commands `upgradeSettlement` ⇄ `cancelUpgrade` (full refund) ⇄ `restoreUpgrade`, and `finishUpgrade` ⇄ `revertUpgrade` for the editor / undo. UI: an **upgrade card** on the Overview (cost chips with the lacking items in red, the gate, the reason, Begin; while rising: progress, months left, Cancel), the title badge "Village → Town", the hover card's "Rising to". `tests/upgrades.test.ts` (5): data, refusals, pay / progress / completion (zones grow, hall and granary swap, event), cancel / undo / finish / revert round trips, save + v6 migration. Smoke: a village's overview card; `smoke_land.png`.
- Verified in the browser: Village 29 (2,026 people) began its rise in February year 4 and was a town in January year 5; a shrunken Hugeopolis shows 8 partly worked and 11 unworked hexes correctly tagged.

**Decisions of note (Claude's, flagged):** an upgrade runs **beside** the build queue (it is the hall growing, not a project of the spare hands) — no builders, fixed months; the metropolis step exists only so Omer can test a full cluster; its real prerequisites stay PROPOSED in §3.3.

**Design decisions made by Omer this session:** none new (rule 10 as decided; the metropolis step is a placeholder at his request to test).

**Broken / unfinished:** nothing known.

**Tests & build:** pass (145/145; `tsc` clean; build clean; `npm run smoke` OK, zero console errors).

**Commit(s):** `phase2: tier upgrades (village → town → city → metropolis placeholder); unworked hexes marked (Session 15b)`.

**Build delivered:** `realms.html` (Session 15b).

**Next session should:**
1. Phase 2 session 2 — work-bands, roads and bridges (Current state → Next steps 2); forts/castles clusters (§5.14) to be decided first.

## 2026-11-07 — Session 15c — Sticky parents after an upgrade; cluster leadership and split

**Omer's rule (DESIGN §3.3, DECIDED):** a subordinate village that grows into a town stays in the cluster under its old parent town; when a cluster holds more than one settlement of its highest tier, the cluster ledger offers to choose which leads or to split them into two clusters.

**Done:** `resolveParent` accepts an **equal-tier parent by override only** (never automatically); `canOverrideParent` (same faction, rank not lower, within the parent's influence); `resolveAllParents` breaks a ring of overrides at the lowest id. `completeUpgrade` sets `parentOverride = parent` when the parent's rank is no longer higher; `revertUpgrade` restores the override it replaced. New command **`setParents`** (a list of `{id, parent}`; validates with `canOverrideParent`; self-inverse) — "Make leader" = free X and put every other peer under X; "Split off" = clear X's override. `clusterPeers` in `upgrades.ts`. UI: the **Leadership** block on the cluster Overview (peers with people and food; *Make leader* — disabled naming the peers beyond its influence — and *Split off*; the ledger then opens on the new leader's cluster). Tests +2 (147): the upgraded village stays under its town; split, lead, ring-breaking, an invalid parent refused, undo restoring the override. Verified in the browser on a scenario with Midpass raised to a city under Hillside: Make leader → "Midpass cluster, headed by Midpass"; Split off → two clusters, unchanged the next month.

**Decisions of note (Claude's):** an override to an equal tier is valid only inside the parent's influence rings, as any subordination is; after a split the villages follow the automatic rule (nearest covering higher tier), so a split redistributes them by distance.

**Tests & build:** pass (147/147; `tsc` clean; build clean; `npm run smoke` OK). **Commit:** `phase2: a settlement keeps its parent after an upgrade; cluster leadership and split (Session 15c)`. **Build delivered:** `realms.html` (Session 15c).

**Next session should:** Phase 2 session 2 — work-bands, roads and bridges; forts/castles clusters (§5.14) first.

## 2026-11-08 — Session 15d — Castles and forts decided (docs only)

**Omer's vision** (his table: fort / small / medium / large castle — residents, military capacity, builder, rank, hexes worked, influence) discussed and settled; written as DESIGN §3.5, §5.14 resolved, glossary; ROADMAP 0.6d splits session 2 into roads (2) and castles (2b).

**Decided by Omer:** the seven-rank ladder (village · small castle · town · medium castle · city · large castle · metropolis) with castles as parents by rank — a large castle in a city's rings is the city's parent; **staff are not residents** but hands lent by the settlements within the castle's influence rings, planned after their buildings and before their fields, capped at a third of a settlement, **paid by the treasury** and tax-exempt; military capacity = garrison, units move in and out freely, inside the borders and fed by the castle; the castle keeps a **siege reserve** for its full capacity (own hexes first, then subordinates' surplus, never more than the reserve and its spoilage; no tithe); build by work-band (25 % faster on a fort), upgrade in place by the cluster's spare hands or a present work-band; placement on any free land hex incl. hills and mountains, no minimum distance; a castle unstaffed for 12 months becomes a ruin; forts by any military unit, gone 12 months after abandonment; the control zone (slowing, attrition, an impassable castle hex) for Phase 4, hook in Phase 2; a castle may house a governor when §4.3 exists. **Numbers (build, upkeep, wages, reserve months) are Claude's drafts** for Omer to tune.

**Tests & build:** unchanged (147/147; the Session 15c build stands). **Commit:** `docs: castles and forts decided — DESIGN §3.5 (Session 15d)`. **Build delivered:** none.

**Next session should:** Phase 2 session 2 — work-bands, roads and bridges; then 2b castles.

## 2026-11-08 — Session 16 — Phase 2 session 2: work-bands, roads and bridges

**Phase:** 2 — **Goal of session:** work-bands raisable and building on the map: dirt and paved roads, bridges, "road from X to Y" as one order, roads in pathfinding, the road layer, the unit card's build orders; castles split off as 2b.

**Done:**
- `data/infrastructure.json` (items, the work-rate rule, the movement rule, planning weights); `units.json`: work-band `enabled`, `canBuild`.
- `src/sim/infrastructure.ts` (accessors, `stepCostBetween`, `takesWholeMonth`), `src/sim/workbands.ts` (`BuildOrder`, `WorkProject`, `makeBuildOrder`, `pendingSteps`, `orderSummary`, `buildMonth`); `pathfinding.ts` now prices steps by road (`stepsThisMonth` / `walkMonths` take the state and start hex), `isBridged` knows built bridges, `needsBridge`, `planRoadRoute`; state **v8** with `infra`; `orderUnit` carries an optional `build` order (inverse restores both).
- UI: `render/infraLayer.ts`; the unit card (road-kind select, Build here, Road to…, Bridge at…, Building / Still to do / At work on / Unfinished rows, a "building…" state); build targeting mode with the route preview; the glide for building bands (`report.trail`); road text on the hex status line.
- Tests +15 (`tests/workbands.test.ts`: v7 migration, the movement rule, road-shortened routes, bridge opening a river, dirt in two months for 30 timber, speed by people, road X→Y with and without a river, paved over dirt, waiting for materials, refusals, undo, save/load mid-project, resume without paying twice); smoke extended (raises a band, "Road to…" by clicking the map, runs months); `npm run sim -- --scenario roads`.

**How it was done / decisions of note (all Claude's drafts, listed as DESIGN §5.17):**
- A band does one of: walk, or work. Each month has a time budget of 1: a step costs cost/movePoints of it, work uses the rest at the band's rate; finishing a hex moves on to the next in the same month, so a 6-hex road does not take six months of walking.
- Materials are paid when work on a hex starts (cluster covering the hex, then realm); a band without them waits (`report.blocked` = "waiting for 30 timber"). Cancelling keeps `unit.work` and its progress; an order for the same item and hex resumes it.
- A bridge needs its hex to have two banks (`needsBridge`); source and fork hexes are open and need none. It is built from the bank beside it (the previous hex of the route, or the nearest bank hex) and lays a dirt road on its hex.
- The link rule: a step is road-priced only when **both** hexes have a road; a settlement hex counts as a dirt road; the link level is the lower of the two. Mountains with a road cost 4 × the factor instead of the whole month.
- Plan routes use A* over cells (not banks) with `bridgePenalty` 6 and `reuse` 0.4, so roads follow existing roads and settlements and cross rivers where a bridge is already (or where it is shortest).

**Findings (headless, `--scenario roads`, start position, one band of 300):**
- Hugeopolis → Hillside, dirt: 16 hexes, 13 jobs, 390 timber, ≈ 26 band-months → built in **29 months**; the walk goes from 4 months to 4 for settlers (3 for the band): **with `minCost` 1 a road on plains saves almost nothing**. With `minCost` 0.5: 2 months.
- Hugeopolis → Omerburg, dirt: 19 hexes, 14 jobs, 1 bridge, 450 timber + 30 stone → **36 months**; the walk falls **9 → 5 months** (36 hexes round the river → 18 across the bridge) — all of it the bridge; with `minCost` 0.5: 3 months.
- Hugeopolis → Hillside, paved: 780 stone, 107 months; the walk is exactly the dirt road's. Under the decided rules a paved road moves nobody faster than a dirt one where the terrain costs 1 — see §5.17.
- 162 tests, build and smoke pass; no console errors.

**Design decisions made by Omer this session:** none. (Open: §5.17.)

**Broken / unfinished:** quarries / lumber camps and watchtowers (need `economy.ts` to read a per-hex multiplier) not built — the road cluster was enough for one session; `replaceMap` does not clear `infra`; a band with a cancelled order stays "paused" with its project indefinitely; no road upkeep or ownership. The glide for builders is by `report.trail` (not verifiable headless).

**Tests & build:** pass (162/162; `tsc` clean; build clean; `npm run smoke` OK).

**Commit(s):** `phase2: work-bands, roads and bridges (Session 16)`.

**Build delivered:** `realms.html` (Session 16).

**Next session should:**
1. Take Omer's verdicts on §5.17 (above all `movement.minCost`); fix what he reports from playing.
2. Phase 2 session 2b — castles and forts (DESIGN §3.5).

## 2026-11-08 — Session 16b — Road minimums decided; roads meander

**Omer's notes on the Session 16 build:** (1) minimum step cost **0.5 for a dirt road, 0.25 for a paved road**; (2) a road should be a slightly meandering line, not straight; (3) asked why quarries / lumber camps need an economy change (answered in chat); (4) DESIGN.md size — first write everything that belongs in the docs, then plan the split together.

**Done:** `data/infrastructure.json` `movement.minCost` is now per level `{1: 0.5, 2: 0.25}` (`minCostFor(link)` in `infrastructure.ts`; `minStep()` for the A* heuristic is the smallest of them); the road layer draws each segment as a cubic S-curve (`MEANDER` 0.17 of the hex distance, a hash of the two cells, `BRIDGE_BEND` 0.25 for a deck); `headless/roads.ts` prints one "after" walk; the movement test now checks dirt 0.5 on plains and paved 0.33. DESIGN 0.6b (§3.2b rule 5, §3.4, §5.17(a) resolved), UI-DESIGN 1.7a, ARCHITECTURE updated.

**Findings (headless, start position, one band of 300):** Hugeopolis → Hillside dirt: walk 4 → **2 months** (16 → 8 points), built in 29 months; Hugeopolis → Omerburg dirt: 9 → **3 months** (settlers; band 8 → 2), built in 35; paved Hillside: still 2 months (8 → 6.13 points) for 107 months and 780 stone — paved saves little in months until its factor drops (¼ would reach the 0.25 floor on plains) or it carries food and trade (§5.15).

**Broken / unfinished:** the meander is not yet looked at close up (the smoke screenshot is at zoom 0.43) — Omer's eye; the paved factor stays ⅓ until he says otherwise; quarries / lumber camps / watchtowers as before.

**Tests & build:** pass (162/162; `tsc` clean; build clean; `npm run smoke` OK).

**Commit(s):** `phase2: road minimums 0.5 / 0.25, meandering roads (Session 16b)`.

**Build delivered:** `realms.html` (Session 16b).

**Next session should:** plan the DESIGN.md split with Omer (see Current state 1b), then session 2b castles.

## 2026-11-08 — Session 16c — DESIGN.md split into area files

**Omer's brief:** he did not know how a split works and left the plan to Claude ("do as you think optimal").

**Done:** DESIGN.md (69 KB, over the single-read limit the Project mirror needs) is now DESIGN.md (25 KB: reading rules, an index, §1–2, §3.1, §4.4–4.10, §5 open decisions, §6 glossary), **DESIGN-units.md** (§3.2, 3.2b, 3.4, 3.5; 16 KB), **DESIGN-settlements.md** (§3.3; 10 KB), **DESIGN-people-economy.md** (§4.1–4.3; 16 KB), **DESIGN-history.md** (the change log; 5 KB). Section numbers unchanged; text moved verbatim (version 0.7). CLAUDE.md's start and close steps point at the new files. All five mirrored to the Project (the old Project DESIGN.md was still v0.6, so the mirror also brings in 0.6a/0.6b).

**Tests & build:** unchanged (162/162; docs only). **Commit:** `docs: split DESIGN.md into area files (Session 16c)`. **Build delivered:** none new.

**Next session should:** take Omer's answer on the paved-road factor (§5.17b) and his look at the meandering roads; then session 2b castles (DESIGN-units.md §3.5).

## 2026-11-08 — Session 16d — Paved road factor ¼

**Omer:** paved should be significantly quicker than dirt; other benefits put aside. **Done:** `data/infrastructure.json` `movement.factor["2"]` 0.3333 → 0.25 (the paved minimum now binds on plains: 0.25 vs dirt 0.5); the movement test updated (forest paved 0.75, plains paved 0.25); DESIGN 0.7a (§3.2b rule 5, §5.17b resolved). **Finding:** Hugeopolis → Hillside walk with the paved road: 4 → 2 months, 16 → 5.25 points (dirt 8); 107 months and 780 stone to build — the walk is still 2 months because a settler's month is 4 points, so paved pays off on long routes and for bigger movers.

**Tests & build:** pass (162/162; `tsc`, build, smoke OK). **Build delivered:** `realms.html` (Session 16d).

**Next session should:** session 2b castles (DESIGN-units.md §3.5).

## 2026-11-08 — Session 16e — Roads: the curve made visible

**Omer:** the 16d build showed no curve in roads. **Found:** the Bézier was already used for every road segment, but each bend was `(hash − 0.5) × 2 × 0.17`, so many segments got a near-zero bend and the rest were barely perceptible. **Done:** `render/infraLayer.ts` — `MEANDER` 0.17 → 0.42 and each bend now has a random side and a magnitude of 40–100 % of it (never straight); bridge decks still bend a quarter as much. UI-DESIGN §6 and its change log (1.7b) updated. No sim change.

**Tests & build:** pass (162/162; build and smoke OK, zero console errors). Not checked by eye in a close-up (no road exists in a fresh scenario to screenshot); the geometry puts the mid-curve about 0.1 hex-lengths off the straight line. **Commit:** `phase1: roads meander clearly (Session 16e)`. **Build delivered:** `realms.html` (Session 16e).

**Next session should:** take Omer's verdict on the curve's strength (`MEANDER` in `infraLayer.ts` is the one knob); then session 2b castles (DESIGN-units.md §3.5).
