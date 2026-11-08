// Work-bands (Phase 2 session 2; DESIGN §3.2b rule 7, §3.4): a band builds roads
// and bridges hex by hex. An order names an item and a route (the hexes to
// cover, in walking order); each month the band walks to where the next piece
// of work is done from, pays its materials when work on a hex begins (from the
// cluster whose influence covers the hex, else the realm stockpile — the band
// waits if neither has them), and works for the rest of its month. A bigger band
// is faster (people / refPeople, up to maxRate). "Road from X to Y" = a route
// planned by `planRoadRoute`, bridges inserted where a river hex needs one.
// Rules here, numbers in data/infrastructure.json, no DOM.

import type { GameState } from './state';
import { logEvent } from './state';
import { totalPopulation } from './demography';
import { type Unit, type UnitReport, unitCell, unitTypeDef, coveringSettlement, isForming } from './units';
import { INFRA, infraItem, builtRoad, roadLevelAt, stepCostBetween } from './infrastructure';
import { findRoute, needsBridge, neighbourCells, isRiver, OPEN, planRoadRoute } from './pathfinding';
import { type Materials, MATERIAL_IDS, emptyMaterials, clusterStock, payFromCluster } from './materials';
import { settlementIdAt, makeSettlement, tierIndex, isRuin, resolveAllParents, TIERS } from './settlements';
import { castleAt, castleBuildCost, castleName, restoreRuin, CASTLES } from './castles';
import { canCastleAt } from './settlements';
import { fortAt } from './forts';
import { TERRAIN, terrainIndex } from './terrain';
import { axialDistance, axialToOffset, offsetToAxial } from './hex';

/** What a band has been told to build: `item` along `route` (cells in walking order); `i` = the first hex not yet done. */
export interface BuildOrder {
  kind: 'build';
  /** 'dirt' | 'paved' (a road along the route, bridges added where needed) | 'bridge' (a single river hex) */
  item: string;
  route: number[];
  i: number;
}

/** The piece of work in hand: its item and hex, progress 0–1, and whether its materials have been paid. */
export interface WorkProject {
  item: string;
  cell: number;
  progress: number;
  paid: boolean;
}

export interface BuildStep { item: string; cell: number }

const SEA_LAKE = new Set([terrainIndex('lake'), terrainIndex('sea')]);

function inSettlement(state: GameState, cell: number): boolean {
  const w = state.map.width;
  return settlementIdAt(state, cell % w, Math.floor(cell / w)) !== null;
}

/** What still has to be built on `cell` for order item `item`, or null when it is done. */
export function stepNeeded(state: GameState, item: string, cell: number): string | null {
  if (infraItem(item).kind === 'castle') return castleAt(state, cell) ? null : item; // a standing castle is done (upgrade it from its own card)
  if (item === 'bridge') return needsBridge(state, cell) ? 'bridge' : null;
  if (inSettlement(state, cell)) return null; // a settlement's hex is road enough (and bridged)
  if (needsBridge(state, cell)) return 'bridge';
  const level = infraItem(item).level;
  const have = builtRoad(state, cell);
  if (have < 1) return 'dirt';
  if (level >= 2 && have < 2) return 'paved';
  return null;
}

/** Every piece of work left on an order, in order (for previews and totals); does not change the order. */
export function pendingSteps(state: GameState, b: BuildOrder): BuildStep[] {
  const out: BuildStep[] = [];
  const level = infraItem(b.item).level;
  const isCastleOrder = infraItem(b.item).kind === 'castle';
  for (let k = b.i; k < b.route.length; k++) {
    const cell = b.route[k];
    if (isCastleOrder) { if (stepNeeded(state, b.item, cell)) out.push({ item: b.item, cell }); continue; }
    // a hex can need two things in turn: its bridge, then its road
    if (b.item === 'bridge') { if (needsBridge(state, cell)) out.push({ item: 'bridge', cell }); continue; }
    if (inSettlement(state, cell)) continue;
    const bridgeNeeded = needsBridge(state, cell);
    if (bridgeNeeded) out.push({ item: 'bridge', cell });
    const have = bridgeNeeded ? 1 : builtRoad(state, cell);
    if (have < 1) out.push({ item: 'dirt', cell });
    if (level >= 2 && have < 2) out.push({ item: 'paved', cell });
  }
  return out;
}

