// Settlements (DESIGN §3.3): tiers, zones, contested hexes, subordination.
// Plain data in GameState.settlements keyed by id. Tier numbers come from
// data/settlements.json (index-stable), buildings from data/buildings.json.

import settlementData from '../../data/settlements.json';
import buildingData from '../../data/buildings.json';
import type { GameState } from './state';
import type { MapData } from './map';
import { inBounds, idx } from './map';
import { TERRAIN } from './terrain';
import { axialRange, axialDistance, offsetToAxial, axialToOffset, type Axial } from './hex';
import { createPopulation, type Population } from './demography';

export interface TierDef {
  id: string;
  name: string;
  rank: number;
  workRings: number;
  influenceRings: number;
  popMin: number;
  popMax: number | null;
  hall: string;
  granary: string;
}

export interface BuildingDef {
  id: string;
  name: string;
  family: string;
  tier: string;
  hands: number;
  mandatory: boolean;
  effects: Record<string, number>;
}

export const TIERS: readonly TierDef[] = settlementData.tiers as TierDef[];
export const BUILDINGS: readonly BuildingDef[] = buildingData.buildings as unknown as BuildingDef[];
export const BUILDING_INDEX: Readonly<Record<string, BuildingDef>> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

export function tierIndex(id: string): number {
  const i = TIERS.findIndex((t) => t.id === id);
  if (i < 0) throw new Error(`Unknown settlement tier "${id}"`);
  return i;
}

export function buildingDef(id: string): BuildingDef {
  const b = BUILDING_INDEX[id];
  if (!b) throw new Error(`Unknown building "${id}"`);
  return b;
}

/** Last month's economy figures, kept for panels and the headless runner. */
export interface SettlementReport {
  hands: number;
  staffedHands: number;
  fieldHands: number;
  idleHands: number;
  /** food produced this month (after harvest timing) */
  produced: number;
  /** yearly food capacity of the worked hexes at full labour (people fed) */
  landCapacity: number;
  consumed: number;
  shortfall: number;
  hungerDeaths: number;
  spoiled: number;
  sent: number;
  received: number;
  migrantsOut: number;
  migrantsIn: number;
  capacity: number;
  /** last yearly update */
  births: number;
  deaths: number;
  /** last December: people who left / arrived by the yearly migration trickle (PROPOSED, Session 9) */
  trickleOut: number;
  trickleIn: number;
  /** last yearly update was an epidemic year */
  epidemic: boolean;
  /** the year's average food sufficiency at the last December (0–1) */
  sufficiency: number;
}

export interface Settlement {
  id: string;
  name: string;
  /** index into TIERS */
  tier: number;
  col: number;
  row: number;
  faction: string | null;
  pop: Population;
  /** food in the granary (1 food = one person for one month) */
  food: number;
  /** building ids present */
  buildings: string[];
  /** explicit parent chosen by the player; null = automatic (DESIGN §3.3) */
  parentOverride: string | null;
  /** resolved parent for this turn (automatic or override); null = none */
  parent: string | null;
  /** running sums for the yearly update: months counted and sufficiency total */
  yearMonths: number;
  yearSufficiency: number;
  report: SettlementReport;
  /** total population at the end of each December since founding (newest last; capped) — for growth trends */
  popHistory: number[];
  /** the turn the settlement was founded (or placed in the editor) */
  foundedTurn: number;
  /** this year's farming multiplier, drawn in January (PROPOSED harvest variance, Session 9); 1 = average year */
  harvestFactor: number;
}

/** Population below which a settlement is abandoned (DECIDED 2026-11-05; data/settlements.json). Read live so tests can switch it off. */
export function abandonBelow(): number {
  return (settlementData as { abandonment?: { abandonBelow: number } }).abandonment?.abandonBelow ?? 0;
}
export function setAbandonBelow(n: number): void {
  const d = settlementData as { abandonment?: { abandonBelow: number } };
  d.abandonment = { ...(d.abandonment ?? { abandonBelow: 0 }), abandonBelow: n };
}

/** How many year-end totals a settlement remembers. */
export const POP_HISTORY_YEARS = 30;

export function emptyReport(): SettlementReport {
  return {
    hands: 0, staffedHands: 0, fieldHands: 0, idleHands: 0, produced: 0, landCapacity: 0, consumed: 0,
    shortfall: 0, hungerDeaths: 0, spoiled: 0, sent: 0, received: 0, migrantsOut: 0, migrantsIn: 0,
    capacity: 0, births: 0, deaths: 0, trickleOut: 0, trickleIn: 0, epidemic: false, sufficiency: 1,
  };
}

export interface FoundOptions {
  id?: string;
  name: string;
  tier: number | string;
  col: number;
  row: number;
  faction?: string | null;
  population: number;
  /** starting granary in months of consumption (default 12 — enough to reach the first harvest from January) */
  foodMonths?: number;
}

/** Terrain a settlement centre may stand on: passable land (DESIGN §3.3; water and mountains excluded). */
export function canSettleAt(state: GameState, col: number, row: number): { ok: boolean; reason?: string } {
  if (!inBounds(state.map, col, row)) return { ok: false, reason: 'off the map' };
  const t = TERRAIN[state.map.terrain[idx(state.map, col, row)]];
  if (!t.passable) return { ok: false, reason: `cannot settle on ${t.name.toLowerCase()}` };
  if (settlementIdAt(state, col, row)) return { ok: false, reason: 'a settlement already stands here' };
  return { ok: true };
}

