# Realms, Kings and Other Stuff — Development Log, archive

Older session entries moved out of DEVLOG.md to keep it readable (DEVLOG.md holds the Current state block and the most recent sessions; entries are moved here in batches when DEVLOG.md grows past ~45 KB). Same format, nothing edited.

---

## 2026-11-03 — Session 0 — Planning

**Phase:** pre-0 — **Goal of session:** lay down the plan, the technical framework, and the working documents.

**Done:**
- Omer gave the founding brief: medieval-ish hex grand strategy, civ-style settlements with influence zones, demographics-driven economy and recruitment, characters, warfare with levies vs professionals, diplomacy, AI, victory by conquest/subjugation/clientage.
- Claude wrote DESIGN.md (design contract, with DECIDED / PROPOSED / OPEN markings), ROADMAP.md (working agreement, session protocol, technical framework, phases 0–6), and this DEVLOG.md.

**Claude's main proposals:**
- Turn = 1 month; hex ≈ 15–20 km.
- Engine built for 400×250 but first test map ≈ 160×100, produced by a crude draft generator inside the editor and then hand-edited.
- "Institutions" + administrative capacity as the advancement system in place of research.
- Cohort demographic model (sex × 5 age bands per settlement/unit).
- Characters with lifecycle: aging, death, ruler succession, loyalty/ambition.
- Supply/attrition, sieges, raids; public order → revolts → rebel factions.
- Tech: TypeScript + Vite + PixiJS + HTML panels; sim/ui separation; single JSON GameState; command pattern; seeded RNG; headless balance runner; data-driven numbers.

**Broken / unfinished:** nothing built yet. **Tests & build:** n/a. **Commit(s):** none. **Build delivered:** none.

## 2026-11-03 — Session 0b — Decisions

**Phase:** pre-0 — **Goal of session:** collect Omer's answers to the open questions.

**Design decisions made by Omer this session (written into DESIGN.md v0.2):**
- Working title: **Realms, Kings and Other Stuff**.
- Turn = 1 month. Hex scale ~15–20 km is nominal only; movement rates are tuned for fun, not realism.
- Test map ~160×100; engine built for 400×250; draft generator in the editor.
- Advancement = institutions, with Omer's refinement: some are **simply enabled at a milestone** (Chancery, Guild Charters…), others are **policy decisions with trade-offs** that the player must actively choose (Provincial Division: better finance vs. less control; Professional Army: strength vs. money and cohesion). Claude restructured DESIGN §4.3 into three PROPOSED layers: government form → institutions (earned) → policies (chosen). A dedicated design session on this is scheduled before Phase 2.
- The player's ruler (the king) is a mortal character among characters, with life cycle, skills, traits and succession, from the start.
- Build delivery: a single HTML file Omer opens from disk (as with a previous project), stored in Dropbox; artifact page as backup.
- Code hosting: **GitHub** — Omer created `omerglickman/realms` and installed the Claude GitHub app; push access verified with a `.gitignore` commit.

**Tests & build:** n/a. **Commit(s):** `chore: add .gitignore (push access test)`. **Build delivered:** none.

## 2026-11-03 — Session 1 — Phase 0 skeleton

**Phase:** 0 — **Goal of session:** project skeleton, build pipeline, first `realms.html` showing a pannable/zoomable hex map.

**Done:**
- `package.json`, `tsconfig.json`, `vite.config.ts` (Vite 7, TypeScript 5.9, PixiJS 8.22, Vitest 5.1, `vite-plugin-singlefile`, `tsx`). `npm run build` type-checks, bundles everything into one file and renames it to `dist/realms.html`.
- `data/terrain.json` — the eleven DESIGN §2.3 terrains with draft colours, move cost, food, passability. Index-stable.
- `src/sim/hex.ts` — pointy-top, axial math, odd-r offset conversion, neighbours, distance, range/ring, pixel conversion, corner points.
- `src/sim/map.ts` — `MapData {width, height, terrain: number[]}`, bounds 400×250, get/set, neighbours, counts.
- `src/sim/rng.ts` — seeded sfc32 with plain-object state (lives in `GameState`).
- `src/sim/mapgen.ts` — crude draft generator: value-noise fBm elevation with edge falloff, sea level from a land fraction, moisture noise, latitude bands for tundra, lakes in low wet basins, rivers walked downhill from hills/mountains. Deterministic per seed.
- `src/sim/state.ts` / `turn.ts` — `GameState`, calendar (turn → month/year), serialize/deserialize with version check, `endTurn` (clock only for now).
- `src/headless/run.ts` — generates a map, runs N turns, prints terrain statistics.
- `src/ui/render/mapRenderer.ts` — chunked renderer (32×32 hexes per chunk, one Graphics for fills grouped by terrain + one for grid lines), lazy chunk build, viewport culling, grid auto-hide below zoom 0.5, `invalidateHex` hook for the editor.
- `src/ui/camera.ts` — pan/zoom with clamping, fit-to-screen, screen↔world.
- `src/ui/app.ts`, `index.html`, `style.css` — HUD with seed/size/generate, map info, hover readout (offset + axial coords, terrain, move cost, food), fps/zoom/chunks/build-time readout, keyboard shortcuts.
- Tests: 19 (hex math incl. round-trips and the 6/18/36 influence-zone counts; map store; terrain table order; RNG determinism; generator determinism and 400×250 timing; state save/load and calendar).

**How it was done / decisions of note:**
- Verified `dist/realms.html` over `file://` in headless Chromium with Playwright: loads with zero console errors at 160×100 and 400×250; hover and zoom work. Headless fps is meaningless (software rendering); chunk build cost measured instead: all 20 chunks of 160×100 build in ~50 ms, all 104 chunks of 400×250 in ~250 ms (one-time, lazy).
- Terrain stored as `number[]` rather than a typed array so the state stays plain JSON.
- Grid lines hidden automatically below zoom 0.5 (thinner than a pixel → moiré).
- Hover outline is redrawn after zoom/pan so its line width stays constant on screen.

