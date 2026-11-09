# Realms, Kings and Other Stuff — Development Log

Every chat session appends an entry here at the end, **even if the work is unfinished or broken**. The next session reads the "Current state" block first, then the latest entries. Keep entries factual: what was done, how, what broke, where to continue.

---

## CURRENT STATE (overwrite this block every session; keep it under ~6 KB, present tense, no session history)

- **Where we are:** Omer's work order (ROADMAP v0.7, 2026-11-08): 1 castles — DONE (Session 18) · **2 military units, starting with the levy — DONE (Sessions 19–20)** · **3 time-scale / economy / demography overhaul — IN PROGRESS (Session 22: season turns and the births rule done; quarries / lumber camps, subordination, the negative treasury, sinks for money, then an outside threat and Imperium-style battle / siege resolution remain)** · 4 government, institutions and characters (+ the one-faction naming scheme) · 5 AI and diplomacy · 6 further mechanisms. Principle: get to a playable game first, tune the pace by playing. Phase 1 signed off 2026-11-07 (numbers untuned until the sinks exist).
- **Repository:** GitHub `omerglickman/realms` (private), branch `main`. **Read `CLAUDE.md` for the protocol, `ARCHITECTURE.md` for the module map, `UI-DESIGN.md` before touching `src/ui/`.** Tests: 202 passing. `npm run smoke` (headless Chrome over the built game: settlers, a road, an upgrade, send food, a castle, a levy paid / garrisoning / fortifying, the click model; the page exposes `window.__realms`); `npm run shots` screenshots every page.
- **How Omer plays:** `realms.html` from disk; it opens on `scenarios/start.json` ("vinral-start" rev 1: 60 settlements, ≈248k people, now **March year 1** — rebased one month in Session 22 so it sits on a season boundary); "Bare map" loads `maps/testmap.json`. Saves are state **v10** (older saves migrate; new `FactionYear.pay` is default-filled).
- **What the build does now:**
  - *Phase 1 (ARCHITECTURE.md has the modules):* hex map + editor; four settlement tiers with zones, clusters, cohort demography, migration, granary brake, pull factor; food, timber / stone / goods, private hands → tax and goods, Markets, 16 buildings; partial staffing; the Session 13 UI.
  - *Units (14–15):* **settlers** and **work-bands** (muster from the cluster and own settlements within 3 hexes; coins, timber, provisions); A* orders (mountains a month; a river hex is two banks, crossed by a bridge or a settlement); settle, disband, foraging, Send food; shield markers, unit card, Recruitment page, raise dialog. Tier upgrades at the gates 1,500 / 6,000 / 36,000 (15b–c; cluster leadership).
  - *Roads and bridges (16):* work-band build orders; movement costs terrain × 0.5 dirt / 0.25 paved with minimums. *Editor Infrastructure tab (17–17b):* roads, bridges, quarries and lumber camps — **quarries and lumber camps still have no economic effect; step 3 decides.**
  - *Castles (18, DESIGN §3.5):* seven ranks on the tier ladder (castles at TIERS indices 4–6); a castle is a `Settlement` with `castle: CastleState` and no people; staffed by hands lent from settlements in reach, wages 0.1 coin / hand / month + yearly upkeep, 12 unstaffed months → ruin; a siege reserve of 12 months; work-band construction, in-place upgrades; another faction's castle blocks pathfinding.
  - ***The levy (Session 19, §3.2b rule 9, §3.5):*** raised from a settlement (men 15–44 only, 300 default, no coins or materials), **paid 1 coin a man a month** (`FactionYear.pay`, "pay" column in the Treasury ledger) and fed like any party; **disband walks home from any distance** (never into a castle or ruin); **garrison:** military units on a castle's hex fill its `garrisonCapacity` and eat from its siege reserve (`garrison.ts`); **fortify** / `unfortify` (exact timber refund; instant — PLACEHOLDER; 30 timber; forts decay 12 months after the last unit leaves).
  - ***Sessions 20–21 (Omer's notes):*** a levy musters from any settlement with men in reach; a click chooses, a double-click opens, a **right** click orders the chosen unit (garrison on our settlement / castle), Esc unchooses, any order un-chooses; work-bands: **Road between…** (two clicks) and **Castle at…** (size + hex); Status row, forts as their own marker, capacity bars under castles / forts; Omer's sprites for the city, metropolis, three castles and the fort.
  - ***Session 22 — step 3 opens (Omer's decisions, DESIGN §2.4 / §4.1):*** **a turn is a season** — `advanceTurn` runs the monthly `endTurn` three times to the next season boundary (`data/time.json`; Spring Mar–May … Winter Dec–Feb; harvest = autumn; the yearly update runs in the winter turn); the sim, its rates and the tests are still monthly; the top bar says **End turn**, the date tile "Summer, year 4 · turn 14", unit glides cover the whole turn. **Births:** base 0.27 per woman (×1.5) × four factors — famine (food sufficiency³), the granary factor on every tier (0.25 at ≤ 1.5 spare months, 1 at 7, 1.15 at ≥ 12), jobs without hands (up to +30 % when ≥ 25 % unfilled), idle hands (villages only); the settlement ledger's People page shows all four.
- **Placeholders and limitations:** every castle number in `data/castles.json` and the two upgrade steps (draft); the parent-resolution refinement (a castle never takes a village from a covering town or city — kept by Omer until the step-3 subordination redesign); service-before-fields; upgrade cost as the difference (accepted); **births and deaths still happen once a year, in the winter turn (population changes in a lump every fourth turn — to be smoothed if it feels wrong)**; idle hands do not lower births in towns / cities (their spare hands are private hands); granary thresholds 1.5 / 7 and the labour numbers are drafts; **treasury allowed to go negative with no consequence** (wages, upkeep, soldiers' pay — open question for economy tuning); **instant fortify**; levy pay / size / speed are drafts; units camped outside a castle have no effect; forts hold no garrison yet; instant shipping and muster; roads move units only; quarries / lumber camps inert; roads belong to no faction; flat realm cap; administration quality = hall staffing.
- **Numbers to remember:** model scale ×3 (a village 900, a town 9,000, a city 24,000); gates 1,500 / 6,000 / 36,000; influence rings 1/3/5/6 (castles 2/3/5); a band of 300 lays a dirt-road hex in 2 months; castle build 12 / 24 / 48 months, 5,000 / 20,000 / 80,000 coins; levy 1 coin / man / month, move 5, fort 30 timber / 100 men.
- **Next steps (in order):**
  1. **Omer plays the Session 22 build** — End turn through a few years: does a season feel like the right step; does the realm / a new village grow at a good pace (a lone village of 900 reaches the 1,500 town gate in ~10 years = 40 turns; the start position as a whole barely grows because land and food are its ceiling); is the once-a-year population jump (winter turn) acceptable; the People page's four factors.
  2. **Step 3, continued:** what quarries and lumber camps yield; **what raises the food ceiling** (births alone cannot — settlers, mills, granaries, yields); what a negative treasury does and what money is spent on (the treasury reaches 400k+ in 40 years with nothing to buy); redesign subordination (Omer wants to); re-express durations and costs in turns (castle 12 / 24 / 48 months = 4 / 8 / 16 turns; a settler's move is now 3 months a turn). Then the threat and battle / siege resolution (Omer to describe the Imperium principles).
  3. Keep the "§4.3 hooks" list (Session 19 entry) in mind for step 4.
  4. Housekeeping: DEVLOG-archive-3.md is at ~34 KB; DEVLOG.md passes ~45 KB around Session 23–24 — then move all but the last three entries to the next archive.
- **Open questions for Omer:** the castle numbers (all draft); whether births should be smoothed to the season or month; the treasury going negative (what should happen?); whether pay should rise with a unit's quality later; DESIGN §5.17 (work speed, bridges from the bank, materials per hex); the Imperium battle / siege principles; the river-mouth reading; the unit marker shape; village naming ("New <home>" a placeholder).

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

Sessions 0–13e (planning, Phase 0, the headless Phase 1 model, the ×3 scale, the faction decisions, settlements on the map, the UI pass, the starting position and the realism knobs, the cluster/tithe decisions, clusters and the tithe, the granary brake, buildings and materials, the private economy, the reorganization, Omer's verdicts on the private economy, the UI overhaul and its follow-ups — icons, zoom levels, cubes, shorelines, rivers) live in **DEVLOG-archive.md** (Sessions 0–9c) and **DEVLOG-archive-2.md** (Sessions 10–13e), **DEVLOG-archive-3.md** (Sessions 13f–16b). Entries are moved there in batches when this file grows past ~45 KB, into volumes of under ~45 KB each; the Current state block above is always complete on its own. The per-module inventories that used to live in the Current state block ("What works (Session N)") were folded into the repo's **ARCHITECTURE.md** on 2026-11-05 (Session 12b); the session entries below keep the detail.

---

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

## 2026-11-08 — Session 17 — Editor: Infrastructure tab; quarries and lumber camps as map entities

**Omer:** the curve is better; add an Infrastructure tab to the editor with roads, bridges, quarries and lumber camps; the last two are map entities now even though their economic influence is undecided (an economic / demographic overhaul is coming).

**Done:** `data/infrastructure.json` `sites` (quarry, lumber camp); `state.infra.sites` (state **v9**, v8 migrates to `{}`); command `setInfra` (absolute per-hex values, own inverse); `infraBrushResult` — the placement rules (no settlement hex; roads need land, a river hex needs a bridge first; a bridge only on a river hex and brings a dirt road; a quarry / camp on any land hex, one per hex; Erase clears all); editor: fourth tab with a palette (D P B Q L X), a drag is one undo step, counts, refusal reasons; `infraLayer.ts` draws the two badges (lower left of the hex, zoom levels 0–2); two new icons; the hex status line names a site; the editor drawer widened to 312 px. `tests/infraeditor.test.ts` (3). UI-DESIGN 1.8, DESIGN-units §3.4 + DESIGN-history 0.7b, ARCHITECTURE updated.

**Decisions of note (Claude's):** a quarry / camp may stand on any land terrain, not only hills / forest (no economic rule exists to tie it to); the editor may downgrade a paved road to dirt; the exported *map* file does not carry infrastructure (scenario saves do).

**Tests & build:** pass (165/165; `tsc`, build, smoke OK, zero console errors); verified in headless Chrome at zoom 5: road drag, paved, quarry and lumber camp badges, the panel fits.

**Next session should:** take Omer's economic / demographic overhaul design, or session 2b castles if he prefers.

## 2026-11-08 — Session 17b — Quarry and lumber-camp placement rules

**Omer:** quarries on mineable resources (stone, silver, salt, anything else?) and on mountains (a mountain quarry should yield some stone even without a resource); lumber camps on any terrain except mountains; some terrain should yield some lumber even without a camp. **Done:** `mineable` flag on stone, iron, silver, salt in `data/resources.json` (**iron added by Claude** in answer to "anything else?"; furs, game, fish, wine are not); `infraBrushResult` enforces the rules with reasons; tooltips and the editor help updated; test extended. **Fix found on the way:** the editor refused roads on mountains because terrain.json marks them not `passable` (that flag means the plain move rule); it now refuses only sea and lake. The yield intentions (mountain stone, terrain lumber) are noted in DESIGN-units §3.4 for the overhaul — no economy change.

**Tests & build:** pass (165/165; `tsc`, build OK). **Next session should:** as Session 17.

## 2026-11-08 — Session 18 — Castles (Phase 2 session 2b) and the new work order

**Phase:** 2 — **Goal of session:** castles per DESIGN §3.5; Omer also replaced the roadmap order (ROADMAP 0.7).
**Done:**
- *Sim:* the seven-rank tier ladder (`data/settlements.json`), `data/castles.json`, `castles.ts` (service, staffing, build cost, ruins), `forts.ts`, `hexjobs.ts` (split from economy to keep imports acyclic); `Settlement.castle`; castle branch in `makeSettlement`; `canSettleAt(…, tier)` / `canCastleAt`; two-pass work assignment; `foodParentOf`; `castleMonth` in the economy loop; castle upgrades in `upgrades.ts`; castle construction in `workbands.ts` (items in `infrastructure.json`, coins from the treasury, ruin rebuild at half price, fort discount); pathfinding hook; state v10 (`forts`, migration), `FactionYear.upkeep`. 20 new tests (185 total). A 20-year headless run of the start position is unchanged without castles.
- *UI:* castle markers / ledger (`castleModal.ts`) / hover card, grey ruins, fort border + badge, castle glyphs (`.tier-ico.t4–t6`), people-by-tier lists skip castle tiers, castle rows in the cluster table, a castles column in the treasury ledger, three castle buttons on the work-band card, editor placement (population disabled), rank checks in the hover card and settlement ledger moved to the new ranks; smoke extended (castle placed via `window.__realms`).
- *Docs:* ROADMAP 0.7 (Omer's work order), DESIGN-units §3.5 "As built", DESIGN-history 0.7d, ARCHITECTURE, UI-DESIGN 1.9.
**Design decisions made by Omer this session (written into the DESIGN files):** forts and garrisons wait for military units (castles first; fort code may exist without any way to create one); a castle works its own hex + best neighbours; castles can be placed in the map editor; the new work order (castles → levy → overhaul incl. threat and Imperium-style battle / siege → government, institutions, characters, naming scheme → AI and diplomacy → further mechanisms); shorter year / higher growth to be discussed at step 3; he prefers to build components, play and tune the pace rather than design a pacing curve in advance.
**Claude's placeholders to confirm (all in DESIGN-units §3.5 "As built"):** parent-resolution refinement (a castle never overrides a covering town / city parent — without it a medium castle would cut villages off from their town); lent hands taken after buildings and before fields; castle upgrade costs the difference of the two kinds with a hands-based rate (150 / 450 hands); wages and upkeep may drive the treasury negative; fortify is instant; castle names are "<nearest settlement> Castle".
**Findings:** a village of ~900 people offers few spare hands once its buildings are staffed — a small castle (30 hands) is easy, a large one (200 + 270) needs several big settlements in its 5 rings; `rankOf` in `src/headless/start.ts` had used rank as the tier index (fixed: `s.tier`).
**§4.3 hooks (for step 4):** castle wages / upkeep as a policy lever; who garrisons and governs a castle; whether service hands should be a decree.
**Broken / unfinished:** no garrison, no fortify order, no way to create a fort (needs the levy); the map editor cannot edit a castle's staffing; castle numbers untested by play.
**Tests & build:** pass (185/185; `tsc`, build, smoke OK, zero console errors).
**Build delivered:** `realms.html` (Session 18).
**Next session should:** take Omer's verdict on castles, then step 2 — the levy and garrisons.

## 2026-11-09 — Session 19 — The levy, garrisons and forts (work-order step 2)

**Phase:** 2 — **Goal of session:** Omer: "castles seem ok. let's do levies?" — one feature cluster: the levy with pay, food, move, disband, garrison and fortify.

**Done:**
- `data/units.json`: levy enabled, `canFortify`, `disbandsHome`, 1 coin / man / month, men slice, move 5, size 300, 3 months of food, no raise cost.
- `units.ts`: monthly **pay** from the treasury (`FactionYear.pay`, `UnitReport.pay`); **garrison feeding** from the castle reserve (`UnitReport.garrison`); `disbandTarget` — a levy goes home from any distance; **no unit disbands into a castle or ruin** (fix of a Session 18 oversight: a unit standing on a castle hex could disband into it, adding people to a pop-0 castle).
- New `garrison.ts` (`garrisonOf`, `garrisonShare`, `isMilitary`) and `unitdefs.ts` (avoids an import cycle).
- `forts.ts` / `commands.ts`: `fortify` returns who paid; `fortify` ⇄ `unfortify` commands with an exact refund; `disbandUnit` checks the route home.
- UI: unit-card Fortify button; castle ledger Garrison row (links select the unit); Treasury ledger "pay" column and net; Recruitment's unavailable-reason text.
- Tests: `tests/levy.test.ts` (6: men only, pay, walk-home disband, never into a castle, fortify + exact undo, garrison eats from the reserve); castles fort test adjusted. Smoke extended.

**How it was done / decisions of note:**
- Garrison = military units on the castle hex in id order fill the capacity; the last unit is split. The inside part eats from the reserve first; any unmet need falls back to the party's bags / foraging. Bags are not topped up from the reserve (PLACEHOLDER).
- Pay is charged at the start of the unit step each month, counted in `pay`, not `spent`; the treasury may go negative (PLACEHOLDER, Omer: open question for economy tuning).
- No STATE_VERSION bump: `FactionYear` fields are default-filled on load.
- **§4.3 hooks** (for the government step): levy size and pay per settlement / institution; who may raise (a commander, not the player directly); loyalty of garrisons to a castle's holder; garrison strength as a governor's lever; pay arrears as unrest; the reserve as a policy (months held).

**Design decisions made by Omer this session (also written into DESIGN-units §3.5):**
- Castles: parent-resolution refinement kept until the step-3 subordination redesign; negative treasury an open question; upgrade cost reading accepted; forts and garrisons deferred until the levy — now built.

**Broken / unfinished:**
- Instant fortify; units camped outside a full castle do nothing; forts hold no garrison; no combat (step 3).

**Tests & build:** pass (191 tests; `tsc`, build, smoke OK, zero console errors; `sim --scenario start --years 20 --builder 1` unchanged: realm 247,673 → 243,091, the builder raises no levies).
**Commit(s):** `phase1: the levy, garrisons and forts (Session 19)`
**Build delivered:** `realms.html` (Session 19)

**Next session should:**
1. Take Omer's verdict on the levy numbers, then open step 3 with the year-length discussion.

## 2026-11-09 — Session 20 — Levy follow-ups (Omer's notes)

**Phase:** 2 — **Goal of session:** Omer's notes after trying the Session 19 build.

**Done:**
- *Hands:* the Recruitment cube checked only the home settlement's men against a 300-man default, so a small village was refused. It now asks the same draft the dialog builds (`newRaiseDraft` → `draftSpec` → `raiseCheck`), which fills from the raising settlement's spare hands, then the neighbours in reach, then up to each source's cap (`sourceCap`: a quarter of its people, never more than its men 15–44).
- *Fortify "does nothing":* a freshly raised levy stands on its home settlement, where fortifying is refused — the button was merely greyed with a tooltip; and where it worked, the unit's shield sat on top of the fort badge. Now the card prints the reason under the buttons, shows **Status: fortified**, and the fort is a faction-colour disc with a keep, low right on the hex.
- *Garrison display:* castle ledger tile "Garrison x of room" with a gauge, hover row, Garrison row (links select the unit); unit card **Status** row (`garrisonStatus`); gold capacity bars under castles and forts with a unit inside (red when full); `fortGarrison` in garrison.ts.
- *Selection model:* single click chooses (unit or settlement), double-click opens the card / ledger (a click still swaps an already-open ledger), × on the unit card keeps the unit chosen, a left click always chooses (a shield, a settlement, or nothing on empty ground); a right click with a unit chosen is the go-to / garrison order (message for own settlement / castle; route preview as the cursor moves), Esc unchooses. *(First built as left-click-orders; Omer corrected it the same day — Session 20b.)* After Raise the new unit's card opens (Claude's choice, for feedback).
- Smoke extended (single click / double-click / × / go-to / Esc); test hooks `unitScreen`, `hexScreen`, `ui` on `window.__realms`. 2 new tests (193).

**How it was done / decisions of note (Claude's, PLACEHOLDER where marked):**
- A "garrison order" is a plain move order: arrival on an own castle hex is garrisoning. A military unit standing in an own village / town / city is called *garrisoned in* it, with no capacity (PLACEHOLDER).
- Non-military units are ordered by the same click (settlers, work-bands); the old Move button still works and Settle at… / Road to… keep their targeting modes, which take priority.
- Left click always chooses, so a settlement can be chosen with a unit chosen; right click is the order (Session 20b).

**Design decisions made by Omer this session (written into DESIGN-units §3.5):** a levy musters from the cluster and neighbours, not only the home village; garrison status wording; click-to-order.

**Broken / unfinished:** instant fortify and the other Session 19 placeholders stand; a chosen unit's order cannot yet be queued (waypoints).

**Tests & build:** pass (193; `tsc`, build, smoke OK, zero console errors).
**Build delivered:** `realms.html` (Session 20)

**Next session should:**
1. Take Omer's verdict on the clicking and the levy numbers, then open step 3 with the year-length discussion.


## 2026-11-09 — Session 20b — Right click orders, left click chooses

**Omer:** the first Session 20 reading was wrong — after choosing, a **right** click should create the order; a left click on anything else re-chooses what it hits. **Done:** `app.ts` — the left-click-orders branch is gone (a left click on a shield / settlement chooses it, on empty ground unchooses); a right click without a drag, with a unit chosen and no targeting mode or editor active, calls `orderChosenTo`; right-drag still pans; help text, comments and the smoke test updated (left click on empty ground unchooses; right click on the castle orders). Docs: DESIGN-units §3.5, UI-DESIGN 1.11, DEVLOG, DESIGN-history 0.7f. No sim change.
**Not done / by design:** the Move / Settle at… / Road to… targeting modes stay left-click; right click during a targeting mode does nothing (Esc cancels); the route preview still follows the cursor when a unit is chosen, now showing what a right click would do.
**Tests & build:** pass (193; `tsc`, build, smoke OK, zero console errors). **Build delivered:** `realms.html` (Session 20b).

## 2026-11-09 — Session 21 — Un-choose after orders, Road between…, Castle at…, new icons

**Omer's four small changes:** (a) an order un-chooses the unit; (b) *Road to…* becomes *Road between…* (name both ends; the band walks to one and builds from there); (c) a work-band order *Castle at…* with a size choice; (d) his six-icon sprite sheet replaces the existing icons.
**Done:**
- `app.ts`: `act()` returns a boolean; `ordered(done)` un-chooses after a successful order (move, settle, disband, fortify, build, cancel, right-click orders). A targeting mode `build` has `between` / `first`: the first click names an end, the second orders; the preview shows the whole route with the walk to the nearer end. Castle preview = the walk, the months and the cost.
- `sim/workbands.ts`: `makeBuildOrder` treats a bridge or a castle as a one-site route at the chosen hex (the castle-only-where-you-stand rule is gone — the monthly build step already walked the band to each stand cell); new `makeRoadBetween` plans the road with `planRoadRoute`, orders it from the end the band reaches sooner, and refuses equal ends, water, no route, unreachable ends, or a road already there.
- `unitCard.ts`: *Road between…*, a castle-size select + *Castle at…* (tooltip with price), Fortify uses the new `fort` icon.
- Icons (`icons.ts`): the sprite sheet was cleaned, thresholded and traced (potrace) into filled paths in a 24×24 box — city, metropolis, castle1–3, fort; `iconSvg` swaps `currentColor` for the style colour. The wobble of the drawings is kept. Town and village icons unchanged. `settlementLayer.ts` uses `fort` for the fort marker.
- Tests `orders21.test.ts` (2): road between picks the nearer end, is order-independent and completes; a castle ordered at a distant hex is walked to and built, a settlement hex is refused with a reason. Smoke extended (buttons, two-click road, deselect).
**Decisions by Omer (in DESIGN-units, DESIGN-history 0.7g, UI-DESIGN 1.12):** the four changes above.
**Findings:** the unit card can overlap the second map click target (× closes it); a long road far outside the borders starves a band on three months' provisions (the test needed 12).
**Tests & build:** pass (195; `tsc`, build, smoke OK, zero console errors). Screenshot check of the metropolis on its faction disc and a small castle.
**Build delivered:** `realms.html` (Session 21).
**Next session should:** take Omer's verdict, then open step 3 with the year-length discussion.

## 2026-11-09 — Session 22 — Step 3 opens: season turns and the births rule

**Phase:** 2 / work-order step 3 — **Goal of session:** open step 3 with the year-length discussion; Omer decided and the session built it.

**Measured first (12 turns a year, 195 tests green):** a lone village of 900 reaches 1,236 after 20 years (+1.5 %/yr; the 1,500 town gate at about year 30 = 360 turns); the start position goes 247,673 → 249,158 in 40 years (+0.6 %) — land and granaries are full, cities grow and towns shrink through the pull; the treasury reaches 422,000 coins with nothing to buy and timber / stone sit at their caps; a 400-turn game was 33 years.

**Omer's decisions (DESIGN §2.4, §4.1 and DESIGN-history 0.7h):** one turn = one season (4 a year; 400 turns = 100 years); births between "moderate" (×1.33) and "strong" (×1.67), i.e. ×1.5, with two further things raising them (missing hands; a food surplus), two lowering them (idle hands; a thin surplus) and famine dropping them significantly until everyone is fed.

**Done:**
- *Season turns:* `data/time.json`; `calendar()` returns the season, `turnNumber()`; `turn.ts` `monthsInTurn` / `advanceTurn` (the monthly `endTurn` repeated to the next boundary; a save off a boundary takes one short turn). The sim, the data and the headless runners are untouched and still monthly. UI: **End turn** (Space), date tile "Summer, year 4 · turn 14", Run N years unchanged, the glide covers the whole turn (work-band trails gathered per month; movers sliced from the planned route to where they ended). `scenarios/start.json` rebased from February to **March** year 1 (`turn` 1 → 2, one text edit; revision unchanged).
- *Births:* `birthsPerWomanPerYear` 0.18 → 0.27; `famineBirthExponent` 3 (sufficiency³); `granaryBrake` generalised to every tier with a surplus side (`spareMax` 12, `maxFactor` 1.15; replaces the flat "plenty" ×1.15, which the game no longer passes); new `labourBirthFactor` (`labourBoost`: ≥ 25 % of jobs unfilled → +30 %), fed from `report.vacancies` in `demographyYear`; crowding unchanged (villages). The settlement ledger's People page now lists the four factors with their present values.
- *Tests:* 202 (was 195): `clock.test.ts` (4: seasons, short first turn, `advanceTurn` ≡ 24 months stepped, turn numbers), three famine / labour / idle tests in `demography.test.ts`, the granary-factor test rewritten for the surplus side; two growth bounds raised (scenario trend < 9 %, well-fed rate 1.5–4 %). Smoke: End turn moves Spring → Summer.

**Findings (headless, start position, 40 years, builder on):**
- With the Session 22 rules and the *old* granary thresholds (0 / 4 months) cities overshoot their land and starve in bad harvests: hunger deaths 10–25k over 40 years (was 2.8k). Moving the thresholds to **1.5 / 7** brings them to ~1.5–5.5k over three seeds; (8 / 2) gave ~1–3.8k but the realm shrank 1–3 %. **Claude's choice: 1.5 / 7 — Omer to judge by play.**
- **Births do not lift the realm**: +0.5 … +2.5 % over 40 years across seeds, because land and food are the ceiling; villages grow (64 → 73k), towns shrink through the pull. What makes a realm grow is more land under the plough (settlers, yields) — the next step-3 topic.
- A lone village of 900 now reaches 1,500 in about **10 years (40 turns)**; a village of 600, about 13; at 10 years it is 1,517 / 970–1,100. The labour boost drives this (a small village has many unfilled field jobs); with it off the figure is closer to 14–15 years.
- The 60-year settler-spammer run (`--settlers 1 --reach 12`) timed out and was not repeated; no sprawl numbers this session.

**Claude's readings / placeholders (marked in DESIGN-people-economy §4.1):** idle hands lower births in villages only (a town's spare hands are its private economy); a settlement's "jobs" for the labour factor = (hands − idle) + vacancies from the December labour plan; births and deaths still happen once a year (winter turn), so the population changes in a lump every fourth turn; the granary thresholds above; `startingDistribution` and death rates untouched.

**Not done:** nothing outstanding from the plan (the doc mirror to the Project was completed in a follow-up the same day).

**By design, not done:** durations, costs and movement are still per month underneath (a castle is 12 / 24 / 48 months = 4 / 8 / 16 turns; a levy is paid monthly and the ledgers show the year); nothing re-expressed in turns in the panels yet.

**Tests & build:** pass (202; `tsc`, build, smoke OK, zero console errors; screenshots checked: village People page, map).
**Commit(s):** `phase1: season turns and the births rule (Session 22)`
**Build delivered:** `realms.html` (Session 22)

**Next session should:**
1. Take Omer's verdict on the pace and the lump, then continue step 3 (Current state → Next steps 2).