/** Totals of an order's remaining work: materials, band-months at the band's rate, hexes. */
export function orderSummary(state: GameState, u: Unit, b: BuildOrder): { steps: BuildStep[]; materials: Materials; money: number; months: number; bridges: number; hexes: number } {
  const steps = pendingSteps(state, b);
  const materials = emptyMaterials();
  let months = 0, bridges = 0, money = 0;
  const rate = workRate(u);
  const hexes = new Set<number>();
  for (const s of steps) {
    const pc = projectCost(state, s.item, s.cell);
    for (const k of MATERIAL_IDS) materials[k] += pc.materials[k] ?? 0;
    money += pc.money;
    months += pc.months / rate;
    if (s.item === 'bridge') bridges++;
    hexes.add(s.cell);
  }
  if (u.work && steps.length && u.work.paid) { // work already paid or begun is not charged twice
    const pc = projectCost(state, u.work.item, u.work.cell);
    for (const k of MATERIAL_IDS) materials[k] -= pc.materials[k] ?? 0;
    money -= pc.money;
    months -= (u.work.progress * pc.months) / rate;
  }
  return { steps, materials, money, months: Math.max(0, months), bridges, hexes: hexes.size };
}

/** What one piece of work costs on a hex: materials, money (castles) and band-months at the reference size. */
export function projectCost(state: GameState, item: string, cell: number): { materials: Materials; money: number; months: number } {
  const it = infraItem(item);
  if (it.kind === 'castle' && it.tier) {
    const c = castleBuildCost(state, it.tier, cell);
    return { materials: c.materials, money: c.money, months: c.months };
  }
  const materials = emptyMaterials();
  for (const k of MATERIAL_IDS) materials[k] = it.cost[k] ?? 0;
  return { materials, money: 0, months: it.months };
}

/** People → speed: 1 = a band of `work.refPeople`. */
export function workRate(u: Unit): number {
  const people = totalPopulation(u.pop);
  return Math.max(0.05, Math.min(INFRA.work.maxRate, people / INFRA.work.refPeople));
}

export interface BuildCheck { ok: boolean; reason?: string }

/** May a band of this unit build `item` on `cell` at all (terrain and kind)? */
export function canBuildOn(state: GameState, item: string, cell: number): BuildCheck {
  const map = state.map;
  if (cell < 0 || cell >= map.terrain.length) return { ok: false, reason: 'off the map' };
  if (SEA_LAKE.has(map.terrain[cell])) return { ok: false, reason: `cannot build on ${TERRAIN[map.terrain[cell]].name.toLowerCase()}` };
  const it = infraItem(item);
  if (it.kind === 'castle' && it.tier) {
    const c = canCastleAt(state, cell % map.width, Math.floor(cell / map.width), tierIndex(it.tier));
    if (!c.ok) return c;
    return castleAt(state, cell) ? { ok: false, reason: 'a castle already stands here' } : { ok: true };
  }
  if (item === 'bridge' && !isRiver(map, cell)) return { ok: false, reason: 'a bridge goes on a river hex' };
  if (item === 'bridge' && !needsBridge(state, cell)) return { ok: false, reason: inSettlement(state, cell) ? 'a settlement already bridges this hex' : 'this river hex needs no bridge' };
  return { ok: true };
}

/** The order "build `item` along the route to `dest`" (or on the band's own hex when `dest` is null), or the reason it cannot be given. */
export function makeBuildOrder(state: GameState, u: Unit, item: string, dest: number | null): { order?: BuildOrder; reason?: string } {
  const def = unitTypeDef(u.type);
  if (!def.canBuild) return { reason: `${def.name} cannot build` };
  const it = INFRA.items.find((x) => x.id === item);
  if (!it) return { reason: `unknown item ${item}` };
  const here = unitCell(state.map, u);
  let route: number[];
  if (it.kind === 'castle' && dest !== null && dest !== here) return { reason: 'a castle is built where the band stands' };
  if (item === 'bridge') {
    const cell = dest ?? here;
    const c = canBuildOn(state, 'bridge', cell);
    if (!c.ok) return { reason: c.reason };
    route = [cell];
  } else if (dest === null || dest === here) {
    const c = canBuildOn(state, item, here);
    if (!c.ok) return { reason: c.reason };
    route = [here];
  } else {
    const c = canBuildOn(state, item, dest);
    if (!c.ok) return { reason: c.reason };
    const planned = planRoadRoute(state, here, dest, it.level);
    if (!planned) return { reason: 'no way to lay a road there (water in the way)' };
    route = [here, ...planned];
  }
  const order: BuildOrder = { kind: 'build', item, route, i: 0 };
  if (item !== 'bridge' && pendingSteps(state, order).length === 0) return { reason: `the ${it.name.toLowerCase()} is already there` };
  if (item === 'paved') {
    // a paved road needs a dirt road under it: the order lays the dirt first where there is none (stepNeeded)
  }
  return { order };
}

