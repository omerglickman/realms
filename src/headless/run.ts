// Headless runner: runs the simulation without any graphics (ROADMAP B.1).
// Usage: npm run sim -- --seed realms --width 160 --height 100 --turns 24 --continents 2 --islands 6 --land 45
// Phase 0: generates a draft map, runs N empty turns, prints a summary.
// Later phases: AI-vs-AI games, CSV statistics for balancing.

import { generateDraftMap } from '../sim/mapgen';
import { createGameState, calendar } from '../sim/state';
import { endTurn } from '../sim/turn';
import { countTerrain } from '../sim/map';
import { TERRAIN } from '../sim/terrain';
import { RESOURCES, countResources } from '../sim/resources';
import { saveMapFile } from '../sim/mapfile';
import { writeFileSync } from 'node:fs';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

// Named scenarios live in their own files: `npm run sim -- --scenario phase1`.
const scenario = arg('scenario', '');
if (scenario) {
  await import(`./${scenario}.ts`);
} else {
  await main();
}

async function main(): Promise<void> {

const seed = arg('seed', 'realms');
const width = Number(arg('width', '160'));
const height = Number(arg('height', '100'));
const turns = Number(arg('turns', '12'));
const continents = Number(arg('continents', '2'));
const islands = Number(arg('islands', '6'));
const landFraction = Number(arg('land', '45')) / 100;
const out = arg('out', '');

const t0 = performance.now();
const map = generateDraftMap({ width, height, seed, continents, islands, landFraction });
const state = createGameState(seed, map);
for (let i = 0; i < turns; i++) endTurn(state);
const ms = performance.now() - t0;

if (out) {
  const file = { ...saveMapFile(map, `draft ${seed}`, { seed, continents, islands, landFraction }) };
  writeFileSync(out, JSON.stringify(file));
  console.log(`wrote ${out}`);
}

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
const rc = countResources(map);
console.log('Resources:');
RESOURCES.forEach((r, i) => console.log(`  ${r.name.padEnd(12)} ${String(rc[i]).padStart(6)}`));
}
