// Pathfinding for units (DESIGN §3.2b rule 5, DECIDED 2026-11-07).
// A* over hexes with the terrain costs of data/terrain.json: plains / grassland /
// river 1, hills / woodland / tundra 2, forest / swamp 3; MOUNTAINS take the whole
// month (entering costs all the unit's points); lake and sea are impassable.
// RIVERS: a river hex is crossed only by a bridge — a settlement standing on it
// counts as one (roads and bridges come with Phase 2 session 2). Elsewhere a river
// hex is TWO nodes, (hex, bank): the banks are the two arcs of non-river
// neighbours between its two river neighbours. A unit on a bank may leave only
// onto that bank or along the river, where the bank is carried over through the
// shared neighbour. At a source, a mouth or a fork (not exactly two river
// neighbours) the banks cannot be told apart and the hex is open to all sides.
// No state is changed here; `src/sim/units.ts` walks the paths.

import type { GameState } from './state';
import type { MapData } from './map';
import { inBounds, idx } from './map';
import { TERRAIN, terrainIndex } from './terrain';
import { AXIAL_DIRECTIONS, axialDistance, axialToOffset, offsetToAxial } from './hex';
import { settlementIdAt } from './settlements';
import { hasBridge, stepCostBetween, takesWholeMonth, minStep, INFRA, roadLink } from './infrastructure';

const RIVER = terrainIndex('river');
const MOUNTAINS = terrainIndex('mountains');

/** A step of a route: the hex and the river bank the unit stands on (-1 = not on a river, or on an open river hex / bridge). */
export interface PathNode {
  cell: number;
  bank: number;
}

export interface Route {
  /** the hexes after the start, in walking order */
  nodes: PathNode[];
  /** sum of the step costs in movement points */
  cost: number;
  /** months the walk takes at the unit's points per month (see `walkMonths`) */
  months: number;
}

export const OPEN = -1;

export function cellOf(map: MapData, col: number, row: number): number {
  return idx(map, col, row);
}

/** The six neighbouring cells in direction order (null where off the map). */
export function neighbourCells(map: MapData, cell: number): (number | null)[] {
  const col = cell % map.width, row = Math.floor(cell / map.width);
  const a = offsetToAxial(col, row);
  return AXIAL_DIRECTIONS.map((d) => {
    const o = axialToOffset(a.q + d.q, a.r + d.r);
    return inBounds(map, o.col, o.row) ? idx(map, o.col, o.row) : null;
  });
}

export function isRiver(map: MapData, cell: number): boolean {
  return map.terrain[cell] === RIVER;
}

/** Does something bridge this river hex? A settlement standing on it (DECIDED 2026-11-07) or a built bridge (Session 16). */
export function isBridged(state: GameState, cell: number): boolean {
  const map = state.map;
  return hasBridge(state, cell) || settlementIdAt(state, cell % map.width, Math.floor(cell / map.width)) !== null;
}

const WATER = new Set([RIVER, terrainIndex('lake'), terrainIndex('sea')]);

/**
 * The two banks of a river hex: the land neighbours on each side, or null when
 * the hex is open — not a river, bridged, or its banks cannot be told apart.
 * The banks are the runs of land neighbours between the water (river, lake,
 * sea) and map-edge neighbours, taken around the hex: exactly two runs → two
 * banks (a river reach, a mouth into the sea, a reach beside a lake); one run
 * (a source) or three or more (a fork) → open to all sides (DESIGN §3.2b rule 5).
 */
export function riverBanks(state: GameState, cell: number): [number[], number[]] | null {
  const map = state.map;
  if (!isRiver(map, cell) || isBridged(state, cell)) return null;
  const nb = neighbourCells(map, cell);
  const land = nb.map((n) => n !== null && !WATER.has(map.terrain[n]));
  if (land.every((x) => x)) return null; // no water neighbour at all: a stray river hex, open
  // start the walk just after a separator so every run is read whole
  let start = 0;
  while (land[start]) start = (start + 1) % 6;
  const runs: number[][] = [];
  let cur: number[] | null = null;
  for (let k = 1; k <= 6; k++) {
    const d = (start + k) % 6;
    if (land[d]) { if (!cur) { cur = []; runs.push(cur); } cur.push(nb[d]!); }
    else cur = null;
  }
  if (runs.length !== 2) return null;
  return [runs[0], runs[1]];
}

/** Does crossing this river hex need a bridge — two distinct banks and nothing bridging it? (Open source / fork hexes need none.) */
export function needsBridge(state: GameState, cell: number): boolean {
  return isRiver(state.map, cell) && riverBanks(state, cell) !== null;
}

/** Which bank of river hex `cell` the land hex `from` lies on (0/1), or -1 if the hex is open or `from` is not beside it. */
export function bankFacing(state: GameState, cell: number, from: number): number {
  const banks = riverBanks(state, cell);
  if (!banks) return OPEN;
  if (banks[0].includes(from)) return 0;
  if (banks[1].includes(from)) return 1;
  return OPEN;
}

