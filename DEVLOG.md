# Realms, Kings and Other Stuff — Development Log

Every chat session appends an entry here at the end, **even if the work is unfinished or broken**. The next session reads the "Current state" block first, then the latest entries. Keep entries factual: what was done, how, what broke, where to continue.

---

## CURRENT STATE (overwrite this block every session; keep it under ~6 KB, present tense, no session history)

- **Where we are:** Omer's work order (ROADMAP v0.7, 2026-11-08): 1 castles — DONE (Session 18) · **2 military units, starting with the levy — DONE (Sessions 19–20)** · **3 time-scale / economy / demography overhaul — NEXT** (then an outside threat and Imperium-style battle / siege resolution) · 4 government, institutions and characters (+ the one-faction naming scheme) · 5 AI and diplomacy · 6 further mechanisms. Principle: get to a playable game first, tune the pace by playing. Phase 1 signed off 2026-11-07 (numbers untuned until the sinks exist).
- **Repository:** GitHub `omerglickman/realms` (private), branch `main`. **Read `CLAUDE.md` for the protocol, `ARCHITECTURE.md` for the module map, `UI-DESIGN.md` before touching `src/ui/`.** Tests: 193 passing. `npm run smoke` (headless Chrome over the built game: settlers, a road, an upgrade, send food, a castle, a levy paid / garrisoning / fortifying, the click model; the page exposes `window.__realms`); `npm run shots` screenshots every page.
- **How Omer plays:** `realms.html` from disk; it opens on `scenarios/start.json` ("vinral-start" rev 1: 60 settlements, ≈248k people, February year 1); "Bare map" loads `maps/testmap.json`. Saves are state **v10** (older saves migrate; new `FactionYear.pay` is default-filled).
- **What the build does now:**
  - *Phase 1 (ARCHITECTURE.md has the modules):* hex map + editor; four settlement tiers with zones, clusters, cohort demography, migration, granary brake, pull factor; food, timber / stone / goods, private hands → tax and goods, Markets, 16 buildings; partial staffing; the Session 13 UI.
  - *Units (14–15):* **settlers** and **work-bands** (muster from the cluster and own settlements within 3 hexes; coins, timber, provisions); A* orders (mountains a month; a river hex is two banks, crossed by a bridge or a settlement); settle, disband, foraging, Send food; shield markers, unit card, Recruitment page, raise dialog. Tier upgrades at the gates 1,500 / 6,000 / 36,000 (15b–c; cluster leadership).
  - *Roads and bridges (16):* work-band build orders; movement costs terrain × 0.5 dirt / 0.25 paved with minimums. *Editor Infrastructure tab (17–17b):* roads, bridges, quarries and lumber camps — **quarries and lumber camps still have no economic effect; step 3 decides.**
  - *Castles (18, DESIGN §3.5):* seven ranks on the tier ladder (castles at TIERS indices 4–6); a castle is a `Settlement` with `castle: CastleState` and no people; staffed by hands lent from settlements in reach, wages 0.1 coin / hand / month + yearly upkeep, 12 unstaffed months → ruin; a siege reserve of 12 months; work-band construction, in-place upgrades; another faction's castle blocks pathfinding.
  - ***The levy (Session 19, §3.2b rule 9, §3.5):*** raised from a settlement (men 15–44 only, 300 default, no coins or materials), **paid 1 coin a man a month** (`FactionYear.pay`, "pay" column in the Treasury ledger) and fed like any party; **disband walks home from any distance** (never into a castle or a ruin); **garrison:** military units on a castle's hex fill its `garrisonCapacity` in id order (the last split inside / camped) and **eat from the castle's siege reserve** (`garrison.ts`); **fortify:** `fortify` / `unfortify` commands (exact timber refund), unit-card Fortify button, instant (PLACEHOLDER), 30 timber, forts decay 12 months after the last unit leaves. UI: Levy cube live, castle ledger Garrison row, Fortify button.
  - ***Session 20 (Omer's notes):*** a levy musters from any settlement with men in reach; a click chooses, a double-click opens (card / ledger), × on the unit card, a left click on any tile orders the chosen unit (garrison on our settlement / castle; Esc unchooses); Status row on military units; forts are their own marker; capacity bars under castles / forts with a unit inside.
- **Placeholders and limitations:** every castle number in `data/castles.json` and the two upgrade steps (draft); the parent-resolution refinement (a castle never takes a village from a covering town or city — kept by Omer until the step-3 subordination redesign); service-before-fields; upgrade cost as the difference (accepted); **treasury allowed to go negative with no consequence** (wages, upkeep, soldiers' pay — open question for economy tuning); **instant fortify**; levy pay / size / speed are drafts; units camped outside a castle have no effect; forts hold no garrison yet; instant shipping and muster; roads move units only; quarries / lumber camps inert; roads belong to no faction; flat realm cap; administration quality = hall staffing.
- **Numbers to remember:** model scale ×3 (a village 900, a town 9,000, a city 24,000); gates 1,500 / 6,000 / 36,000; influence rings 1/3/5/6 (castles 2/3/5); a band of 300 lays a dirt-road hex in 2 months; castle build 12 / 24 / 48 months, 5,000 / 20,000 / 80,000 coins; levy 1 coin / man / month, move 5, fort 30 timber / 100 men.
- **Next steps (in order):**
  1. **Omer plays the Session 20 build** — raise a levy, click it, click a castle, fortify; say whether pay / food / size and the new clicking feel right.
  2. **Step 3 — the overhaul:** open with the year-length discussion (shorter year, somewhat higher growth); decide what quarries and lumber camps yield; redesign subordination (Omer wants to); decide what a negative treasury does; tune by playing. Then the threat and battle / siege resolution (Omer to describe the Imperium principles).
  3. Keep the "§4.3 hooks" list (Session 19 entry) in mind for step 4.
  4. Housekeeping: DEVLOG-archive-3.md is at ~34 KB; DEVLOG.md passes ~45 KB around Session 21 — then move all but the last three entries to the next archive.
- **Open questions for Omer:** the castle numbers (all draft); the treasury going negative (what should happen?); whether pay should rise with a unit's quality later; DESIGN §5.17 (work speed, bridges from the bank, materials per hex); the Imperium battle / siege principles; the river-mouth reading; the unit marker shape; village naming ("New <home>" a placeholder).

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
- *Selection model:* single click chooses (unit or settlement), double-click opens the card / ledger (a click still swaps an already-open ledger), × on the unit card keeps the unit chosen, a left click on any tile orders the chosen unit (garrison message for own settlement / castle; route preview as the cursor moves), Esc unchooses. After Raise the new unit's card opens (Claude's choice, for feedback).
- Smoke extended (single click / double-click / × / go-to / Esc); test hooks `unitScreen`, `hexScreen`, `ui` on `window.__realms`. 2 new tests (193).

**How it was done / decisions of note (Claude's, PLACEHOLDER where marked):**
- A "garrison order" is a plain move order: arrival on an own castle hex is garrisoning. A military unit standing in an own village / town / city is called *garrisoned in* it, with no capacity (PLACEHOLDER).
- Non-military units are ordered by the same click (settlers, work-bands); the old Move button still works and Settle at… / Road to… keep their targeting modes, which take priority.
- With a unit chosen a single click on a settlement can no longer choose the settlement (it is the order); double-click opens its ledger, Esc unchooses first.

**Design decisions made by Omer this session (written into DESIGN-units §3.5):** a levy musters from the cluster and neighbours, not only the home village; garrison status wording; click-to-order.

**Broken / unfinished:** instant fortify and the other Session 19 placeholders stand; a chosen unit's order cannot yet be queued (waypoints); no right-click.

**Tests & build:** pass (193; `tsc`, build, smoke OK, zero console errors).
**Build delivered:** `realms.html` (Session 20)

**Next session should:**
1. Take Omer's verdict on the clicking and the levy numbers, then open step 3 with the year-length discussion.

