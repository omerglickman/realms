// Compare a map file against another (default: maps/testmap.json).
// Usage: npm run mapdiff -- path/to/exported.json [path/to/base.json]
import { readFileSync } from 'node:fs';
import { loadMapFile } from '../sim/mapfile';
import { TERRAIN } from '../sim/terrain';
import { RESOURCES } from '../sim/resources';

const newPath = process.argv[2];
const basePath = process.argv[3] ?? 'maps/testmap.json';
if (!newPath) { console.error('usage: npm run mapdiff -- <new.json> [base.json]'); process.exit(1); }
const a = loadMapFile(JSON.parse(readFileSync(basePath, 'utf8')));
const b = loadMapFile(JSON.parse(readFileSync(newPath, 'utf8')));
console.log(`base: ${basePath} ("${a.name}", ${a.map.width}x${a.map.height})`);
console.log(`new:  ${newPath} ("${b.name}", ${b.map.width}x${b.map.height})`);
if (a.map.width !== b.map.width || a.map.height !== b.map.height) { console.log('SIZE DIFFERS'); process.exit(2); }
let changed = 0;
const from: Record<string, number> = {}, to: Record<string, number> = {};
let minC = Infinity, maxC = -1, minR = Infinity, maxR = -1;
for (let i = 0; i < a.map.terrain.length; i++) {
  if (a.map.terrain[i] === b.map.terrain[i]) continue;
  changed++;
  const f = TERRAIN[a.map.terrain[i]].id, t = TERRAIN[b.map.terrain[i]].id;
  from[f] = (from[f] ?? 0) + 1; to[t] = (to[t] ?? 0) + 1;
  const c = i % a.map.width, r = Math.floor(i / a.map.width);
  minC = Math.min(minC, c); maxC = Math.max(maxC, c); minR = Math.min(minR, r); maxR = Math.max(maxR, r);
}
console.log(`changed: ${changed} hexes (${((100 * changed) / a.map.terrain.length).toFixed(1)}%)` + (changed ? ` in cols ${minC}–${maxC}, rows ${minR}–${maxR}` : ''));
const fmt = (o: Record<string, number>) => Object.entries(o).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(', ');
console.log('painted over:', fmt(from) || '—');
console.log('painted as:  ', fmt(to) || '—');
let rchanged = 0;
const rfrom: Record<string, number> = {}, rto: Record<string, number> = {};
const rname = (i: number) => (i < 0 ? 'none' : RESOURCES[i].id);
for (let i = 0; i < a.map.resource.length; i++) {
  if (a.map.resource[i] === b.map.resource[i]) continue;
  rchanged++;
  rfrom[rname(a.map.resource[i])] = (rfrom[rname(a.map.resource[i])] ?? 0) + 1;
  rto[rname(b.map.resource[i])] = (rto[rname(b.map.resource[i])] ?? 0) + 1;
}
console.log(`resources changed: ${rchanged} hexes`);
if (rchanged) { console.log('  was:', fmt(rfrom)); console.log('  now:', fmt(rto)); }