**Design decisions made by Omer this session:** none new (see Session 0b).

**Broken / unfinished:**
- No map editor yet; no command layer yet; no resources; no save/load UI.
- Generator is deliberately crude (DESIGN §2.2); rivers are straight-ish downhill walks, tundra mostly on the south edge.

**Tests & build:** pass (19/19; build clean).

**Commit(s):** `phase0: project skeleton, hex map renderer, draft generator, tests`.

**Build delivered:** `realms.html` (Session 1).

**Next session should:**
1. Read Omer's feedback on the first build (fps at 400×250 full zoom-out; draft look).
2. Build the map editor with a command layer, brushes, fill, undo/redo, generator parameters, export/import JSON; commit `maps/testmap.json`.

## 2026-11-04 — Session 2 — Continents & islands generator

**Phase:** 0 — **Goal of session:** Omer reported 60 fps at all sizes and asked for several candidate maps with 1–3 continents plus big islands to choose from.

**Done:**
- `src/sim/mapgen.ts` rewritten: land-mass field (continents placed in horizontal slots with Gaussian sea channels between slots; islands with a height boost so they clear the sea level), domain warping of the mass field for non-elliptical coastlines, fractal noise, sea level from land fraction, ridged noise for mountain ranges (mountains > 0.78, hills > 0.66 — tuned so mountains ≈ 3–4 % and hills ≈ 8 % of the map at 45 % land), northern tundra band with noise, lakes, meandering rivers that stop when they join another river.
- HUD: continents (1–3), islands (0–20), land % slider, Random seed button, Enter in the seed box regenerates; all settings read from / written to the URL hash so a map can be shared or scripted (`realms.html#seed=karlin&w=160&h=100&continents=3&islands=5&land=45`).
- Coastline ruggedness (Omer asked for less blobby continents): a second, small-scale domain warp (±5 hexes) for bays and headlands, plus ridged "inlet" noise subtracted from the elevation near the coast to carve fjords, estuaries and peninsulas; ridge thresholds re-tuned (mountains > 0.72, hills > 0.62) to keep mountains ≈ 2–4 % and hills ≈ 8–10 %.
- Headless runner accepts `--continents --islands --land`.
- Contact sheet of 8 candidates rendered via Playwright (`file://` load, HUD hidden, fit-to-screen) and composed with PIL → delivered to Omer.

**How it was done / decisions of note:**
- Playwright gotcha: `page.goto` to the same file with only a different `#hash` does not reload the page — go to `about:blank` first.
- The generator is still deliberately crude (DESIGN §2.2). Omer will repaint whatever he picks.

**Design decisions made by Omer this session:** none new. Performance budget (ROADMAP B.3.9) confirmed met on his machine.

**Broken / unfinished:** as in Current state.

**Tests & build:** pass (19/19; build clean; headless browser load clean).

**Commit(s):** `phase0: continents/islands draft generator, HUD controls, URL-hash params`.

- **Canvas chosen (Omer, 2026-11-04):** seed `vinral`, 160×100, 2 continents, 6 islands, 45 % land. Frozen as `maps/testmap.json` via `npm run sim -- --out`; the build embeds and opens it by default, with a "Test map" button to return to it after generating drafts. `src/sim/mapfile.ts` added (format `realms-map` v1, stores terrain ids for re-mapping) with 4 tests (23 total). DESIGN §2.2 updated (DECIDED).

**Build delivered:** `realms.html` (Session 2, three iterations: generator controls → rugged coasts → frozen test map) + `map_candidates.png` (v1) and `map_candidates_v2.png` (rugged coasts, same eight seeds).

**Next session should:**
1. Build the map editor (command layer, brushes, fill, undo/redo, export/import JSON) working on `maps/testmap.json`.

## 2026-11-04 — Session 3 — Map editor

**Phase:** 0 — **Goal of session:** the map editor, working on `maps/testmap.json`.

**Done:**
- `src/sim/commands.ts` — command layer: `setTerrain` (list of cell edits) and `replaceMap`; `applyCommand` returns the inverse; helpers `brushCells` (hex range clipped to the map), `paintCommand`, `floodFillCommand` (connected same-terrain region, capped at 200k cells). 5 tests (28 total).
- `src/ui/editor/editor.ts` — `Editor` class owning the `#editor` panel: palette built from `TERRAIN` (keys 1–9, 0, S), tools Brush/Fill/Pick (B/F/I), brush radii 0/1/2/4 = sizes 1/2/3/5 (`[`/`]`), stroke = one undo step (original terrain per cell recorded on first touch; redo rebuilt from final values), undo/redo stacks (200), Export (Blob download named after the map), Import (file input → `loadMapFile` → `replaceMap` command, history reset), autosave to `localStorage` 0.8 s after the last change with a Restore/Discard notice on next load, `beforeunload` warning when dirty.
- `src/ui/app.ts` rewired: edit mode toggle (E / button), left button paints in edit mode, right/middle button pans, hover shows the brush footprint, `Home` fits (F is now Fill), chunk invalidation per edited cell, "New draft…" generator controls collapsed into a `<details>`.
- `index.html` / `style.css` — editor panel on the right.

**How it was done / decisions of note:**
- Verified in headless Chromium: paint stroke → hover shows Mountains; Ctrl+Z → Sea; Ctrl+Y; right-drag pans while editing; Export downloads a valid `realms-map` file (16,000 cells); Fill replaces a connected sea region; Import reloads the exported file; autosave status updates; zero console errors.
- Editing works on the embedded copy of `maps/testmap.json`. Round trip to the repo is manual: Omer exports, attaches the file to a chat, the session commits it. A later convenience could be a GitHub upload, but not needed now.

