// The road builder (Phase 2 session 2): lay a road between two settlements of
// the starting position with one work-band and report what it cost and what it
// buys. Usage:
//   npm run sim -- --scenario roads --from Hugeopolis --to Hillside [--level dirt|paved] [--people 300] [--file scenarios/start.json]
// Prints the plan (hexes, bridges, materials, band-months), the months the band
// took, and how many months settlers (4 points) and a work-band (5) need for the
// same walk before the road and after it.

import { readFileSync } from 'node:fs';
import { loadScenarioFile } from '../sim/scenario';
import { endTurn } from '../sim/turn';
import { applyCommand } from '../sim/commands';
import { findRoute, OPEN } from '../sim/pathfinding';
import { idx } from '../sim/map';
import { unitCell } from '../sim/units';
import { makeBuildOrder, orderSummary } from '../sim/workbands';
import { INFRA } from '../sim/infrastructure';
import { setNoise, NO_NOISE } from '../sim/noise';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const FILE = arg('file', 'scenarios/start.json');
const { state } = loadScenarioFile(JSON.parse(readFileSync(FILE, 'utf8')));
setNoise(NO_NOISE);
const find = (name: string) => Object.values(state.settlements).find((s) => s.name.toLowerCase() === name.toLowerCase());
const from = find(arg('from', 'Hugeopolis')), to = find(arg('to', 'Hillside'));
if (!from || !to) { console.error('unknown settlement; try inspect.ts'); process.exit(1); }
const level = arg('level', 'dirt');
const people = Number(arg('people', '300'));
const A = idx(state.map, from.col, from.row), B = idx(state.map, to.col, to.row);

const walk = (points: number): string => {
  const r = findRoute(state, { cell: A, bank: OPEN }, B, points);
  return r && Number.isFinite(r.months) ? `${r.months} mo (${r.nodes.length} hexes, ${r.cost} pts)` : 'no way';
};
const before = { settlers: walk(4), band: walk(5) };

// the start position has an empty treasury and stockpile in February of year 1: fund the run (the materials are counted in the plan)
const fac = state.factions[state.playerFaction];
fac.treasury = Math.max(fac.treasury, 50_000);
fac.stock.timber = Math.max(fac.stock.timber, 5000); fac.stock.stone = Math.max(fac.stock.stone, 5000);
applyCommand(state, { type: 'raiseUnit', spec: { type: 'workband', at: from.id, muster: [{ id: from.id, people }], provisionMonths: 3 } });
endTurn(state);
const u = Object.values(state.units).find((x) => x.type === 'workband')!;
const mk = makeBuildOrder(state, u, level, B);
if (!mk.order) { console.error(mk.reason); process.exit(1); }
const sum = orderSummary(state, u, mk.order);
console.log(`Road ${from.name} → ${to.name}, ${level}, one band of ${people}:`);
console.log(`  plan: ${mk.order.route.length} hexes on the route, ${sum.steps.length} jobs, ${sum.bridges} bridges; ${Math.round(sum.materials.timber)} timber, ${Math.round(sum.materials.stone)} stone; ≈ ${sum.months.toFixed(1)} band-months`);
applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: mk.order });
let months = 0;
const t0 = state.turn;
while (state.units[u.id]?.build && months < 600) { endTurn(state); months++; }
const alive = state.units[u.id];
console.log(`  built in ${months} months${alive?.report.blocked ? ` (stopped: ${alive.report.blocked})` : ''}; ${Object.keys(state.infra.roads).length} road hexes, ${Object.keys(state.infra.bridges).length} bridges; band at ${alive ? `(${alive.col}, ${alive.row})` : 'gone'}`);
const ev = state.events.filter((e) => e.turn >= t0 && (e.kind === 'built' || e.kind === 'hunger')).slice(-4).map((e) => e.text);
if (ev.length) console.log('  ' + ev.join('\n  '));
console.log('  walk', from.name, '→', to.name);
console.log(`    before: settlers ${before.settlers}; band ${before.band}`);
console.log(`    after: settlers ${walk(4)}; band ${walk(5)}`);
if (alive) console.log(`  band ends at ${alive.col},${alive.row}; cell ${unitCell(state.map, alive)}`);