/** Movement points to enter `cell` for a unit with `movePoints` per month; null if impassable. */
export function stepCost(map: MapData, cell: number, movePoints: number): number | null {
  const ti = map.terrain[cell];
  if (ti === MOUNTAINS) return movePoints; // one hex a month (DECIDED 2026-11-07)
  const t = TERRAIN[ti];
  if (!t.passable) return null;
  return t.moveCost;
}

export function isMountain(map: MapData, cell: number): boolean {
  return map.terrain[cell] === MOUNTAINS;
}

/** The nodes a unit may step to from `node` and what each step costs. */
export function stepsFrom(state: GameState, node: PathNode, movePoints: number): { node: PathNode; cost: number }[] {
  const map = state.map;
  const out: { node: PathNode; cost: number }[] = [];
  const A = node.cell;
  const banksA = node.bank === OPEN ? null : riverBanks(state, A);
  const onBank = banksA ? banksA[node.bank] : null;
  const aIsRiver = isRiver(map, A);
  for (const N of neighbourCells(map, A)) {
    if (N === null) continue;
    const cost = stepCostBetween(state, A, N, movePoints);
    if (cost === null) continue;
    const nIsRiver = isRiver(map, N);
    if (onBank && !nIsRiver && !onBank.includes(N)) continue; // may leave only onto its own bank
    if (!nIsRiver) { out.push({ node: { cell: N, bank: OPEN }, cost }); continue; }
    const banksN = riverBanks(state, N);
    if (!banksN) { out.push({ node: { cell: N, bank: OPEN }, cost }); continue; }
    if (onBank) {
      // along the river: the bank is carried over through the neighbour shared by both hexes
      const shared = onBank.filter((c) => banksN[0].includes(c) || banksN[1].includes(c));
      const b = shared.length ? (banksN[0].includes(shared[0]) ? 0 : 1) : OPEN;
      if (b === OPEN) { out.push({ node: { cell: N, bank: 0 }, cost }); out.push({ node: { cell: N, bank: 1 }, cost }); }
      else out.push({ node: { cell: N, bank: b }, cost });
    } else if (aIsRiver) {
      // from an open river hex (source, mouth, fork, bridge) either bank can be reached
      out.push({ node: { cell: N, bank: 0 }, cost });
      out.push({ node: { cell: N, bank: 1 }, cost });
    } else {
      const b = banksN[0].includes(A) ? 0 : banksN[1].includes(A) ? 1 : OPEN;
      if (b === OPEN) { out.push({ node: { cell: N, bank: 0 }, cost }); out.push({ node: { cell: N, bank: 1 }, cost }); }
      else out.push({ node: { cell: N, bank: b }, cost });
    }
  }
  return out;
}

const key = (n: PathNode): number => n.cell * 3 + (n.bank + 1);

/** A small binary heap on (priority, id). */
class Heap {
  private p: number[] = [];
  private v: number[] = [];
  get size(): number { return this.v.length; }
  push(priority: number, value: number): void {
    this.p.push(priority); this.v.push(value);
    let i = this.v.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (this.p[j] <= this.p[i]) break;
      this.swap(i, j); i = j;
    }
  }
  pop(): number {
    const top = this.v[0];
    const lp = this.p.pop()!, lv = this.v.pop()!;
    if (this.v.length) {
      this.p[0] = lp; this.v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.v.length && this.p[l] < this.p[m]) m = l;
        if (r < this.v.length && this.p[r] < this.p[m]) m = r;
        if (m === i) break;
        this.swap(i, m); i = m;
      }
    }
    return top;
  }
  private swap(i: number, j: number): void {
    const tp = this.p[i]; this.p[i] = this.p[j]; this.p[j] = tp;
    const tv = this.v[i]; this.v[i] = this.v[j]; this.v[j] = tv;
  }
}

function axialOfCell(map: MapData, cell: number) {
  return offsetToAxial(cell % map.width, Math.floor(cell / map.width));
}

/**
 * The cheapest route from `start` to `dest` (any bank of it) for a unit with
 * `movePoints` a month, or null when none exists. Deterministic: ties break on
 * the node key.
 */
