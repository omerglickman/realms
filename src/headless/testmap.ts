// Phase 1 scenario on the REAL test map (maps/testmap.json): cities placed on
// actual terrain with resources, villages around them where the land allows,
// 20 years headless. Answers "does the model behave on the vinral map, not
// just on ideal land?"
// Usage: npm run sim -- --scenario testmap [--years 20] [--sites 5] [--csv out/testmap.csv]

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadMapFile } from '../sim/mapfile';
import type { MapData } from '../sim/map';
import { TERRAIN, terrainIndex } from '../sim/terrain';
import { RESOURCES } from '../sim/resources';
import { createGameState, type GameState } from '../sim/state';
import { endTurn } from '../sim/turn';
import { applyCommand } from '../sim/commands';
import { axialRange, axialDistance, axialToOffset, offsetToAxial } from '../sim/hex';
import { totalPopulation } from '../sim/demography';
import { TIERS, type Settlement } from '../sim/settlements';
import { hexJobs, ECONOMY } from '../sim/economy';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const YEARS = Number(arg('years', '20'));
const SITES = Number(arg('sites', '5'));
const CSV = arg('csv', '');

const { map, name } = loadMapFile(JSON.parse(readFileSync('maps/testmap.json', 'utf8')));
const W = map.width, H = map.height;
const SEA = terrainIndex('sea'), LAKE = terrainIndex('lake'), MOUNTAINS = terrainIndex('mountains');
const isLand = (i: number) => map.terrain[i] !== SEA && map.terrain[i] !== LAKE;
const canSettle = (i: number) => isLand(i) && map.terrain[i] !== MOUNTAINS;

/** Flat indices within `rings` of a hex that are on the map. */
function cellsAround(i: number, rings: number): number[] {
  const c = offsetToAxial(i % W, Math.floor(i / W));
  const out: number[] = [];
  for (const h of axialRange(c, rings)) {
    const o = axialToOffset(h.q, h.r);
    if (o.col >= 0 && o.row >= 0 && o.col < W && o.row < H) out.push(o.row * W + o.col);
  }
  return out;
}
const dist = (a: number, b: number) =>
  axialDistance(offsetToAxial(a % W, Math.floor(a / W)), offsetToAxial(b % W, Math.floor(b / W)));

/** People a set of hexes would feed per year at full labour (all jobs). */
function capacity(cells: number[]): number {
  let t = 0;
  for (const c of cells) for (const j of hexJobs(map, c)) t += j.fedPerYear;
  return t;
}

// ---- score every settle-able hex as a city site (ring-2 capacity) ----
const cityCap = new Float64Array(W * H);
for (let i = 0; i < W * H; i++) cityCap[i] = canSettle(i) ? capacity(cellsAround(i, 2)) : 0;
const villageCap = new Float64Array(W * H);
for (let i = 0; i < W * H; i++) villageCap[i] = canSettle(i) ? capacity(cellsAround(i, 1)) : 0;

const candidates = [...Array(W * H).keys()].filter((i) => cityCap[i] > 0).sort((a, b) => cityCap[b] - cityCap[a]);
const pct = (p: number) => candidates[Math.min(candidates.length - 1, Math.floor(candidates.length * p))];

// Pick sites: best, good (10th percentile), median, poor (80th percentile), and the best coastal site.
const shoreCount = (i: number) => cellsAround(i, 2).filter((c) => map.terrain[c] === SEA && hexJobs(map, c).length > 0).length;
const coastal = candidates.find((i) => shoreCount(i) >= 4)!;
const picks: { label: string; i: number }[] = [
  { label: 'best land', i: candidates[0] },
  { label: 'good land (top 10 %)', i: pct(0.1) },
  { label: 'median land', i: pct(0.5) },
  { label: 'poor land (bottom 20 %)', i: pct(0.8) },
  { label: 'best coastal site', i: coastal },
].slice(0, SITES);

function describe(cells: number[]): string {
  const counts = new Map<string, number>();
  for (const c of cells) counts.set(TERRAIN[map.terrain[c]].name, (counts.get(TERRAIN[map.terrain[c]].name) ?? 0) + 1);
  const res = new Map<string, number>();
  for (const c of cells) if (map.resource[c] >= 0) res.set(RESOURCES[map.resource[c]].name, (res.get(RESOURCES[map.resource[c]].name) ?? 0) + 1);
  const t = [...counts].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
  const r = [...res].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
  return t + (r ? ` · resources: ${r}` : ' · no resources');
}