**Design decisions made by Omer this session:** none new.

**Broken / unfinished:** no map resize; no resources (next session).

**Tests & build:** pass (28/28; build clean; headless browser run clean).

**Commit(s):** `phase0: map editor — command layer, brush/fill/pick, undo/redo, export/import, autosave`.

**Build delivered:** `realms.html` (Session 3).

**Next session should:**
1. Read Omer's feedback on the editor.
2. Resources: `data/resources.json` with spawn weights per terrain (DESIGN §3.1 list), a resource layer in `MapData` (and the map file, version 2 with migration), spawning in the generator and a "Spawn resources" action in the editor, resource painting/erasing, small icon rendering, HUD readout.

## 2026-11-04 — Session 3b — First map edits committed

**Phase:** 0 — **Goal of session:** import Omer's first edited map.

**Done:**
- Omer exported `draft_vinral.json` from the editor and attached it. Validated with `loadMapFile` (160×100, all terrain indices legal). Diff vs the generated draft: 1,571 hexes changed (9.8 %), spread across the whole map — mostly new tundra (499) along the southern edge, plains (420), grassland (176), sea (206, widening the strait and trimming coasts), rivers, a lake, hills/mountains tidied.
- Committed as `maps/testmap.json` with `name: "vinral"`, `meta.revision: 1`. Build rebuilt; opens on it.

**How it was done / decisions of note:**
- Round-trip procedure (now standard, see Current state → Next steps 1): validate → diff → rename/bump revision → commit → build → deliver. A small diff script lived in scratch; worth adding to the repo as `npm run mapdiff` if this recurs often.

