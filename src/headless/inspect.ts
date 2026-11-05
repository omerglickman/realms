// Inspect a scenario file: settlements by tier, parents, populations, date. Usage: npx tsx src/headless/inspect.ts <file>
import { readFileSync } from 'node:fs';
import { loadScenarioFile } from '../sim/scenario';
import { calendar } from '../sim/state';
import { TIERS, resolveAllParents, workedCellsBySettlement } from '../sim/settlements';
import { totalPopulation } from '../sim/demography';
import { TERRAIN } from '../sim/terrain';

const file = process.argv[2];
const { state, name } = loadScenarioFile(JSON.parse(readFileSync(file, 'utf8')));
resolveAllParents(state);
const cal = calendar(state.turn);
console.log(`scenario "${name}" · ${state.map.width}×${state.map.height} · ${cal.monthName}, year ${cal.year} (turn ${state.turn}) · state v${state.version}`);
const worked = workedCellsBySettlement(state);
const list = Object.values(state.settlements).sort((a, b) => TIERS[b.tier].rank - TIERS[a.tier].rank || a.name.localeCompare(b.name));
let total = 0;
for (const s of list) {
  const pop = totalPopulation(s.pop); total += pop;
  const parent = s.parent ? state.settlements[s.parent].name : '—';
  const t = TERRAIN[state.map.terrain[s.row * state.map.width + s.col]].name;
  const kids = list.filter((k) => k.parent === s.id).length;
  console.log(`${TIERS[s.tier].name.padEnd(10)} ${s.name.padEnd(18)} (${String(s.col).padStart(3)},${String(s.row).padStart(3)}) ${t.padEnd(9)} pop ${Math.round(pop).toLocaleString('en-US').padStart(7)} food ${(s.food / Math.max(1, pop)).toFixed(1).padStart(5)} mo  worked ${String(worked.get(s.id)?.length ?? 0).padStart(2)}  parent ${parent.padEnd(18)} ${kids ? `dependants ${kids}` : ''}`);
}
console.log(`${list.length} settlements, ${Math.round(total).toLocaleString('en-US')} people`);
