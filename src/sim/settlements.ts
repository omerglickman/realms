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
import { type Materials, emptyMaterials } from './materials';
import { hexJobs } from './hexjobs';

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
  /** Session 18 (DESIGN §3.5): a castle — a settlement of its own kind on the ladder, with no residents */
  castle?: boolean;
  /** castles: how many hexes it works (its own first, then the best free neighbours in ring 1) */
  workHexes?: number;
}

/** What a castle is doing (Session 18, DESIGN §3.5; rules in src/sim/castles.ts). */
export interface CastleState {
  /** no staff for `ruin.afterMonths` months: no influence, no capacity; rebuildable at half cost */
  ruin: boolean;
  /** consecutive months nobody was in its service */
  unstaffedMonths: number;
  /** last month: hands got / hands needed (0–1) — scales its hexes and its garrison capacity */
  staffing: number;
  gotHands: number;
  needHands: number;
  /** last month: wages and upkeep paid from the treasury */
  wages: number;
  upkeep: number;
  /** people it can garrison at this staffing (the garrison itself comes with military units) */
  garrisonCapacity: number;
}

export function newCastleState(): CastleState {
  return { ruin: false, unstaffedMonths: 0, staffing: 0, gotHands: 0, needHands: 0, wages: 0, upkeep: 0, garrisonCapacity: 0 };
}

export interface BuildingDef {
  id: string;
  /** icon id in src/ui/icons.ts (Session 13b) */
  icon?: string;
  name: string;
  family: string;
  /** mandatory buildings: the one tier they belong to */
  tier?: string;
  /** buildable buildings: the lowest tier that may build it */
  minTier?: string;
  hands: number;
  mandatory: boolean;
  /** paid when queued (Session 11): timber/stone from the cluster stockpile, money from the faction treasury (Session 11b) */
  cost?: Partial<Materials> & { money?: number };
  /** months of construction at full labour */
  buildMonths?: number;
  /** spare hands needed for full construction speed */
  buildHands?: number;
  /** a hex the settlement must work: river / shore / pasture */
  requires?: 'river' | 'shore' | 'pasture';
  effects: Record<string, number>;
  /** unit types this building will unlock (Phase 4; recorded only) */
  unlocks?: string[];
  /** Warehouse family (Session 11b): what it adds to the cluster's stockpile cap */
  stockCap?: Partial<Materials>;
  blurb?: string;
}

export const TIERS: readonly TierDef[] = settlementData.tiers as TierDef[];
export const BUILDINGS: readonly BuildingDef[] = buildingData.buildings as unknown as BuildingDef[];
export const BUILDING_INDEX: Readonly<Record<string, BuildingDef>> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

/** A building under construction (Session 11): progress 0–1 advances by (spare hands given / buildHands) / buildMonths each month. */
export interface BuildProject {
  building: string;
  progress: number;
  /** who paid what when the project was queued (for cancel / undo) */
  paid: { id: string; amount: Materials }[];
  /** money paid from the faction treasury when queued (Session 11b; refunded on cancel) */
  paidMoney?: number;
  startedTurn: number;
}

/** A tier upgrade step (DESIGN §3.2b rule 10; data/settlements.json `upgrades`). */
export interface UpgradeDef {
  from: string;
  to: string;
  money: number;
  timber: number;
  stone: number;
  months: number;
  /** the step's prerequisites are not designed yet (city → metropolis) */
  placeholder?: boolean;
  /** castles (Session 18): spare hands in reach that give the step full speed */
  hands?: number;
}
export const UPGRADES: readonly UpgradeDef[] = ((settlementData as unknown as { upgrades?: { steps: UpgradeDef[] } }).upgrades?.steps) ?? [];

/** A running tier upgrade: the hall grows over the step's months. */
export interface UpgradeProject {
  /** tier index being upgraded to */
  to: number;
  progress: number;
  paid: { id: string; amount: Materials }[];
  paidMoney: number;
  startedTurn: number;
}

