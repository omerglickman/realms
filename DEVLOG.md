# Realms, Kings and Other Stuff — Development Log

Every chat session appends an entry here at the end, **even if the work is unfinished or broken**. The next session reads the "Current state" block first, then the latest entries. Keep entries factual: what was done, how, what broke, where to continue.

---

## CURRENT STATE (always kept up to date — overwrite this block, don't append to it)

- **Phase:** 0 — Skeleton and map. Skeleton done; map editor not started.
- **Repository:** GitHub `omerglickman/realms` (private). Claude has push access. Default branch `main`.
- **How to run:** open `dist/realms.html` in a browser. Development: `npm install`, `npm run dev`. Build: `npm run build` → `dist/realms.html`. Tests: `npm test` (19 passing). Headless: `npm run sim -- --seed realms --width 160 --height 100 --turns 24`.
- **Last playable build:** `realms.html` from Session 2 (2026-11-04) — pan/zoom hex map; draft generator with seed, size, continents (1–3), islands, land % controls and a Random button; settings also in the URL hash (`realms.html#seed=…&continents=…`).
- **What works:** hex math (odd-r offset ↔ axial, distance, rings, pixel conversion); map store up to 400×250; index-stable terrain table from `data/terrain.json`; seeded RNG; crude draft generator (1–3 continents in horizontal slots with sea channels between them + islands, domain-warped coastlines, fractal noise, sea level from land fraction, ridged-noise mountain ranges, moisture bands, northern tundra, lakes, meandering downhill rivers); `GameState` with monthly clock and JSON save/load; chunked PixiJS renderer (32×32-hex chunks, lazy build, viewport culling, grid auto-hidden below zoom 0.5); camera with drag-pan, wheel-zoom, arrow keys, F = fit, G = grid toggle; HUD.
- **Known broken / limitations:** no editor yet, so the map cannot be changed by hand; no resources; no save/load UI (only in code); generator produces fewer islands than requested when they fall near a continent (they merge) — acceptable for a draft; at land ≥55% continents tend to touch.
- **Performance (measured by Omer 2026-11-04):** 60–61 fps at every map size including 400×250 fully zoomed out. Budget met.
- **Next steps (in order):**
  1. Omer picks a starting canvas (seed + continents/islands/land settings) from the candidate sheet or by playing with the Random button; the chosen settings go into `maps/testmap.json` once the editor can save.
  2. Session 3: **map editor** — terrain palette, brush (sizes 1/2/3/5), fill-region, undo/redo via a command layer (`src/sim/commands.ts`), generator parameter controls (land fraction, scale, rivers), export/import of `maps/*.json` through download/upload, and `maps/testmap.json` committed as the starting draft.
  3. Session 4: resources (`data/resources.json`, spawn weights by terrain, render as small icons/dots), resource painting in the editor, map save/load polish, Phase 0 acceptance review with Omer.
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

**Build delivered:** `realms.html` (Session 2) + `map_candidates.png` (v1) and `map_candidates_v2.png` (rugged coasts, same eight seeds).

**Next session should:**
1. Note Omer's chosen canvas (seed/settings) in DESIGN §2.2 or DEVLOG.
2. Build the map editor (command layer, brushes, fill, undo/redo, export/import JSON) and save the chosen draft as `maps/testmap.json`.