/** Create a settlement object (does not add it to the state — see commands.ts foundSettlement). */
export function makeSettlement(state: GameState, o: FoundOptions): Settlement {
  const tier = typeof o.tier === 'string' ? tierIndex(o.tier) : o.tier;
  const def = TIERS[tier];
  if (!def) throw new Error(`Bad tier ${o.tier}`);
  if (!inBounds(state.map, o.col, o.row)) throw new Error(`Settlement at ${o.col},${o.row} is off the map`);
  const id = o.id ?? `s${state.nextId++}`;
  return {
    id,
    name: o.name,
    tier,
    col: o.col,
    row: o.row,
    faction: o.faction === undefined ? state.playerFaction : o.faction,
    pop: createPopulation(o.population),
    food: o.population * (o.foodMonths ?? 12),
    buildings: [def.hall, def.granary],
    parentOverride: null,
    parent: null,
    yearMonths: 0,
    yearSufficiency: 0,
    report: emptyReport(),
    popHistory: [],
    foundedTurn: state.turn,
    harvestFactor: 1,
  };
}

/**
 * Yearly growth trend as a fraction (+0.016 = +1.6 %/year): the last two
 * year-end totals compared. null until two Decembers have passed.
 */
export function growthTrend(s: Settlement): number | null {
  const h = s.popHistory;
  if (h.length < 2) return null;
  const prev = h[h.length - 2], last = h[h.length - 1];
  return prev > 0 ? last / prev - 1 : null;
}

/** Settlements whose resolved parent is `id`. */
export function childrenOf(state: GameState, id: string): Settlement[] {
  return Object.values(state.settlements).filter((s) => s.parent === id);
}

export function settlementAxial(s: Settlement): Axial {
  return offsetToAxial(s.col, s.row);
}

/** Flat indices of the hexes within `rings` of the settlement centre that are on the map. */
export function zoneCells(map: MapData, s: Settlement, rings: number): number[] {
  const out: number[] = [];
  for (const h of axialRange(settlementAxial(s), rings)) {
    const o = axialToOffset(h.q, h.r);
    if (inBounds(map, o.col, o.row)) out.push(idx(map, o.col, o.row));
  }
  return out;
}

export function influenceCells(map: MapData, s: Settlement): number[] {
  return zoneCells(map, s, TIERS[s.tier].influenceRings);
}

export function workRangeCells(map: MapData, s: Settlement): number[] {
  return zoneCells(map, s, TIERS[s.tier].workRings);
}

export function settlementIdAt(state: GameState, col: number, row: number): string | null {
  for (const s of Object.values(state.settlements)) if (s.col === col && s.row === row) return s.id;
  return null;
}

/**
 * Contested hexes (DESIGN §3.3): each hex in anyone's work range is worked by
 * exactly one settlement — the highest tier, then the nearest centre, then the
 * lowest id (so the result is deterministic). Returns hex index → settlement id.
 */
export function computeWorkAssignment(state: GameState): Map<number, string> {
  const map = state.map;
  const best = new Map<number, { id: string; rank: number; dist: number }>();
  const list = Object.values(state.settlements).sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const s of list) {
    const rank = TIERS[s.tier].rank;
    const c = settlementAxial(s);
    for (const i of workRangeCells(map, s)) {
      const col = i % map.width, row = Math.floor(i / map.width);
      const dist = axialDistance(c, offsetToAxial(col, row));
      const cur = best.get(i);
      if (!cur || rank > cur.rank || (rank === cur.rank && dist < cur.dist)) best.set(i, { id: s.id, rank, dist });
    }
  }
  const out = new Map<number, string>();
  for (const [i, b] of best) out.set(i, b.id);
  return out;
}

/** Hexes actually worked by each settlement after the contested-hex rule. */
export function workedCellsBySettlement(state: GameState): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const id of Object.keys(state.settlements)) out.set(id, []);
  for (const [i, id] of computeWorkAssignment(state)) out.get(id)!.push(i);
  return out;
}

/**
 * Subordination (DESIGN §3.3): the parent is the higher-tier settlement of the
 * same faction whose influence zone covers this settlement's centre — highest
 * tier first, then nearest. An explicit parentOverride wins if still valid.
 */
export function resolveParent(state: GameState, s: Settlement): string | null {
  const myRank = TIERS[s.tier].rank;
  const c = settlementAxial(s);
  const candidates: { id: string; rank: number; dist: number }[] = [];
  for (const o of Object.values(state.settlements)) {
    if (o.id === s.id || o.faction !== s.faction) continue;
    const rank = TIERS[o.tier].rank;
    if (rank <= myRank) continue;
    const dist = axialDistance(c, settlementAxial(o));
    if (dist <= TIERS[o.tier].influenceRings) candidates.push({ id: o.id, rank, dist });
  }
  if (s.parentOverride && candidates.some((c) => c.id === s.parentOverride)) return s.parentOverride;
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.rank - a.rank || a.dist - b.dist || (a.id < b.id ? -1 : 1));
  return candidates[0].id;
}

export function resolveAllParents(state: GameState): void {
  for (const s of Object.values(state.settlements)) s.parent = resolveParent(state, s);
}

/** Settlements ordered by tier rank ascending (villages first), then id — the order the economy processes them. */
export function settlementsByRank(state: GameState): Settlement[] {
  return Object.values(state.settlements).sort(
    (a, b) => TIERS[a.tier].rank - TIERS[b.tier].rank || (a.id < b.id ? -1 : 1),
  );
}
