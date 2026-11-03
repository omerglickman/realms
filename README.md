# Realms, Kings and Other Stuff

A medieval-ish hex grand strategy game. Designed by Omer; implemented by Claude.

**Read first, every session:** `DESIGN.md` (what the game is), `ROADMAP.md` (how we build it and the session protocol), `DEVLOG.md` (what has been done and where to continue). The canonical copies live in the claude.ai Project; these are mirrors.

## Running

- **Play:** open `dist/realms.html` in a browser (it is a single self-contained file; no server needed).
- **Develop:** `npm install`, then `npm run dev` and open the printed address.
- **Build the playable file:** `npm run build` → `dist/realms.html`.
- **Tests:** `npm test`.
- **Headless simulation:** `npm run sim -- --seed realms --width 160 --height 100 --turns 24`.

## Layout

```
data/          game numbers (terrain, resources, units…) — editable JSON, no code
maps/          hand-edited map files
src/sim/       the rules: pure TypeScript, no rendering, runs in Node
src/ui/        PixiJS map rendering, camera, HTML panels, (editor)
src/headless/  command-line runner for balance runs
tests/         vitest unit and scenario tests
dist/          built game (git-ignored)
```
