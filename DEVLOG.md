# Realms, Kings and Other Stuff — Development Log

Every chat session appends an entry here at the end, **even if the work is unfinished or broken**. The next session reads the "Current state" block first, then the latest entries. Keep entries factual: what was done, how, what broke, where to continue.

---

## CURRENT STATE (overwrite this block every session; keep it under ~6 KB, present tense, no session history)

- **Phase 2 — units, movement and building the land — IN PROGRESS.** Phase 1 signed off 2026-11-07 (numbers deliberately untuned until the Phase 2 sinks exist). **Session 1 (units + movement) is complete: 1a the sim (Session 14), 1b the UI (Session 15). Session 2 — work-bands, roads and bridges — is next.** The Government & Institutions design session comes after Phase 2.
- **Repository:** GitHub `omerglickman/realms` (private), branch `main`. **Read `CLAUDE.md` there for the session protocol and commands, `ARCHITECTURE.md` for the module map, `UI-DESIGN.md` before touching `src/ui/`.** Tests: 140 passing. `npm run smoke` checks the built game in headless Chrome (now including raising, forming, disbanding a party and sending food); `npm run shots` screenshots every ledger page, the raise dialog and the unit card.
- **How Omer plays:** open `realms.html` from disk. It opens on his starting position (`scenarios/start.json`, "vinral-start" rev 1: 60 settlements, ≈248k people, February year 1); "Start position" reloads it, "Bare map" loads the empty test map (`maps/testmap.json`, "vinral" rev 3). When Omer sends a new map or position: `npm run mapdiff`, validate with `inspect.ts`, `rebaseAsStart`, bump `meta.revision`, commit, rebuild, deliver. Saves are state v6 (older saves migrate).
- **What the build does now:**
  - *Phase 1 (see ARCHITECTURE.md for the modules):* 160×100 hex map with yields and resources and a map editor; four settlement tiers with work / influence zones, contested hexes, subordination and derived **clusters**; cohort demography with hunger, famine migration, the granary brake and the pull factor; farming (60/40 Sept/Oct, ±12.5 %), herding, fishing, hunting, granaries, surplus up, the 10 % tithe; timber/stone/goods in capped stockpiles with instant shipping (placeholder), private hands → tax and goods, Markets, 16 buildable buildings; partial staffing of a hex (§3.2b rule 1). The Sessions 13–13e UI: ledger strip, hover cards, settlement / cluster / realm ledgers, icons, zoom levels, shorelines, rivers as water.
  - *Units — the sim (Session 14):* `GameState.units`; **settlers** raisable (`data/units.json`; work-band and levy are data, `enabled: false`). **Raise** with a **muster** from cluster members and own settlements within 3 hexes, provisions from the sources' granaries (settlers: months to the October harvest + 2), 1,000 coins + 90 timber from the cluster, the rest from the realm; the party forms on the hex and acts from the next end of turn. **Orders:** move (A*; costs 1/2/3, mountains a whole month, lake/sea impassable; a river hex is two bank nodes, bridged only by a settlement) with "then settle / disband"; **settle** (land but mountains, outside every work zone → village "New <home>"); **disband** into the closest non-starving own settlement within 3 hexes. Monthly: inside own borders the party refills from the covering cluster's granaries; outside it forages hex + ring 1 (fish/game full, farming 20 %, herding 30 %); empty bags → hunger. **Send food** between cluster members by hand.
  - *Units — the UI (Session 15):* the **Recruitment** page of the settlement ledger (cubes: mustering with Cancel → can be raised → greyed with the reason; parties here / afield); the **raise dialog** (size slider with the destination reckoning, provisions, a destination picked on the map with the route preview, village name, muster rows, cost chips, Raise); **shield markers** (faction colour, type icon, 60 % while forming, a count for a group, upper-left of a settlement marker, vermilion dot when blocked); the **glide** after End month (Run years jumps); the **unit card** (click a shield: people, food gauge, home, bound for, state, warnings; Move, Settle at…, Settle here, Disband, Cancel order); dotted routes and previews; **Send food** on the cluster ledger's Food page.
  - *Headless:* `npm run sim -- --scenario start --years 40 --builder 1 [--settlers 1|2] [--reach 10]` — the settler-spammer and the sprawl curve (Session 14 entry).
- **Placeholders and limitations:** instant shipping and instant muster; no roads/bridges; foraging ignores ownership and depletes nothing; levies and work-bands not raisable yet; a mustering party can be **cancelled only in the session it was raised in** (the UI keeps the raise's inverse; after a reload the party simply forms); the glide moves a whole group's shield when one member moves; pull's "paying more per head" clause unbuilt; administration quality = hall staffing; flat realm cap; map export carries no settlements.
- **Numbers to remember:** model scale ×3 (a village 900, a town 9,000, a city 24,000; farm hex 600 fed / 90 hands); gates town 1,500 / city 6,000 / metropolis 36,000; influence rings 1/3/5/6; realism knobs as decided 2026-11-05; settlers 4 move points, default ≈ 1,210–1,290 people for seven farm hexes.
- **Next steps (in order):**
  1. **Omer plays the Session 15 build** and rules on the open UI questions (below); fixes first.
  2. **Phase 2, session 2 — work-bands, roads and bridges**: `data/infrastructure.json`; set the work-band `enabled` (the Recruitment page, dialog and card already handle it; add **Build…** / **Road to…** to the card per UI-DESIGN §5); "road from X to Y" as one order; `isBridged` is the hook for built bridges; **forts/castles clusters to be designed first** (§5.14). Session 3 — levies (`takeMen` exists) with upkeep, tier upgrades as a command; session 4 if needed — groups, hierarchical pathfinding, tuning; **roads and food sharing** at the end of the phase (§5.15).
  3. **Government & Institutions design session** (DESIGN §4.3) — after Phase 2: opens with the sprawl curve (Session 14 entry) and the §4.3 hooks list.
  4. Housekeeping: DEVLOG-archive-2.md is at ~43 KB — **the next archive batch (Session 20) opens DEVLOG-archive-3.md.**
- **Open questions for Omer:** the **river-mouth reading** (Session 14: a river hex keeps its two banks where it meets the sea, a lake or the map edge, so a river cannot be crossed at its mouth; only a source or a fork is open); §5.14 forts/castles clusters (before session 2); the unit marker shape (a heater shield, as built — UI-DESIGN §7) and whether the unit card may close the settlement ledger; the raise dialog's muster list is long for a metropolis (22 rows) — a shorter default (members within 3 hexes only?) if he prefers; §5.2 draft terrain yield rows; village naming ("New <home>" is a placeholder for §4.10).

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