interface Row { site: string; year: number; city: number; cityMonths: number; cityHunger: number; received: number; villages: number; villagePop: number; villageHunger: number; migrants: number }
const rows: Row[] = [];

for (const pick of picks) {
  const state: GameState = createGameState(`tm-${pick.i}`, map);
  const col = pick.i % W, row = Math.floor(pick.i / W);
  applyCommand(state, { type: 'foundSettlement', settlement: { name: 'City', tier: 'city', col, row, population: 8000, faction: 'A' } });
  const city = Object.values(state.settlements)[0];

  // villages: best ring-1 capacity first, at distance 3–5, not within 2 of another village, land that can feed them
  const placed: number[] = [];
  const zone = cellsAround(pick.i, 5).filter((c) => { const d = dist(c, pick.i); return d >= 3 && d <= 5 && canSettle(c); });
  zone.sort((a, b) => villageCap[b] - villageCap[a]);
  for (const c of zone) {
    if (placed.some((p) => dist(p, c) < 3)) continue;
    const cap = villageCap[c];
    const pop = cap >= 700 ? 600 : cap >= 450 ? 400 : cap >= 300 ? 250 : 0;
    if (!pop) continue;
    placed.push(c);
    applyCommand(state, { type: 'foundSettlement', settlement: { name: `v${placed.length}`, tier: 'village', col: c % W, row: Math.floor(c / W), population: pop, faction: 'A' } });
  }
  const villages = Object.values(state.settlements).filter((s) => s.id !== city.id);
  const startVillagePop = villages.reduce((t, s) => t + totalPopulation(s.pop), 0);

  console.log(`\n=== ${pick.label} — city at (${col},${row}) ===`);
  console.log(`  city fields (19 hexes): ${describe(cellsAround(pick.i, 2))} → feeds ${cityCap[pick.i].toFixed(0)}/yr at full labour`);
  console.log(`  orbit (rings 3–5): ${describe(cellsAround(pick.i, 5).filter((c) => dist(c, pick.i) >= 3))}`);
  console.log(`  villages placed: ${villages.length} (${startVillagePop} people), their land feeds ${villages.reduce((t, s) => t + villageCap[s.row * W + s.col], 0)}/yr`);
  console.log('  year   city  granary(mo)  hunger   recvd | villages   pop  hunger  migrants');
  for (let y = 0; y < YEARS; y++) {
    let cityHunger = 0, received = 0, vHunger = 0, mig = 0;
    for (let m = 0; m < 12; m++) {
      endTurn(state);
      cityHunger += city.report.hungerDeaths;
      received += city.report.received;
      for (const v of villages) { vHunger += v.report.hungerDeaths; mig += v.report.migrantsOut; }
    }
    const cpop = totalPopulation(city.pop);
    const r: Row = {
      site: pick.label, year: y + 1, city: cpop, cityMonths: cpop > 0 ? city.food / (cpop * ECONOMY.foodPerPersonPerMonth) : 0,
      cityHunger, received, villages: villages.length, villagePop: villages.reduce((t, s) => t + totalPopulation(s.pop), 0), villageHunger: vHunger, migrants: mig,
    };
    rows.push(r);
    if (r.year <= 3 || r.year % 5 === 0) {
      console.log(`  ${String(r.year).padStart(4)} ${r.city.toFixed(0).padStart(6)} ${r.cityMonths.toFixed(1).padStart(12)} ${r.cityHunger.toFixed(0).padStart(7)} ${r.received.toFixed(0).padStart(7)} | ${String(r.villages).padStart(8)} ${r.villagePop.toFixed(0).padStart(5)} ${r.villageHunger.toFixed(0).padStart(7)} ${r.migrants.toFixed(0).padStart(9)}`);
    }
  }
}

console.log(`\nmap "${name}" ${W}×${H}; ${candidates.length} settle-able hexes; best city site feeds ${cityCap[candidates[0]].toFixed(0)}, median ${cityCap[pct(0.5)].toFixed(0)}, bottom-20 % ${cityCap[pct(0.8)].toFixed(0)} per year`);

if (CSV) {
  mkdirSync(dirname(CSV), { recursive: true });
  writeFileSync(CSV, ['site,year,city,cityGranaryMonths,cityHunger,received,villages,villagePop,villageHunger,migrants', ...rows.map((r) => [r.site, r.year, r.city.toFixed(0), r.cityMonths.toFixed(2), r.cityHunger.toFixed(0), r.received.toFixed(0), r.villages, r.villagePop.toFixed(0), r.villageHunger.toFixed(0), r.migrants.toFixed(0)].join(','))].join('\n'));
  console.log(`wrote ${CSV}`);
}
