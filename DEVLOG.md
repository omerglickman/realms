# Realms, Kings and Other Stuff — Development Log

Every chat session appends an entry here at the end, **even if the work is unfinished or broken**. The next session reads the "Current state" block first, then the latest entries. Keep entries factual: what was done, how, what broke, where to continue.

---

## CURRENT STATE (overwrite this block every session; keep it under ~6 KB, present tense, no session history)

- **Where we are:** Omer's new work order (ROADMAP v0.7, 2026-11-08) is in force: **1 castles — DONE (Session 18)** · **2 military units, starting with the levy — NEXT** · 3 time-scale / economy / demography overhaul (then an outside threat and battle / siege resolution from Omer's Imperium project) · 4 government, institutions and characters (+ the one-faction naming scheme) · 5 AI and diplomacy · 6 further mechanisms. Principle: get to a playable game first, tune the pace by playing. Phase 1 signed off 2026-11-07 (numbers untuned until the sinks exist).
- **Repository:** GitHub `omerglickman/realms` (private), branch `main`. **Read `CLAUDE.md` for the protocol, `ARCHITECTURE.md` for the module map, `UI-DESIGN.md` before touching `src/ui/`.** Tests: 185 passing. `npm run smoke` (headless Chrome over the built game: raising / forming / disbanding settlers, a work-band's road, a tier upgrade, send food, and since Session 18 a castle placed by command with its ledger and the treasury column; the page exposes `window.__realms` {state, act, focus} for it); `npm run shots` screenshots every page.
- **How Omer plays:** `realms.html` from disk; it opens on `scenarios/start.json` ("vinral-start" rev 1: 60 settlements, ≈248k people, February year 1); "Bare map" loads `maps/testmap.json`. Saves are state **v10** (older saves migrate).
- **What the build does now:**
  - *Phase 1 (ARCHITECTURE.md has the modules):* hex map + editor; village / town / city / metropolis with zones, clusters, cohort demography with hunger, migration, granary brake, pull factor; farming / herding / fishing / hunting, granaries, tithe; timber / stone / goods, private hands → tax and goods, Markets, 16 buildings; partial staffing (§3.2b rule 1); the Session 13 UI.
  - *Units (14–15):* **settlers** and **work-bands** (muster from the cluster and own settlements within 3 hexes; coins, timber, provisions); A* orders (mountains a month; a river hex is two banks, crossed by a bridge or a settlement); settle, disband, foraging, Send food; shield markers, unit card, Recruitment page, raise dialog. Tier upgrades at the gates 1,500 / 6,000 / 36,000 (15b–c; cluster leadership).
  - *Roads and bridges (16):* work-band build orders (Build here, Road to…, Bridge at…); movement costs terrain × 0.5 dirt / 0.25 paved with minimums; roads meander on the map. *Editor Infrastructure tab (17–17b):* roads, bridges, quarries (stone / iron / silver / salt or mountains) and lumber camps (not mountains) — **quarries and lumber camps still have no economic effect; step 3 decides.**
  - ***Castles (Session 18, DESIGN §3.5):*** seven ranks on the tier ladder (village 0 · small castle 1 · town 2 · medium castle 3 · city 4 · large castle 5 · metropolis 6; `TIERS` array order index-stable, castles at 4–6); a castle is a `Settlement` with `castle: CastleState` and no people. **Staff:** hands lent by the settlements within its influence rings (after their buildings, before their fields, ≤ ⅓ of a settlement's hands); staffing scales its worked hexes and garrison room; the treasury pays wages (0.1 coin / hand / month) + yearly upkeep (200 / 600 / 2,000); 12 unstaffed months → ruin, rebuilt at half price. **Food:** a siege reserve of 12 months for the full garrison, filled from its own hexes then its subordinates' surplus; no tithe. **Building:** a work-band builds `castle_small / medium / large` where it stands (any land hex incl. mountains, not inside a higher non-castle work zone), coins from the treasury, materials from the covering cluster; a ruin hex is rebuilt in place; upgrades in place (small → medium → large) by spare hands in reach. **Map:** castles can be placed in the editor (Settle tool, no population); another faction's standing castle blocks pathfinding. **Forts:** `state.forts`, `fortify` (instant, placeholder), decay, 1-ring border, absorbed by a castle — **no unit type can fortify yet, so none exist on the map.** UI: castle markers / ledger / hover card, castle column in the treasury ledger, castle build buttons on the work-band card, castle rows in the cluster table.
- **Placeholders and limitations:** every castle number in `data/castles.json` and the two upgrade steps (draft; Omer to say after playing); **the parent-resolution refinement (a castle never takes a village from a covering town or city), service-before-fields, upgrade cost as the difference of the two kinds, treasury allowed to go negative with no consequence, instant fortify**; castles hold no garrison (needs military units); instant shipping and muster; roads move units only; quarries / lumber camps inert; roads belong to no faction; flat realm cap; administration quality = hall staffing; levies not raisable.
- **Numbers to remember:** model scale ×3 (a village 900, a town 9,000, a city 24,000); gates 1,500 / 6,000 / 36,000; influence rings 1/3/5/6 (castles 2/3/5); a band of 300 lays a dirt-road hex in 2 months; castle build 12 / 24 / 48 months, 5,000 / 20,000 / 80,000 coins.
- **Next steps (in order):**
  1. **Omer plays the Session 18 build** — place castles in the editor, build one with a work-band; look at the ledger and the treasury column; say whether the castle numbers feel right.
  2. **Step 2 — the levy** (ROADMAP 0.7): `takeMen` exists; a generic levy with upkeep in coins and food; garrison in castles and forts (capacity, fed from the reserve); the `canFortify` flag and the `fortify` order; castle UI shows who garrisons. Keep a "§4.3 hooks" list in the DEVLOG entry.
  3. **Step 3 — the overhaul:** open with the year length discussion (shorter year, somewhat higher growth); decide what quarries and lumber camps yield; tune by playing.
  4. Housekeeping: DEVLOG-archive-3.md is at ~34 KB; DEVLOG.md passes ~45 KB around Session 20 — then move all but the last three entries to the next archive.
- **Open questions for Omer:** the castle numbers (all draft); whether a castle should be able to take villages from a town (the refinement says no); the treasury going negative (what should happen?); DESIGN §5.17 (work speed, bridges from the bank, materials per hex); the Imperium battle / siege principles (Omer to describe or supply for step 3); the river-mouth reading; the unit marker shape; village naming ("New <home>" a placeholder).

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