/** Validation for the orderUnit command. */
export function checkBuildOrder(state: GameState, u: Unit, b: BuildOrder): BuildCheck {
  const def = unitTypeDef(u.type);
  if (!def.canBuild) return { ok: false, reason: `${def.name} cannot build` };
  if (!INFRA.items.some((x) => x.id === b.item)) return { ok: false, reason: `unknown item ${b.item}` };
  if (!b.route.length) return { ok: false, reason: 'nothing to build' };
  if (infraItem(b.item).kind === 'castle' && b.route.length !== 1) return { ok: false, reason: 'a castle is built on one hex' };
  for (const cell of b.route) {
    const c = b.item === 'bridge' || infraItem(b.item).kind === 'castle' ? canBuildOn(state, b.item, cell) : (SEA_LAKE.has(state.map.terrain[cell]) ? { ok: false, reason: 'water in the way' } : { ok: true });
    if (!c.ok) return c;
  }
  return { ok: true };
}

// ---- the monthly step ----

function bankStand(state: GameState, u: Unit, cell: number): number | null {
  const map = state.map;
  const here = unitCell(map, u);
  const hereA = offsetToAxial(here % map.width, Math.floor(here / map.width));
  let best: number | null = null, bestD = Infinity;
  for (const n of neighbourCells(map, cell)) {
    if (n === null) continue;
    if (SEA_LAKE.has(map.terrain[n]) || (isRiver(map, n) && needsBridge(state, n))) continue;
    const d = axialDistance(hereA, offsetToAxial(n % map.width, Math.floor(n / map.width)));
    if (d < bestD || (d === bestD && best !== null && n < best)) { best = n; bestD = d; }
  }
  return best;
}

/** The hex the band must stand on to do `step` (a bridge is built from the bank beside it). */
function standFor(state: GameState, u: Unit, b: BuildOrder, step: BuildStep): number | null {
  if (step.item !== 'bridge') return step.cell;
  const k = b.route.indexOf(step.cell);
  if (k > 0 && !needsBridge(state, b.route[k - 1])) return b.route[k - 1];
  const here = unitCell(state.map, u);
  const nb = neighbourCells(state.map, step.cell);
  if (nb.includes(here) && !needsBridge(state, here)) return here;
  return bankStand(state, u, step.cell);
}

function payProject(state: GameState, u: Unit, item: string, cell: number): { ok: true } | { ok: false; missing: string } {
  const pc = projectCost(state, item, cell);
  const cost = pc.materials;
  const owner = coveringSettlement(state, u.faction, cell);
  const f = state.factions[u.faction];
  const pool = owner ? clusterStock(state, owner.id) : emptyMaterials();
  const fromCluster: Partial<Materials> = {};
  const fromRealm = emptyMaterials();
  const lacking: string[] = [];
  for (const k of MATERIAL_IDS) {
    const want = cost[k] ?? 0;
    fromCluster[k] = Math.min(want, pool[k]);
    fromRealm[k] = Math.max(0, want - pool[k]);
    if (fromRealm[k] > (f ? f.stock[k] : 0) + 1e-9) lacking.push(`${Math.ceil(fromRealm[k] - (f ? f.stock[k] : 0))} ${k}`);
  }
  if (pc.money > 0 && f && f.treasury + 1e-9 < pc.money) lacking.push(`${Math.ceil(pc.money - f.treasury)} coins`);
  if (lacking.length) return { ok: false, missing: `waiting for ${lacking.join(', ')}` };
  if (owner) payFromCluster(state, owner, fromCluster);
  if (f) { for (const k of MATERIAL_IDS) f.stock[k] -= fromRealm[k]; if (pc.money > 0) { f.treasury -= pc.money; f.year.spent += pc.money; } }
  return { ok: true };
}

function complete(state: GameState, u: Unit, w: WorkProject): void {
  const it = infraItem(w.item);
  if (it.kind === 'castle' && it.tier) { completeCastle(state, u, it.tier, w.cell); return; }
  const infra = state.infra;
  if (w.item === 'bridge') { infra.bridges[w.cell] = true; infra.roads[w.cell] = Math.max(infra.roads[w.cell] ?? 0, 1); }
  else infra.roads[w.cell] = Math.max(infra.roads[w.cell] ?? 0, it.level);
}

/** A castle stands: a new castle (or a ruin raised again) on the hex, and a fort there is absorbed (DESIGN §3.5). */
function completeCastle(state: GameState, u: Unit, tierId: string, cell: number): void {
  const w = state.map.width;
  const col = cell % w, row = Math.floor(cell / w);
  const here = settlementIdAt(state, col, row);
  let s;
  if (here && isRuin(state.settlements[here])) {
    s = state.settlements[here];
    restoreRuin(state, s, tierId);
    s.faction = u.faction;
    logEvent(state, 'built', `${u.name} rebuilt ${s.name} as a ${TIERS[tierIndex(tierId)].name.toLowerCase()}.`);
  } else {
    s = makeSettlement(state, { name: castleName(state, col, row), tier: tierId, col, row, faction: u.faction, population: 0 });
    state.settlements[s.id] = s;
    logEvent(state, 'built', `${u.name} built ${s.name}, a ${TIERS[tierIndex(tierId)].name.toLowerCase()}.`);
  }
  const fort = fortAt(state, col, row);
  if (fort) delete state.forts[fort.id];
  resolveAllParents(state);
}

