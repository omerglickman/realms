// Headless runner: runs the simulation without any graphics (ROADMAP B.1).
// Usage: npm run sim -- --seed realms --width 160 --height 100 --turns 24
// Phase 0: generates a draft map, runs N empty turns, prints a summary.
// Later phases: AI-vs-AI games, CSV statistics for balancing.

import { generateDraftMap } from '../sim/mapgen';
import { createGameState, calendar } from '../sim/state';
import { endTurn } from '../sim/turn';
import { countTerrain } from '../sim/map';
import { TERRAIN } from '../sim/terrain';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const seed = arg('seed', 'realms');
const width = Number(arg('width', '160'));
const height = Number(arg('height', '100'));
const turns = Number(arg('turns', '12'));

const t0 = performance.now();
const map = generateDraftMap({ width, height, seed });
const state = createGameState(seed, map);
for (let i = 0; i < turns; i++) endTurn(state);
const ms = performance.now() - t0;

const counts = countTerrain(map);
const total = map.terrain.length;
console.log(`Realms headless — seed "${seed}", map ${width}x${height}, ${turns} turns in ${ms.toFixed(1)} ms`);
const cal = calendar(state.turn);
console.log(`Date: ${cal.monthName}, year ${cal.year}`);
console.log('Terrain:');
TERRAIN.forEach((t, i) => {
  const n = counts[i] ?? 0;
  console.log(`  ${t.name.padEnd(10)} ${String(n).padStart(7)}  ${((100 * n) / total).toFixed(1).padStart(5)}%`);
});
