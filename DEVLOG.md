# Realms, Kings and Other Stuff — Development Log

Every chat session appends an entry here at the end, **even if the work is unfinished or broken**. The next session reads the "Current state" block first, then the latest entries. Keep entries factual: what was done, how, what broke, where to continue.

---

## CURRENT STATE (overwrite this block every session; keep it under ~6 KB, present tense, no session history)

- **Phase 2 — units, movement and building the land — IN PROGRESS.** Phase 1 signed off 2026-11-07 (numbers deliberately untuned until the Phase 2 sinks exist). **Done: Session 17 — the editor's Infrastructure tab with quarries and lumber camps as map entities (below); session 1 (units + movement: 1a the sim, Session 14; 1b the UI, Session 15; 15b tier upgrades; 15c sticky parents and cluster leadership), session 2 (work-bands, roads, bridges — Session 16).** **Next: session 2b — castles (DESIGN §3.5, decided 2026-11-08), then session 3 levies.** The Government & Institutions design session comes after Phase 2.
- **Repository:** GitHub `omerglickman/realms` (private), branch `main`. **Read `CLAUDE.md` there for the session protocol and commands, `ARCHITECTURE.md` for the module map, `UI-DESIGN.md` before touching `src/ui/`.** Tests: 165 passing. `npm run smoke` (headless Chrome over the built game: raising, forming, disbanding settlers; raising a work-band and ordering a road; send food); `npm run shots` screenshots every page.
- **How Omer plays:** `realms.html` from disk; it opens on his starting position (`scenarios/start.json`, "vinral-start" rev 1: 60 settlements, ≈248k people, February year 1); "Bare map" loads `maps/testmap.json`. A new map or position from Omer: `npm run mapdiff`, `inspect.ts`, `rebaseAsStart`, bump `meta.revision`, commit, rebuild, deliver. Saves are state v9 (older saves migrate).
- **What the build does now:**
  - *Phase 1 (ARCHITECTURE.md has the modules):* hex map + map editor; four tiers with zones, clusters, cohort demography with hunger, migration, the granary brake and the pull factor; farming / herding / fishing / hunting, granaries, the tithe; timber / stone / goods stockpiles, private hands → tax and goods, Markets, 16 buildings; partial staffing (§3.2b rule 1). The Session 13 UI: ledger strip, hover cards, ledgers, icons, zoom levels.
  - *Units (Sessions 14–15):* **settlers** and **work-bands** raisable (muster from the cluster and own settlements within 3 hexes; coins, timber, provisions); orders move (A*; mountains a month; a river hex is two banks, crossed by a bridge or a settlement) with then-settle / disband; **settle** on any land hex but mountains outside every work zone; foraging outside the borders; **Send food**; shield markers with the glide, the unit card, the Recruitment page and raise dialog.
  - *Editor Infrastructure tab (Session 17, Omer):* place dirt / paved roads, bridges, **quarries and lumber camps** (`state.infra.sites`, state v9; command `setInfra`, one undo step per drag; rules in `infraBrushResult`; badges in `infraLayer.ts`; icons `quarry` / `lumbercamp`). **Quarries and lumber camps have no economic effect yet — Omer: the economic / demographic overhaul (soon) decides it;** work-bands do not build them. Roads placed in the editor are in the scenario save (the exported *map* file still carries terrain and resources only, like settlements).
  - *Tier upgrades (15b–c):* Become a town / city / metropolis at the gates 1,500 / 6,000 / 36,000 (metropolis step a placeholder); the settlement stays under its old parent; cluster Leadership (Make leader / Split off).
  - *Roads and bridges (Session 16; DESIGN §3.2b rule 7, §3.4):* `data/infrastructure.json`; `state.infra` {roads by cell (1 dirt, 2 paved), bridges}; a **work-band** takes a **build order** (`unit.build`; exclusive with the move order): *Build here*, *Road to…* (A* over cells, rivers crossable at a planning penalty, a bridge inserted wherever a river hex needs one), *Bridge at…* (built from the bank beside the hex); it walks to each job, pays the materials when work on a hex begins (covering cluster, then realm; waits if short), works at people / 300 speed (dirt 2 months + 30 timber, paved 6 + 60 stone over a dirt road, bridge 6 + 60 timber + 30 stone, which carries a dirt road) and carries on to the next hex the same month; a cancelled project keeps its progress and the same order resumes it. **Movement:** a step between two road hexes costs terrain × 0.5 (dirt) / 0.25 (paved), never under the minimum — **minimums dirt 0.5, paved 0.25 and paved factor ¼ (Omer, 2026-11-08)**; the link is the lower level, a settlement's hex counts as dirt road; mountains cost 4 × the factor with a road, a whole month without. Map: `render/infraLayer.ts` (dirt ribbon, stone band, bridge deck; each segment a seeded S-curve, so roads meander — bridges almost straight); unit card Build here / Road to… / Bridge at… with a preview (hexes, months, materials, bridges). Headless: `npm run sim -- --scenario roads --from Hugeopolis --to Omerburg [--level paved]`.
- **Placeholders and limitations:** instant shipping and instant muster; roads move units only (food sharing by road, §5.15, the end of the phase); quarries / lumber camps exist on the map but do nothing economically and no band builds them; no watchtowers yet; roads belong to no faction, no upkeep or decay; `replaceMap` leaves `infra` alone; levies not raisable; city → metropolis upgrade a placeholder; an upgrade runs beside the build queue; a mustering party is cancellable only in the session it was raised in; the glide moves a whole group's shield; flat realm cap; administration quality = hall staffing.
- **Numbers to remember:** model scale ×3 (a village 900, a town 9,000, a city 24,000; farm hex 600 fed / 90 hands); gates 1,500 / 6,000 / 36,000; influence rings 1/3/5/6; settlers 4 move points, work-band 5; a band of 300 lays a dirt-road hex in 2 months; a dirt step on plains costs 0.5 point (settlers: 8 hexes a month), paved 0.25 (16 a month).
- **Next steps (in order):**
  0. **Next: Omer's economic / demographic overhaul design** (he said it is coming soon) — it decides what quarries and lumber camps do.
  1. **Omer plays the Session 17 build**; open under DESIGN §5.17: work speed, bridges from the bank, materials per hex; his look at the (now clearly curved) roads up close.
  1b. **Docs:** DESIGN.md is split (Session 16c) into DESIGN.md (core + index + open decisions + glossary), DESIGN-units / -settlements / -people-economy / -history; every Project doc is under ~35 KB. Keep it that way: a file nearing 35 KB gets split again.
  2. **Session 2b — castles and forts** per DESIGN-units.md §3.5 (read it whole; `data/castles.json`; castle kinds on a seven-rank ladder — append castle tiers to `TIERS` with explicit ranks so saved tier indexes stay valid; castle service as a labour-planner job; the siege reserve; garrison capacity; fortify order; ruin / fort decay; pathfinding hook). Quarries / lumber camps (×2 a hex's material output; needs `economy.ts` gathering to read a per-hex multiplier) and watchtowers can ride along or follow.
  3. Session 3 — levies (`takeMen` exists) with upkeep; session 4 if needed — groups, hierarchical pathfinding, tuning; **roads and food sharing** at the end of the phase (§5.15).
  4. **Government & Institutions design session** (DESIGN §4.3) — after Phase 2: opens with the sprawl curve and the §4.3 hooks list.
  5. Housekeeping: DEVLOG-archive-3.md is at ~34 KB (Sessions 13f–16b); the next batch goes there until it nears 45 KB.
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