/** Take the order's next piece of work, moving `i` past hexes already done; null when the order is finished. */
function nextStep(state: GameState, b: BuildOrder): BuildStep | null {
  while (b.i < b.route.length) {
    const cell = b.route[b.i];
    const item = stepNeeded(state, b.item, cell);
    if (item) return { item, cell };
    b.i++;
  }
  return null;
}

/**
 * One month of a band's building: walk to the next job, pay its materials,
 * work for what is left of the month (finishing a hex moves on to the next in
 * the same month). Fills `r.built`, `r.trail`, `r.blocked`, `r.monthsLeft`.
 */
export function buildMonth(state: GameState, u: Unit, r: UnitReport): void {
  const b = u.build;
  if (!b) return;
  const map = state.map;
  const mp = unitTypeDef(u.type).movePoints;
  const rate = workRate(u);
  let time = 1, points = mp;
  let built = 0;
  const trail: number[] = [unitCell(map, u)];
  const eps = 1e-9;
  for (let guard = 0; guard < 200 && time > eps; guard++) {
    const step = nextStep(state, b);
    if (!step) {
      u.build = null; u.work = null;
      logEvent(state, 'built', `${u.name} finished its ${infraItem(b.item).name.toLowerCase()}${b.route.length > 1 ? ` (${b.route.length} hexes)` : ''}.`);
      break;
    }
    const stand = standFor(state, u, b, step);
    if (stand === null) { r.blocked = 'no bank to build from'; break; }
    const here = unitCell(map, u);
    if (here !== stand) {
      const route = findRoute(state, { cell: here, bank: u.bank }, stand, mp, u.faction);
      if (!route || !route.nodes.length || !Number.isFinite(route.months)) { r.blocked = 'no route to the work'; break; }
      const n = route.nodes[0];
      const cost = stepCostBetween(state, here, n.cell, mp) ?? mp;
      if (points + eps < cost && points < mp) break; // not enough movement left this month
      const whole = cost >= mp;
      points = whole ? 0 : Math.max(0, points - cost);
      time -= Math.min(time, cost / mp);
      u.col = n.cell % map.width; u.row = Math.floor(n.cell / map.width);
      u.bank = isRiver(map, n.cell) ? n.bank : OPEN;
      trail.push(n.cell);
      continue;
    }
    // at the work site
    if (!u.work || u.work.item !== step.item || u.work.cell !== step.cell) {
      // a castle on a fort saves a quarter of the time (DESIGN §3.5)
      const saved = infraItem(step.item).kind === 'castle' && fortAt(state, step.cell % map.width, Math.floor(step.cell / map.width)) ? CASTLES.fort.buildTimeSaved : 0;
      u.work = { item: step.item, cell: step.cell, progress: saved, paid: false };
    }
    const w = u.work;
    if (!w.paid) {
      const pay = payProject(state, u, w.item, w.cell);
      if (!pay.ok) { r.blocked = pay.missing; break; }
      w.paid = true;
    }
    const months = projectCost(state, w.item, w.cell).months;
    const need = ((1 - w.progress) * months) / rate;
    const use = Math.min(need, time);
    w.progress = Math.min(1, w.progress + (use * rate) / months);
    time -= use;
    if (w.progress >= 1 - 1e-9) {
      complete(state, u, w);
      u.work = null;
      built++;
      if (w.item === 'bridge') logEvent(state, 'built', `${u.name} built a bridge at (${w.cell % map.width}, ${Math.floor(w.cell / map.width)}).`);
    } else break;
  }
  if (u.build && !nextStep(state, u.build)) {
    logEvent(state, 'built', `${u.name} finished its ${infraItem(b.item).name.toLowerCase()}${b.route.length > 1 ? ` (${b.route.length} hexes)` : ''}.`);
    u.build = null; u.work = null;
  }
  r.built = built;
  r.trail = trail;
  const left = u.build ? pendingSteps(state, u.build) : [];
  r.monthsLeft = u.build ? left.reduce((t, s) => t + projectCost(state, s.item, s.cell).months, 0) / rate - (u.work ? (u.work.progress * projectCost(state, u.work.item, u.work.cell).months) / rate : 0) : 0;
  if (!u.build) r.monthsLeft = 0;
}
