# Realms, Kings and Other Stuff — Development Log

Every chat session appends an entry here at the end, **even if the work is unfinished or broken**. The next session reads the "Current state" block first, then the latest entries. Keep entries factual: what was done, how, what broke, where to continue.

---

## CURRENT STATE (always kept up to date — overwrite this block, don't append to it)

- **Phase:** 0 — Skeleton and map. Skeleton, canvas and terrain editor done; resources remain, then Phase 0 acceptance.
- **Repository:** GitHub `omerglickman/realms` (private). Claude has push access. Default branch `main`.
- **How to run:** open `dist/realms.html` in a browser. Development: `npm install`, `npm run dev`. Build: `npm run build` → `dist/realms.html`. Tests: `npm test` (28 passing). Headless: `npm run sim -- --seed vinral --continents 2 --islands 6 --land 45 --turns 24` (add `--out maps/x.json` to write a map file).
- **Last playable build:** `realms.html` from Session 3 (2026-11-04) — opens on the frozen test map; **map editor** (E or "Edit map"): terrain palette with number keys, Brush (B) sizes 1/2/3/5 (`[` `]`), Fill (F), Pick (I), undo/redo (Ctrl+Z / Ctrl+Y, 200 steps), Export .json / Import…, autosave to browser storage with a Restore/Discard prompt on next open, unsaved-edits warning on close; left-drag paints, right/middle-drag pans. Generator is folded into a "New draft…" disclosure.
- **The map:** `maps/testmap.json` = "vinral", 160×100, **revision 2 — Omer's second edit batch (2026-11-04; rev 1 changed 1,571 hexes, rev 2 a further 935)** on top of the generated draft (seed `vinral`, 2 continents, 6 islands, 45 % land; DESIGN §2.2). The file is canonical; the editor edits it; the generator only makes new drafts. `meta.revision` in the file counts Omer's committed edit batches.
- **What works:** hex math (odd-r offset ↔ axial, distance, rings, pixel conversion); map store up to 400×250; index-stable terrain table from `data/terrain.json`; seeded RNG; crude draft generator (1–3 continents in horizontal slots with sea channels between them + islands, domain-warped coastlines, fractal noise, sea level from land fraction, ridged-noise mountain ranges, moisture bands, northern tundra, lakes, meandering downhill rivers); map file format `src/sim/mapfile.ts` (versioned, terrain ids stored for safe re-mapping); `GameState` with monthly clock and JSON save/load; chunked PixiJS renderer (32×32-hex chunks, lazy build, viewport culling, grid auto-hidden below zoom 0.5); camera with drag-pan, wheel-zoom, arrow keys, Home = fit, G = grid toggle; HUD; map editor (see Last playable build).
- **Known broken / limitations:** no resources yet; no map resize in the editor; editing works on the embedded copy of the test map — Omer's edited file must be sent back (attach the exported .json to a chat) for the session to commit it as `maps/testmap.json`; generator produces fewer islands than requested when they fall near a continent (they merge) — acceptable for a draft; at land ≥55% continents tend to touch.
- **Performance (measured by Omer 2026-11-04):** 60–61 fps at every map size including 400×250 fully zoomed out. Budget met.
- **Next steps (in order):**
  1. Whenever Omer attaches a newly exported map `.json`: `npm run mapdiff -- <file>` (validates + diffs against `maps/testmap.json`), set `name` to "vinral" and bump `meta.revision`, commit, rebuild, deliver.
  2. Session 4: resources (`data/resources.json`, spawn weights by terrain, render as small icons/dots), resource painting in the editor, map save/load polish, Phase 0 acceptance review with Omer.
- **Scheduled design sessions:** "Government & Institutions" (DESIGN §4.3) before Phase 2.
- **Open questions for Omer:** DESIGN.md §5 (desert; number of factions).

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

## 2026-11-04 — Session 3c — Map revision 2

Second edit batch from Omer: 935 hexes changed (5.8 %) vs revision 1 — mostly sea → land (433 sea hexes painted over; coasts filled in, islands enlarged), plus plains/grassland reshuffling, more hills and forest, tundra extended. Committed as `maps/testmap.json` revision 2. Added `npm run mapdiff -- <file> [base]` (`src/headless/mapdiff.ts`) for this loop. Tests 28/28, build clean, delivered `realms.html`.

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