**Design decisions made by Omer this session:** none formal; note the map now has its cold band on the **south** edge (Omer's choice while editing) — the generator's northern-tundra rule is irrelevant from here on since the file is canonical.

**Tests & build:** pass (28/28; build clean; headless load clean).

**Commit(s):** `map: testmap revision 1 — Omer's first edit batch`.

**Build delivered:** `realms.html` (Session 3b).

**Next session should:**
1. Resources (see Session 3 "Next session should" 2).

## 2026-11-04 — Session 3c — Map revision 2

Second edit batch from Omer: 935 hexes changed (5.8 %) vs revision 1 — mostly sea → land (433 sea hexes painted over; coasts filled in, islands enlarged), plus plains/grassland reshuffling, more hills and forest, tundra extended. Committed as `maps/testmap.json` revision 2. Added `npm run mapdiff -- <file> [base]` (`src/headless/mapdiff.ts`) for this loop. Tests 28/28, build clean, delivered `realms.html`.

## 2026-11-04 — Session 4 — Resources

**Phase:** 0 — **Goal of session:** resources — data table, map layer, spawning, editor tools, rendering.

**Done:**
- `data/resources.json` — the ten DESIGN §3.1 resources (fertile soil, pasture, timber, stone, iron, fish, furs, salt, wine, silver) with colour, glyph, per-mille spawn chance per terrain, `minSpacing`, `coastalOnly` (fish on sea), draft `gives`. Index-stable like terrain.
- `src/sim/resources.ts` — `RESOURCES`, `computeResourceSpawn(map, rng, {density, replace})` (deterministic; one weighted roll per hex, spacing check against resources placed so far, coastal check), `countResources`.
- `MapData.resource: number[]` (-1 = none); `cloneMap`, `getResource`. Map file **v2** adds `resourceIds` + `resource`; v1 files load with an empty resource layer (so testmap rev 2 still loads).
- Commands: `setResource`, `resourceLayerCommand` (whole-layer replace as one undo step), `commandCells` helper; `replaceMap` now copies the resource layer.
- Generator spawns resources at the end (`resources: false` to skip). Headless `run` prints resource counts; `mapdiff` reports resource changes.
- Renderer: third Graphics per chunk with glyphs (circle, ring, triangle, square, diamond, hex, cross, star) in the resource colour with a dark outline; hidden below zoom 0.3; R toggles.
- Editor: resource palette (Erase + ten resources; selecting one switches to the `resource` tool, brush size 1), Spawn (seed + density 25–300 %), Fill empty, Clear all; counter; hover shows `Terrain · Resource`.
- Tests: 8 new (36 total) — data sanity (ids, known terrains, ≤100 % per terrain), determinism, terrain respect, coastal fish, silver spacing, replace=false, density 0, commands invert, v2 round trip + v1 migration.

**How it was done / decisions of note:**
- Spawn on the generated `vinral` draft at density 100 %: ≈1,000 resources on ≈7,200 land hexes (≈14 %). On testmap rev 2 the editor spawn gave 1,092. Omer tunes `data/resources.json` and/or the density slider.
- The test map is deliberately **not** auto-populated: Omer spawns and hand-places in the editor, exports, and that becomes rev 3 (first v2 file).
- Headless check: spawn → 1,092; paint iron → hover shows it; Ctrl+Z reverts; export is version 2 with 10 resourceIds; Clear → 0; zero console errors.

**Design decisions made by Omer this session:** none new.

**Broken / unfinished:** `gives` values unused until Phase 1; glyph art is placeholder.

**Tests & build:** pass (36/36; build clean; headless browser run clean).

**Commit(s):** `phase0: resources — data table, map layer v2, spawning, editor tools, glyph rendering`.

**Build delivered:** `realms.html` (Session 4).

**Next session should:**
1. Commit Omer's resource-bearing map as rev 3 if sent.
2. Phase 0 acceptance review; then Phase 1.

## 2026-11-04 — Session 4b — Yields vs resources

**Design decision (Omer):** soil fertility, pasture and timber are determined by terrain type, not spawned as resources; add **Game** (forest high, woodland medium, hills low). Done: `data/terrain.json` gained `fertility`/`pasture`/`timber` (0–4; `food` field removed), rows beyond Omer's spec marked draft in DESIGN §3.1; `data/resources.json` now `game, stone, iron, fish, furs, salt, wine, silver` (the three retired entries were removed outright — allowed because no committed map carries resources yet; the table is index-stable from the first v2 map onward). Hover shows yields. Tests 37/37; headless spawn on the generated draft ≈ 590, on testmap rev 2 ≈ 620 resources. DESIGN §3.1 rewritten with the yield table and the spawn-chance table; OPEN question added: furs vs game overlap.

## 2026-11-04 — Session 4c — Map revision 3 (first with resources)

Omer's third export: 37 terrain hexes changed and **881 resources placed** (seeded spawn plus hand edits, including fish placed offshore on purpose). Committed as `maps/testmap.json` revision 3 — the first v2 file; from here `data/resources.json` must stay index-stable. **Decisions (Omer, written into DESIGN §3.1):** offshore fish are legitimate and will be workable only by towns/cities with an improved port (later building); horses are not a resource — mounted units need access to a pasture-bearing hex by direct control or road connection. Build rebuilt and delivered. Tests 37/37.

## 2026-11-04 — Session 4d — Phase 0 sign-off

Omer: 6 factions on the test map; game = food resource, furs = trade good, both kept (furs more common than game in tundra — already true: game does not spawn on tundra). **Phase 0 signed off.** DESIGN §3.1/§4.8/§5 and ROADMAP (v0.3) updated. Next: Phase 1 in a fresh chat, starting with the numbers and a headless scenario.

## 2026-11-04 — Session 5 — Phase 1 design decisions and the food/people model (headless)

**Phase:** 1 — **Goal of session:** propose the demographic and food constants to Omer, record his decisions, build `demography.ts` + `economy.ts` + settlements with a 20-year headless scenario. No map UI.

**Done:**
- Design conversation (see DESIGN.md v0.3): work zone vs influence zone separated; tiers 1/1, 2/3, 2/4 and a new **metropolis** tier 2/5; contested hexes → higher tier wins; subordination to a parent by influence; water hexes workable (shore = sea touching land; 75 food/10 hands, 150/30 with Fish; river keeps farming too); buildings need hands — every settlement has a hall and a granary (10/50/100/200 and 30/60/120/240 hands), staffing linear, idle hands = the rest; migration of 10 % of idle hands per month with dependants to the parent when the granary is under 3 months; settlers stay a player action.
- `data/demography.json`, `data/economy.json`, `data/settlements.json`, `data/buildings.json` with all constants (draft, Omer-approved as starting values).
- `src/sim/demography.ts`, `src/sim/settlements.ts`, `src/sim/economy.ts`; `state.ts` v2; `turn.ts` runs them; `commands.ts` found/remove/restore settlement.
- `src/headless/phase1.ts` (`npm run sim -- --scenario phase1`): six cases × 20 years, yearly tables, optional CSV.
- Tests: 20 new (57 total) — demography rates, hunger weighting, slices; hex jobs incl. shore/river/fish/game; labour plan staffing order and hands-limited village; harvest timing; granary terms; contested hexes; parent resolution with override and faction; four 20-year scenario tests; people conservation under migration; determinism + save/load + v1 migration; command inversion.

**How it was done / decisions of note:**
- Yields in data are *people fed per year*; food units are people-months, so production = fedPerYear × 12 (the first run forgot the ×12 and everyone starved — caught by the scenario).
- The 3-month reserve alone starved villages: they sent everything above 3 months in October and had nothing by June. Rule implemented as "keep what you eat until the next harvest + 3 months" — the DESIGN text was updated to say so (Omer's intent was the 3-month margin; the until-harvest part is the implementation reading, marked as such).
- Settlements are founded with 12 months of food (was 6) so a January start reaches the first harvest; founding stock will become a settlers rule in Phase 2.
- Job priority is "best food per hand first": herding (5 hands) and shore fishing (10) are worked before farms (30). A village of 300 has 134 field hands against 245 needed for 7 hexes — Omer's "a village can't work its full capacity without spare hands" holds; the land ceiling binds only from ~500 people.
- Cohort counts are real numbers, not integers (smooth small-settlement behaviour; UI rounds).
- PLACEHOLDERS: "Moot Hall" / "Great Hall" names; metropolis prerequisites (data only); `parentOverride` has no UI yet.

**Design decisions made by Omer this session (written into DESIGN.md v0.3):** all of the above design bullets; starting numbers for both models approved for tuning.

**Findings for Omer (from the curves):**
- A city of 8,000 with 10 villages settles at ≈5,200: the orbit feeds ≈6,000 and village exports fall from 32k to 19k food/yr as the villages grow — the "villages eat their own surplus" pressure is real. A city of 8,000 needs roads, as intended.
- Growth is birth-limited (+1.1 to +1.6 %/yr): 20 years changes a town by ~1,000 people. If Omer wants more visible change in a 20-year window, raise births or add a food-driven growth term.
- Coast vs inland: identical growth when both are fed — water only matters when hands are scarce (small or levied villages) or land is poor. The "coast grows faster" intuition from the chat was wrong under this model.
- Migration trigger (stock < 3 months) fires in late summer in healthy villages (~100 people/yr in scenario C) because the reserve is at its yearly low right before harvest. Candidate fix: trigger on "stock < what is needed until the next harvest".

**Broken / unfinished:** nothing broken; no UI for any of it.

**Tests & build:** pass (57/57; `tsc` clean; build clean; headless browser load clean, zero console errors).

**Commit(s):** `phase1: demography + food economy + settlements model, data files, headless 20-year scenario, tests` — commit `599b800`.

**Build delivered:** `realms.html` (Session 5; UI unchanged) + the scenario tables and chart in chat.

**Next session should:**
1. Take Omer's tuning verdict on the curves; adjust `data/*.json`; rerun `--scenario phase1`.
2. Phase 1 session 2: factions data + settlements on the test map in the editor, zones drawn, settlement panel.

## 2026-11-04 — Session 5b — Migration trigger, ring/crowding A/B test

**Omer's decisions:** 20-year growth pace is fine for now; migration trigger changed to "forecast running out before the next harvest" (implemented: `forecastBeforeHarvest` = stock + monthly income − consumption until the harvest month; `data/demography.json` `triggerSafetyMonths` replaces `triggerReserveMonths`; DESIGN §4.1 updated); the until-harvest reserve rule accepted.

**A/B test requested by Omer:** city influence 5 rings (metropolis at 12,000 with 6 rings) vs today's 4. Scenario runner gained `--cityRings --metroRings --metroPop --crowding` overrides (scenario-only; `data/settlements.json` unchanged pending his decision) and two cases: G = city 8,000 + 24 villages on rings 3–5, H = city 12,000 + the same villages. Results (city population at year 20, case G): 4 rings 4,946 (falling); 5 rings 5,682 (falling); 4 rings + crowding 6,198 (stable); 5 rings + crowding 8,315 (stable, slowly rising). A 12,000 city falls to the same equilibrium as an 8,000 one in every rule set → the orbit's land, not the starting size, decides.

**Crowding birth penalty (PROPOSED, off by default = 0):** births × (1 − penalty × idle share of hands), villages only (`crowdingAppliesTo`), because a city's idle hands are its workshop/recruit pool, not crowding (a first version that also hit cities made full granaries coexist with shrinking cities). With penalty 1.0 villages settle where births = deaths at ≈28 % idle hands — land fully worked plus a standing pool of spare hands — and their exports hold instead of vanishing; 60-year runs: without it every orbit degenerates to famine (town + 6 villages 4,146 → 3,438 with hunger; city orbit → 3,816), with it the town reaches 6,190 (its tier cap) and the city orbit holds 8,000 → 9,300.

**Tests & build:** 57/57; tsc clean. **Commit:** `phase1: forecast migration trigger, crowding birth penalty (off), ring/crowding A/B scenario`. **Awaiting Omer:** adopt 5 rings / metropolis 12k @ 6 rings? adopt crowding 1.0 for villages?

## 2026-11-04 — Session 5c — Decisions adopted; first run on the real map

**Omer's decisions (DESIGN v0.3a):** city influence **5 rings**, metropolis from **12,000 with 6 rings**; **crowding birth penalty 1.0 for villages**. `data/settlements.json`, `data/demography.json`, DESIGN §3.3/§4.1/§5/glossary updated. Commit `fb274ec`.

**Real-map scenario** `npm run sim -- --scenario testmap [--sites 5] [--years 20] [--csv …]` (`src/headless/testmap.ts`): scores every settle-able hex of `maps/testmap.json` by the food its 19-hex work zone yields (all jobs incl. resources), picks the best / top-10 % / median / bottom-20 % / best-coastal sites, founds a city of 8,000 on each, and places villages (600/400/250 by their 7-hex capacity, ≥3 apart) on rings 3–5; 20 years headless, each site in its own state. Results (city at year 20; 60-year ceiling for the top two):

| Site | City fields | Villages | City yr 20 | Hunger | Ceiling |
|---|---|---|---|---|---|
| A best (45,64) plains + river, fish | 4,615/yr | 10 | 11,055, never hungry | 0 | ≈10,650 |
| B top-10 % (147,73) grassland | 3,960 | 11 | 11,055 | 0 | ≈10,400 |
| C median (110,60) hills + grassland | 3,065 | 9 | 6,020 | ~80/yr | — |
| D bottom-20 % (19,88) woodland/forest/lakes | 2,005 | 10 | 6,075 | ~80/yr | — |
| E coastal (148,32) grassland + sea, fish | 3,750 | 7 | 7,022 | ~80/yr | — |

Villages never starve on any site; migration is negligible. The spread between best and median land is the whole game: a river/plains site holds ~10,500 without roads, a hills site ~6,000. Both ceilings sit under the 12,000 metropolis line, so the metropolis still needs roads. Note the village placement rule (centres ≥3 apart) yields 7–11 villages per orbit on real terrain vs 24 on the ideal canvas — a realistic density. Picture `testmap_sites.png` delivered.

**Tests & build:** 57/57; tsc clean. **Commit:** `phase1: real-map scenario (testmap) + DEVLOG 5c`.
- **DESIGN §5.8 raised and resolved:** with crowding, villages plateau ~700 and cannot reach the 1,500 town gate by growth. Omer's answer: **scale the whole model ×3** (yields, hands, building hands, populations) and keep the gates at 1,500 / 6,000 — a village then plateaus ~2,100 and a town reaches 6,000 in 25–40 years; the metropolis gate scales to 36,000. To be implemented first thing in the next chat.

## 2026-11-04 — Session 6 — Model scale ×3

**Phase:** 1 — **Goal of session:** implement DESIGN §5.8 (scale the model ×3, keep the town/city gates) and prove the curves are unchanged; then discuss the six factions.

**Done:**
- `data/economy.json`: every `fedPerYear*` and `hands` ×3 (farm 0/150/300/450/600 per 90 hands; herd 0/45/90/135/180 per 15; fishing 225/30, 450/90 with Fish; game 180/30); new field `modelScale: 3` with a comment explaining the convention.
- `data/buildings.json`: hall 30/150/300/600, granary 90/180/360/720.
- `data/settlements.json`: `popMin` is now explicitly the **gate** for upgrading *to* the tier — village 600 (settler minimum), town **1,500**, city **6,000** (both deliberately unscaled), metropolis **36,000**; `popMax` = next gate (informational); new `typicalPop` per tier for the UI; `metropolisUpgrade.popAtLeast` 36,000.
- `src/headless/phase1.ts` and `testmap.ts`: all scenario populations ×3 (village 900, town 9,000, city 24,000, orbit villages 1,800; real-map village sizes 1,800/1,200/750 by capacity 2,100/1,350/900). `tests/economy.test.ts` expectations ×3.
- **`tests/scale.test.ts`** (3 tests, 60 total): (1) data declares `modelScale 3` with the ×3 numbers; (2) divides the model back to ×1 in place, runs five 20-year cases (lone village, lone town, city + 10 villages, starving city, town + overfull villages so hunger, migration and sharing are all exercised), restores ×3, runs again, and asserts every yearly people-count is exactly 3× (tolerance 1e-6 relative) and every ratio (granary months, idle share) identical; (3) gates 1,500 / 6,000 / 36,000.
- Independent check: the `--scenario phase1` CSV from the untouched Session-5c code (260 rows) vs the new one — zero deviation beyond CSV rounding. Real-map scenario: best site 33,164 at year 20 (= 3 × 11,055), median 18,059 (= 3 × 6,020).

**How it was done / decisions of note:**
- Nothing in `src/sim` changed — the model was already linear (all rules are ratios: idle share, shortfall fraction, months of stock, proportional migration slices), so the scale is purely a data convention. The `modelScale` field is a label for humans and tests; the sim never reads it.
- Tier gates are not yet enforced anywhere in the sim (upgrading is a Phase 2 player action); `popMin` just records them.

**Design decisions made by Omer this session (DESIGN v0.3b):** §5.8 marked implemented; the ×3 convention written at the top of DESIGN.md.

**Broken / unfinished:** nothing broken; UI unchanged since Session 4c.

**Tests & build:** pass (60/60; `tsc` clean; build clean; headless Chromium load of `dist/realms.html` with zero console errors).

**Commit(s):** `phase1: model scale ×3 — …; scale-invariance test` (3501a83) + docs commit.

**Build delivered:** `realms.html` (Session 6; UI unchanged).

**Next session should:**
1. Record Omer's faction decisions (names, personas, start regions, hand-designed vs generated) in DESIGN §4.8 and `data/factions.json`.
2. Faction entity in `GameState`; editor tool to place settlements and assign factions; zones drawn; settlement hover/panel.

## 2026-11-05 — Session 6b — Faction decisions

**Omer's decisions (DESIGN v0.3c §4.8):** factions hand-designed; several culture groups, defined later; start positions placed by Omer in the editor (tier + population), with the option to run the engine forward a few years and save the result as the starting state; sizes shaped by Omer; AI personas deferred to Phase 5; player faction fixed. **Change of plan:** build Phases 1–3 with the player's faction alone; add the other five once the mechanics work. Settlements keep a faction id throughout so the addition is data-only. No code this entry; docs mirrored.

## 2026-11-05 — Session 7 — Settlements on the map

**Phase:** 1 — **Goal of session:** settlements placeable in the editor (player faction only), zones drawn, hover + panel, end turn / run years, scenario export/import.

**Done:**
- `data/factions.json` + `src/sim/factions.ts`: the player faction (placeholder name "The Realm", colour `#c8323c`), `culture` reserved; `GameState` v3 adds `factions` and `playerFaction`; v1/v2 saves migrate.
- `settlements.ts`: `popHistory` (year-end totals, capped at 30 — pushed by `demographyYear`), `foundedTurn`, `growthTrend` (last two Decembers), `childrenOf`, `canSettleAt` (passable land, not occupied); settlements founded without a faction belong to the player. `commands.ts`: `renameSettlement`.
- `src/sim/scenario.ts`: scenario file = envelope around the serialized state with meta (settlements, people, date); `detectFile` tells map and scenario files apart.
- `src/ui/render/settlementLayer.ts`: zone fill + outer border per faction (edge detection against the union of influence cells), worked-hex highlight of the hovered/selected settlement, markers by tier (circle / circle / diamond / star) never smaller than ~5 px, labels at constant screen size (cities always labelled; others from zoom 0.45). Z toggles zones.
- `src/ui/panels/settlementPanel.ts`: hover line and detail panel as Omer specified (name, population, growth trend %, available food, parent) plus hands, land, granary, buildings, dependants, last month, founding.
- Editor: Settle tool (T; tier / people / name; defaults 900 / 9,000 / 24,000 / 36,000); hover shows the tier's influence reach; placing selects; clicking an existing settlement selects it; rename and remove from the panel in edit mode; "Save scenario" button; Import takes map or scenario files; autosave is now the whole scenario and the editor opens itself when there is an autosave to restore.
- HUD: date, End turn (Space), Run N years (10 default, ≤200; 5 years ≈ 15 ms on the test map with 4 settlements), click a settlement outside edit mode to open its panel, Esc closes, "Test map" asks before discarding settlements.
- Tests: 8 new (68 total) — factions in state, default faction, v2 migration, popHistory/trend/cap, foundedTurn, canSettleAt, rename inverse + childrenOf, scenario round-trip and file detection.

**How it was done / decisions of note:**
- Scenario vs map: the map file stays the hand-edited canvas (committed to the repo); the scenario is the state. `maps/testmap.json` is unchanged this session.
- Growth trend needs two year-ends; until then the panel says so rather than showing a misleading number. "Since founding" uses the first year-end as the base.
- Placement rule implemented as PLACEHOLDER (DESIGN §3.3 says nothing about where a centre may stand): any passable land hex. Water and mountains refused.
- Headless check in Chromium: placed a town and three villages, End turn, Run 5 years, hover line, undo/redo of placements, Save scenario → reload → autosave notice → Import scenario → same date and settlements. Zero console errors. Screenshots `session7.png`, `session7_zoom.png`.

**Design decisions made by Omer this session (DESIGN v0.3c):** see Session 6b (factions; player faction alone; editor placement + pre-run; hover contents).

**Broken / unfinished:** see Current state → limitations. Village hall name still the placeholder "Moot Hall".

**Tests & build:** pass (68/68; `tsc` clean; build clean; headless browser run clean).

**Commit(s):** `phase1: settlements on the map — …` (07b045b) + docs commit.

**Build delivered:** `realms.html` (Session 7).

**Next session should:**
1. Read Omer's feedback; commit his scenario file if he sends one and make the build open on it.
2. Yearly report / faction panel; buildings with effects; edit population/tier of a placed settlement.

## 2026-11-05 — Session 8 — UI pass

**Phase:** 1 — **Goal of session:** Omer's six UI requests after trying the Session 7 build.

**Done (all six):**
1. **Top bar** replaces the HUD box: one line across the top — title, date, End turn, Run N years, Edit map, Test map, New draft (drops down), hex readout, and a ▾/▸ toggle that collapses the second line (map info, perf, help). The collapsed state is remembered. Panels sit below the bar whatever its height (`--bar-h`).
2. **Editor tabs** — Terrain (brush / fill / pick, sizes, palette), Resources (palette, spawn), Settlements (Place / Pick). Switching tabs drops the previous tool; keyboard shortcuts are per tab (Tab cycles tabs).
3. **Pick mode** on the Settlements tab opens an existing settlement for editing without placing anything; the panel gets a *Set people* field (new `editSettlement` command: every cohort scaled, granary months kept, exact inverse) next to the rename box and Remove.
4. **Hover card** (`#popover`): name, tier, people, growth %/yr, food months (+ amount), subordinate to, hunger warning; appears to the right of the marker (flips left at the screen edge, clamped vertically), follows pans/zooms, stays while the cursor is on the card, closes when the cursor leaves both the settlement and the card (also when it jumps onto another panel). Clicking the card opens the full panel. The old hover line in the HUD is gone.
5. **Hover highlight**: worked hexes (as before) plus a **dotted line in the faction colour around the influence edge** for tiers whose influence exceeds their work zone (towns, cities, metropolis).
6. **Settle mode** (Place): every worked hex on the map is **hatched** so free hexes are obvious; the **dotted influence edges of all towns and cities** are drawn so the player can see which parent a new village would get; the white preview now outlines the new settlement's *work* zone rather than its influence reach.

**How it was done:** `settlementLayer.ts` gained an `outerEdges(set)` helper (edge detection against a hex set), a manual dash renderer (PixiJS has no dashed strokes) and a horizontal hatch per hex; `editor.ts` rewritten around tabs; `app.ts` owns the popover and the bar. Tests: 1 new (69). Headless Chromium: tabs, pick, set people 9,745 → 12,000 with the granary months unchanged, popover open/close incl. leaving for a panel, placement in settle mode, zero console errors; screenshots `s8_hover_town.png`, `s8_settle_mode.png`.

**Design decisions made by Omer this session:** UI only (recorded above); no DESIGN change.

**Broken / unfinished:** where the influence edge coincides with the faction border the dotted line sits on the solid one and is hard to tell apart (same colour by request). Tier of a placed settlement still not editable.

**Tests & build:** pass (69/69; `tsc` clean; build clean; headless browser run clean).

**Commit(s):** `phase1: UI pass — …` + docs commit.

**Build delivered:** `realms.html` (Session 8).

**Next session should:**
1. Omer's feedback on the UI pass; commit his scenario file when it arrives and make the build open on it.
2. Yearly report / faction panel; buildings with effects; tuning; Phase 1 acceptance.

## 2026-11-05 — Session 9 — Starting position + demographic realism pass

**Phase:** 1 — **Goal of session:** adopt Omer's first starting position; implement the two ideas from the morning's discussion (migration trickle; randomness in births, deaths and harvests) behind data knobs and measure them on that position.

**Done:**
- `scenarios/start.json`: Omer's export (60 settlements: Hugeopolis metropolis 31,721; Omerburg 25,583 and Hillside 15,065 cities; 7 towns 7,600–16,000; 50 villages, 11 of them independent; 247,673 people), calendar rebased from year 521 to **February, year 1** (`rebaseAsStart`), founding dates zeroed, populations and granaries untouched. The build opens on it; "Start position" reloads it; "Bare map" gives the empty test map. `src/headless/inspect.ts` lists a scenario.
- `src/sim/rng.ts`: `nextGaussian`, `nextPoisson`. `src/sim/noise.ts`: all knobs read live from the data files, `setNoise` / `NO_NOISE` for tests and the runner.
- **Vital sampling** (`demography.ts` `yearlyUpdate` with `{rng}`): births and each band's deaths are Poisson draws around the expected value when `noise.vitalSampling` is 1.
- **Harvest variance** (`economy.ts` `rollHarvestFactors`, January): factor = 1 + sd × (√share × regional + √(1−share) × local), regional = one gaussian per 12×12 block per year (seeded from one RNG draw + block key), floored at `minFactor`; `monthlyProduction` multiplies the farming part; forecasts use 1. Stored on the settlement (`harvestFactor`).
- **Epidemics**: `chancePerYear` → that year's deaths × `deathMultiplier`; `report.epidemic`.
- **Migration trickle** (December, after the yearly update, villages first): idle/hands > `minIdleShare` and parent fully fed this year → `sharePerYear` × idle hands (×(1 ± spread)) leave with dependants for the parent; `report.trickleOut/In`. `report.sufficiency` keeps the year's sufficiency for the parent check. Yearly report fields now survive the monthly reset.
- `src/headless/start.ts`: runs the start position N calendar years with presets `baseline` (all off), `noise`, `trickle`, `all` (= data defaults) and per-knob overrides; yearly table by tier, per-settlement table with hunger/yr, village spread, CSV.
- UI: hover card shows "Harvest this year: N %" and "⚠ epidemic"; panel adds a Harvest row and the trickle to "Last year".
- Tests: 10 new (79) — Poisson/gaussian moments; sampling off = seed-independent, on = reproducible and unbiased, cities less jittery than villages; harvest factors (regional sharing, floor, mean); a bad year leaves less grain; epidemic doubles deaths; trickle amount, conservation, threshold, hungry parent, zero share, spread bounds; everything-on determinism; data defaults.

**Findings on the start position (60 years; all figures from `--scenario start`):**
- **Baseline (deterministic):** the realm is at its food ceiling: 247,673 → 245,683, flat. The three cities starve steadily — Hugeopolis ≈ 940, Omerburg ≈ 860, Hillside ≈ 300 hunger deaths *per year* (≈ 2,100/yr, 126,000 over 60 years) — because each sits exactly at what its orbit feeds (3.9–5.4 months of grain); births replace the dead each year. Towns never go hungry. Village 63 (900 people on 4 hill hexes under Hillside) starves and empties into Hillside within a decade. 50 villages, **14 distinct sizes** — Omer's observation confirmed.
- **Sampling alone:** same totals, **47 distinct village sizes**; nothing else changes.
- **Noise (sampling + harvest ±15 % + epidemics 1 %):** the steady 2,100 deaths/yr become **famine years** — 6,000–7,400 dead in a bad year (year 25, year 60), nothing in good ones; towns dip 10–40 % in bad years and refill; 27–43 epidemic-years per run; realm 239k–248k at year 60 depending on the seed. With sd 0.10 the swings are about half.
- **Trickle alone:** 130–155 people/yr move village → town; towns +2.6k, villages −4.4k over 60 years; cities unchanged because they are never "fully fed" (the pull condition blocks them). Realm total unchanged.
- **Everything on:** the trickle pumps ≈ 90,000 people over 60 years up the hierarchy in good years — cities swell from 71k to 100–110k (Hugeopolis to 52,000, Omerburg to 43,000) and then starve them back (140,000 hunger deaths); towns shrink 91k → 72k, villages 65k → 56k. The realm's total stays ≈ 246k: **the land caps the realm, the knobs only move people around within the cap.**
- Reading: the realm as placed lives at the edge; every added realism exposes that (which is correct behaviour). The trickle's "parent is fed" pull is too weak a brake — the right brake is **work at the destination**, which doesn't exist until workshops (buildings session). Recommendation to Omer: adopt sampling; adopt harvest variance at 0.10–0.15 and epidemics; keep the trickle **off** (or tiny) until buildings give towns jobs, then add a jobs condition.

**Design decisions made by Omer this session:** the starting position (DESIGN §4.8). The knobs are PROPOSED (DESIGN §4.1) pending his verdict.

**Broken / unfinished:** knob values are drafts; the trickle lacks a jobs-at-destination condition (by design, until buildings).

**Tests & build:** pass (79/79; `tsc` clean; build clean; headless browser run clean — 20 years on the start position in 173 ms).

**Commit(s):** `scenario: Omer's starting position …` (3dd266a), `phase1: demographic realism knobs (PROPOSED) …` (298129b) + docs commit.

**Build delivered:** `realms.html` (Session 9) — note it runs with all knobs ON at draft values.

**Next session should:**
1. Set the knobs to Omer's verdict; record in DESIGN §4.1 (DECIDED); rerun `--scenario start`.
2. Buildings with effects + build queue (give towns work; then the trickle's jobs condition); yearly realm report; Phase 1 acceptance.

## 2026-11-05 — Session 9b — Knob decisions, abandonment

**Omer's decisions (DESIGN v0.3f):** vital sampling adopted; harvest variance adopted at sd 0.125; epidemics adopted for now (natural events to become a game-wide mechanic later, §4.9); trickle kept off (rule retained). Villages that empty out are removed automatically (an "abandoned settlement" entity may come later).

**Done:** data values set; `abandonment.abandonBelow` 30 in `data/settlements.json`; `abandonEmptySettlements` (monthly, after spoilage/capping, before migration: the remnant walks to the parent if any, granary lost, `resolveAllParents` rerun); `state.events` + `logEvent` (v3 saves without it get an empty log); the top bar's details row shows the last event; `abandonBelow()` / `setAbandonBelow()` live-readable so the scale test can switch it off. Tests: 1 new (80). Rerun of the start position at the decided values: Village 63 abandoned (49 villages, min 834, 47 distinct sizes); realm 247,673 → 240,892 over 60 years; cities still at their ceiling (≈2,100 hunger deaths/yr); famine years of up to 8,000 dead; 33 epidemic-years.

**Tests & build:** 80/80; `tsc` clean; build clean; headless browser run clean (12 years in the browser, zero errors). **Commit:** `phase1: Omer's knob decisions …; automatic abandonment …` (f100a4f) + docs. **Build delivered:** `realms.html` (Session 9b).

**Next session should:** take Omer's decisions on the sharing model and the Cluster (see Current state → Next steps 2), then buildings.

## 2026-11-05 — Session 9c — Sharing model and Cluster decided

**Omer's decisions (DESIGN v0.3g):** **Tithe** adopted at 10 % (draft) of all subordinate food production, in kind, as produced — to become a player policy when §4.3 policies are built; **requisition** waits for Phase 4; the **Cluster** adopted as a derived view: cluster outline replaces the dotted influence line on the map (hover keeps the dotted edge), singletons outlined faintly, cluster panel. **Order of work:** cluster view → tithe with an A/B on the start position → buildings. Work continued in the same chat as Session 10.

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