/** Is this tier a castle? */
export function isCastleTier(tier: number): boolean {
  return !!TIERS[tier]?.castle;
}
/** Is this settlement a castle (ruins included)? */
export function isCastle(s: { tier: number }): boolean {
  return !!TIERS[s.tier]?.castle;
}
/** A castle in ruins (no influence, no work, no say in the ladder). */
export function isRuin(s: Settlement): boolean {
  return !!s.castle?.ruin;
}

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
  /** tithe (DESIGN §4.2) taken from this settlement's production / received from subordinates this month */
  titheOut: number;
  titheIn: number;
  migrantsOut: number;
  migrantsIn: number;
  capacity: number;
  /** Session 11: spare hands on construction / gathering this month; hands the settlement could use but lacks */
  constructionHands: number;
  gatherHands: number;
  vacancies: number;
  /** materials gathered / goods made / goods sold (money) this month */
  timber: number;
  stone: number;
  goods: number;
  sold: number;
  /** Session 11b (DESIGN §4.2b): private hands (towns and above; 0 in a village), the tax they paid this month,
   *  the tax forgone because some were on the building site or gathering, and administration quality (0–1) */
  privateHands: number;
  tax: number;
  taxLost: number;
  adminQuality: number;
  /** materials that overflowed the cluster's cap to the realm this month (counted on the cluster root) */
  overflow: number;
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

/** Running food/people totals over a calendar year (reset each December; the finished year is kept in `lastYear`). */
export interface YearTotals {
  produced: number;
  consumed: number;
  hungerDeaths: number;
  sent: number;
  received: number;
  titheOut: number;
  titheIn: number;
  migrantsOut: number;
  migrantsIn: number;
  /** Session 11: materials gathered, goods made, money from sales, materials sent to the faction in December */
  timber: number;
  stone: number;
  goods: number;
  sold: number;
  /** materials that overflowed the cluster's cap to the realm stockpile (Session 11b; before that the December surplus share) — counted on the cluster root */
  surplusOut: number;
  /** Session 11b: tax paid by private hands, and tax forgone while they built or gathered */
  tax: number;
  taxLost: number;
  /** months accumulated so far (12 for a finished year) */
  months: number;
}

export function emptyYearTotals(): YearTotals {
  return { produced: 0, consumed: 0, hungerDeaths: 0, sent: 0, received: 0, titheOut: 0, titheIn: 0, migrantsOut: 0, migrantsIn: 0, timber: 0, stone: 0, goods: 0, sold: 0, surplusOut: 0, tax: 0, taxLost: 0, months: 0 };
}

export function addYearTotals(into: YearTotals, from: YearTotals): void {
  into.produced += from.produced; into.consumed += from.consumed; into.hungerDeaths += from.hungerDeaths;
  into.sent += from.sent; into.received += from.received; into.titheOut += from.titheOut; into.titheIn += from.titheIn;
  into.migrantsOut += from.migrantsOut; into.migrantsIn += from.migrantsIn;
  into.timber += from.timber; into.stone += from.stone; into.goods += from.goods; into.sold += from.sold; into.surplusOut += from.surplusOut;
  into.tax += from.tax; into.taxLost += from.taxLost;
  into.months = Math.max(into.months, from.months);
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
  /** this settlement's own materials (the cluster pools them — src/sim/materials.ts) */
  stock: Materials;
  /** the building under construction, if any (one project at a time) */
  build: BuildProject | null;
  /** a running tier upgrade (Session 15b), or null */
  upgrade: UpgradeProject | null;
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
  /** this calendar year's running totals (Session 10, for the cluster panel and the yearly report) */
  year: YearTotals;
  /** the last finished calendar year's totals; null until a December has passed */
  lastYear: YearTotals | null;
  /** castles only (Session 18) */
  castle?: CastleState;
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
    shortfall: 0, hungerDeaths: 0, spoiled: 0, sent: 0, received: 0, titheOut: 0, titheIn: 0, migrantsOut: 0, migrantsIn: 0,
    capacity: 0, constructionHands: 0, gatherHands: 0, vacancies: 0, timber: 0, stone: 0, goods: 0, sold: 0,
    privateHands: 0, tax: 0, taxLost: 0, adminQuality: 1, overflow: 0,
    births: 0, deaths: 0, trickleOut: 0, trickleIn: 0, epidemic: false, sufficiency: 1,
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
  /** exact cohorts instead of the stationary distribution (settlers founding a village, Session 14) */
  pop?: Population;
  /** exact granary in food units (settlers' remaining provisions); overrides foodMonths */
  food?: number;
}

/** Terrain a settlement centre may stand on: passable land (DESIGN §3.3; water and mountains excluded). */
export function canSettleAt(state: GameState, col: number, row: number, tier?: number): { ok: boolean; reason?: string } {
  if (!inBounds(state.map, col, row)) return { ok: false, reason: 'off the map' };
  const t = TERRAIN[state.map.terrain[idx(state.map, col, row)]];
  if (tier !== undefined && isCastleTier(tier)) return canCastleAt(state, col, row, tier);
  if (!t.passable) return { ok: false, reason: `cannot settle on ${t.name.toLowerCase()}` };
  if (settlementIdAt(state, col, row)) return { ok: false, reason: 'a settlement already stands here' };
  return { ok: true };
}