export function findRoute(state: GameState, start: PathNode, dest: number, movePoints: number): Route | null {
  const map = state.map;
  if (dest < 0 || dest >= map.terrain.length) return null;
  if (start.cell === dest) return { nodes: [], cost: 0, months: 0 };
  if (stepCost(map, dest, movePoints) === null) return null;
  const goal = axialOfCell(map, dest);
  const h = (cell: number) => axialDistance(axialOfCell(map, cell), goal) * minStep();
  const g = new Map<number, number>();
  const came = new Map<number, number>();
  const nodes = new Map<number, PathNode>();
  const open = new Heap();
  const sk = key(start);
  g.set(sk, 0); nodes.set(sk, start);
  open.push(h(start.cell), sk);
  const closed = new Set<number>();
  while (open.size) {
    const k = open.pop();
    if (closed.has(k)) continue;
    closed.add(k);
    const node = nodes.get(k)!;
    if (node.cell === dest) {
      const path: PathNode[] = [];
      let cur = k;
      while (cur !== sk) { path.push(nodes.get(cur)!); cur = came.get(cur)!; }
      path.reverse();
      const cost = g.get(k)!;
      return { nodes: path, cost, months: walkMonths(state, start.cell, path, movePoints) };
    }
    const gk = g.get(k)!;
    for (const { node: n, cost } of stepsFrom(state, node, movePoints)) {
      const nk = key(n);
      if (closed.has(nk)) continue;
      const ng = gk + cost;
      const old = g.get(nk);
      if (old !== undefined && old <= ng) continue;
      g.set(nk, ng); came.set(nk, k); nodes.set(nk, n);
      open.push(ng + h(n.cell) + nk * 1e-9, nk);
    }
  }
  return null;
}

/**
 * One month of walking: how many steps of `path` (starting from hex `start`) a
 * unit with `points` left can take. A step needs its full cost, except that a
 * unit which has not moved yet this month may always take one step; entering
 * mountains without a road spends every point. Returns the steps taken and the
 * points left.
 */
export function stepsThisMonth(state: GameState, start: number, path: PathNode[], movePoints: number, points = movePoints): { steps: number; left: number } {
  let left = points, steps = 0, prev = start;
  const eps = 1e-9;
  for (const n of path) {
    const cost = stepCostBetween(state, prev, n.cell, movePoints);
    if (cost === null) break;
    if (takesWholeMonth(state, prev, n.cell)) { if (left < 1) break; left = 0; steps++; break; }
    if (left + eps >= cost) left = Math.max(0, left - cost);
    else if (left === movePoints) left = 0;
    else break;
    steps++; prev = n.cell;
    if (left <= eps) break;
  }
  return { steps, left };
}

/** Months a unit needs to walk `path` from hex `start` from a fresh month. */
export function walkMonths(state: GameState, start: number, path: PathNode[], movePoints: number): number {
  let months = 0, i = 0, prev = start;
  while (i < path.length) {
    const { steps } = stepsThisMonth(state, prev, path.slice(i), movePoints);
    if (steps === 0) return Infinity;
    prev = path[i + steps - 1].cell;
    i += steps; months++;
  }
  return months;
}

// ---- planning a road (Session 16; DESIGN §3.2b rule 7: "road from X to Y" is one order) ----

const SEA_LAKE = new Set([terrainIndex('lake'), terrainIndex('sea')]);

/**
 * The hexes a work-band should lay a road over from `from` to `to`: A* over
 * cells, rivers crossable (each unbridged river hex costs `planning.bridgePenalty`
 * extra — it will get a bridge), mountains crossable, lake and sea not; a hex
 * that already carries a road of `level` or better costs `planning.reuse`.
 * Returns the cells after `from` in walking order, or null when no way exists.
 */
export function planRoadRoute(state: GameState, from: number, to: number, level: number): number[] | null {
  const map = state.map;
  if (from === to) return [];
  if (SEA_LAKE.has(map.terrain[to])) return null;
  const goal = axialOfCell(map, to);
  const g = new Map<number, number>([[from, 0]]);
  const came = new Map<number, number>();
  const open = new Heap();
  open.push(axialDistance(axialOfCell(map, from), goal) * 0.4, from);
  const closed = new Set<number>();
  while (open.size) {
    const c = open.pop();
    if (closed.has(c)) continue;
    closed.add(c);
    if (c === to) {
      const out: number[] = [];
      let cur = c;
      while (cur !== from) { out.push(cur); cur = came.get(cur)!; }
      return out.reverse();
    }
    const gc = g.get(c)!;
    for (const n of neighbourCells(map, c)) {
      if (n === null || closed.has(n) || SEA_LAKE.has(map.terrain[n])) continue;
      const have = state.infra?.roads[n] ?? 0;
      let step: number;
      if (have >= level && roadLink(state, c, n) > 0) step = INFRA.planning.reuse;
      else {
        step = TERRAIN[map.terrain[n]].moveCost;
        if (roadLink(state, c, n) > 0) step *= 0.5;
        if (needsBridge(state, n)) step += INFRA.planning.bridgePenalty;
      }
      const ng = gc + step;
      const old = g.get(n);
      if (old !== undefined && old <= ng) continue;
      g.set(n, ng); came.set(n, c);
      open.push(ng + axialDistance(axialOfCell(map, n), goal) * INFRA.planning.reuse + n * 1e-9, n);
    }
  }
  return null;
}