/**
 * Where a castle may stand (DESIGN §3.5): any land hex — hills and mountains
 * included, no minimum distance — not occupied by a settlement and not inside
 * the work zone of a higher tier. (A ruin's own hex is free to rebuild on.)
 */
export function canCastleAt(state: GameState, col: number, row: number, tier: number): { ok: boolean; reason?: string } {
  const map = state.map;
  if (!inBounds(map, col, row)) return { ok: false, reason: 'off the map' };
  const t = TERRAIN[map.terrain[idx(map, col, row)]];
  if (t.id === 'sea' || t.id === 'lake') return { ok: false, reason: `cannot build on ${t.name.toLowerCase()}` };
  const here = settlementIdAt(state, col, row);
  if (here && !isRuin(state.settlements[here])) return { ok: false, reason: 'a settlement already stands here' };
  const rank = TIERS[tier].rank;
  const cell = idx(map, col, row);
  for (const o of Object.values(state.settlements)) {
    if (isCastle(o) || isRuin(o) || TIERS[o.tier].rank <= rank) continue;
    if (workRangeCells(map, o).includes(cell)) return { ok: false, reason: `inside the work zone of ${o.name}, a ${TIERS[o.tier].name.toLowerCase()}` };
  }
  return { ok: true };
}

/** Create a settlement object (does not add it to the state — see commands.ts foundSettlement). */
export function makeSettlement(state: GameState, o: FoundOptions): Settlement {
  const tier = typeof o.tier === 'string' ? tierIndex(o.tier) : o.tier;
  const def = TIERS[tier];
  if (!def) throw new Error(`Bad tier ${o.tier}`);
  if (!inBounds(state.map, o.col, o.row)) throw new Error(`Settlement at ${o.col},${o.row} is off the map`);
  const id = o.id ?? `s${state.nextId++}`;
  const castle = !!def.castle;
  return {
    id,
    name: o.name,
    tier,
    col: o.col,
    row: o.row,
    faction: o.faction === undefined ? state.playerFaction : o.faction,
    pop: castle ? createPopulation(0) : o.pop ? { m: o.pop.m.slice(), f: o.pop.f.slice() } : createPopulation(o.population),
    food: castle ? (o.food ?? 0) : o.food !== undefined ? o.food : o.population * (o.foodMonths ?? 12),
    buildings: castle ? [] : [def.hall, def.granary],
    stock: emptyMaterials(),
    build: null,
    upgrade: null,
    parentOverride: null,
    parent: null,
    yearMonths: 0,
    yearSufficiency: 0,
    report: emptyReport(),
    popHistory: [],
    foundedTurn: state.turn,
    harvestFactor: 1,
    year: emptyYearTotals(),
    lastYear: null,
    ...(castle ? { castle: newCastleState() } : {}),
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
  if (isRuin(s)) return [];
  return zoneCells(map, s, TIERS[s.tier].influenceRings);
}

export function workRangeCells(map: MapData, s: Settlement): number[] {
  if (isRuin(s)) return [];
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
    if (isCastle(s)) continue; // castles choose below, once everyone else has claimed theirs
    const rank = TIERS[s.tier].rank;
    const c = settlementAxial(s);
    for (const i of workRangeCells(map, s)) {
      const col = i % map.width, row = Math.floor(i / map.width);
      const dist = axialDistance(c, offsetToAxial(col, row));
      const cur = best.get(i);
      if (!cur || rank > cur.rank || (rank === cur.rank && dist < cur.dist)) best.set(i, { id: s.id, rank, dist });
    }
  }
  // Castles (DESIGN §3.5, Omer's answer 2026-11-08): the castle's own hex first, then the best-yielding
  // hexes of ring 1 that no settlement of higher or equal rank holds, up to its `workHexes`; the highest
  // castles choose first, and a castle takes a hex from a lower rank (contested hexes go by rank).
  const castles = list.filter((s) => isCastle(s) && !isRuin(s) && (TIERS[s.tier].workHexes ?? 0) > 0)
    .sort((a, b) => TIERS[b.tier].rank - TIERS[a.tier].rank || (a.id < b.id ? -1 : 1));
  for (const s of castles) {
    const rank = TIERS[s.tier].rank;
    const want = TIERS[s.tier].workHexes ?? 0;
    const c = settlementAxial(s);
    const own = idx(map, s.col, s.row);
    const free = (i: number) => { const cur = best.get(i); return !cur || cur.rank < rank; };
    const chosen: number[] = [];
    if (free(own)) chosen.push(own);
    const ring = workRangeCells(map, s).filter((i) => i !== own && free(i))
      .map((i) => {
        const jobs = hexJobs(map, i);
        const score = jobs.reduce((m, j) => Math.max(m, j.fedPerYear), 0);
        return { i, score, dist: axialDistance(c, offsetToAxial(i % map.width, Math.floor(i / map.width))) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.dist - b.dist || a.i - b.i);
    for (const x of ring) { if (chosen.length >= want) break; chosen.push(x.i); }
    for (const i of chosen) best.set(i, { id: s.id, rank, dist: axialDistance(c, offsetToAxial(i % map.width, Math.floor(i / map.width))) });
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
 * tier first, then nearest. An explicit parentOverride wins if still valid; an
 * override may name a settlement of the SAME tier (Omer, 2026-11-07): a village
 * that grows into a town stays under its old parent, and the player may choose
 * which of a cluster's top-tier settlements leads. Equal tiers are never joined
 * automatically — only by an override.
 */
export function resolveParent(state: GameState, s: Settlement): string | null {
  if (isRuin(s)) return null;
  const myRank = TIERS[s.tier].rank;
  const c = settlementAxial(s);
  const candidates: { id: string; rank: number; dist: number; castle: boolean }[] = [];
  for (const o of Object.values(state.settlements)) {
    if (o.id === s.id || o.faction !== s.faction || isRuin(o)) continue;
    const rank = TIERS[o.tier].rank;
    if (rank < myRank) continue;
    const dist = axialDistance(c, settlementAxial(o));
    if (dist > TIERS[o.tier].influenceRings) continue;
    if (rank === myRank) { if (o.id === s.parentOverride) return o.id; continue; }
    candidates.push({ id: o.id, rank, dist, castle: isCastle(o) });
  }
  if (s.parentOverride && candidates.some((c) => c.id === s.parentOverride)) return s.parentOverride;
  if (candidates.length === 0) return null;
  // DESIGN §3.5 reading (Session 18, PLACEHOLDER — flagged to Omer): a castle adopts what no town or city above it
  // already claims, so building one never cuts a village off from its town; a castle itself takes the ladder as it is.
  const plain = candidates.filter((x) => !x.castle);
  const pool = !isCastle(s) && plain.length > 0 ? plain : candidates;
  pool.sort((a, b) => b.rank - a.rank || a.dist - b.dist || (a.id < b.id ? -1 : 1));
  return pool[0].id;
}

/**
 * Where a settlement's food, tithe, migrants and refugees go (DESIGN §3.5): its
 * nearest ancestor that is not a castle — a castle takes no tithe and has no
 * people to receive. null when the chain ends in a castle or nothing.
 */
export function foodParentOf(state: GameState, s: Settlement): Settlement | null {
  const seen = new Set<string>([s.id]);
  let p = s.parent ? state.settlements[s.parent] : undefined;
  while (p && !seen.has(p.id)) {
    if (!isCastle(p)) return p;
    seen.add(p.id);
    p = p.parent ? state.settlements[p.parent] : undefined;
  }
  return null;
}

/** Can `parentId` be `s`'s parent by override (same faction, rank not lower, influence covers the centre)? */
export function canOverrideParent(state: GameState, s: Settlement, parentId: string): boolean {
  const o = state.settlements[parentId];
  if (!o || o.id === s.id || o.faction !== s.faction || isRuin(o)) return false;
  if (TIERS[o.tier].rank < TIERS[s.tier].rank) return false;
  return axialDistance(settlementAxial(s), settlementAxial(o)) <= TIERS[o.tier].influenceRings;
}

export function resolveAllParents(state: GameState): void {
  const all = Object.values(state.settlements).sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const s of all) s.parent = resolveParent(state, s);
  // equal-tier overrides can form a ring (A under B under A): break it at the lowest id, which becomes the root
  for (const s of all) {
    const seen = new Set<string>([s.id]);
    let p = s.parent;
    while (p && !seen.has(p)) { seen.add(p); p = state.settlements[p]?.parent ?? null; }
    if (p === s.id) { s.parentOverride = null; s.parent = resolveParent(state, s); }
  }
}

/** Settlements ordered by tier rank ascending (villages first), then id — the order the economy processes them. */
export function settlementsByRank(state: GameState): Settlement[] {
  return Object.values(state.settlements).sort(
    (a, b) => TIERS[a.tier].rank - TIERS[b.tier].rank || (a.id < b.id ? -1 : 1),
  );
}
