// Castles and forts (DESIGN §3.5, DECIDED by Omer 2026-11-08; numbers draft in
// data/castles.json). A castle is a settlement of its own kind on the tier
// ladder (data/settlements.json tiers 4–6) with NO residents: the people who run
// it live in the settlements within its influence rings and count as castle
// service in their home's labour plan. This file holds the rules that need no
// economy: the data, who is in reach, what a castle needs, how the service is
// shared out, what building one costs, upgrading and forts. The monthly step
// (production, wages, the reserve, ruin) is `castleMonth` in economy.ts.
// Rules here, numbers in data/castles.json, no DOM.

import castleData from '../../data/castles.json';
import type { GameState } from './state';
import { type Settlement, TIERS, isCastle, isRuin, settlementAxial, settlementIdAt, tierIndex } from './settlements';
import { workingHands } from './demography';
import { buildingDef } from './settlements';
import { hexJobs, type Job } from './hexjobs';
import { axialDistance, offsetToAxial } from './hex';
import { MATERIAL_IDS, type Materials, emptyMaterials } from './materials';

export interface CastleKind {
  staffHands: number;
  capacity: number;
  upkeepPerYear: number;
  build: { months: number; money: number; timber: number; stone: number };
}
interface CastleData {
  service: { maxShareOfHands: number; wagePerHandPerMonth: number };
  reserve: { months: number };
  ruin: { afterMonths: number; rebuildCostShare: number };
  kinds: Record<string, CastleKind>;
  fort: { capacity: number; influenceRings: number; fortifyTimber: number; decayMonths: number; buildTimeSaved: number };
}
export const CASTLES = castleData as unknown as CastleData;

/** The numbers of a castle tier (by tier id). */
export function castleKind(tierId: string): CastleKind {
  const k = CASTLES.kinds[tierId];
  if (!k) throw new Error(`No castle kind "${tierId}"`);
  return k;
}
export function castleKindOf(s: Settlement): CastleKind {
  return castleKind(TIERS[s.tier].id);
}

/** Castle tier ids in order small → large. */
export const CASTLE_TIER_IDS: readonly string[] = TIERS.filter((t) => t.castle).sort((a, b) => a.rank - b.rank).map((t) => t.id);

/** The castles of the state that are standing (not ruins). */
export function activeCastles(state: GameState): Settlement[] {
  return Object.values(state.settlements).filter((s) => isCastle(s) && !isRuin(s)).sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** The settlements that serve a castle: own, not castles, within its influence rings. */
export function reachOf(state: GameState, c: Settlement): Settlement[] {
  const rings = TIERS[c.tier].influenceRings;
  const at = settlementAxial(c);
  return Object.values(state.settlements)
    .filter((s) => s.faction === c.faction && !isCastle(s) && axialDistance(at, settlementAxial(s)) <= rings)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** The best food job of each hex a castle works (one per hex — PLACEHOLDER reading of "75 + 90 for its hex"). */
export function castleJobs(map: GameState['map'], cells: number[]): Job[] {
  const jobs: Job[] = [];
  for (const c of cells) {
    const best = hexJobs(map, c).sort((a, b) => b.fedPerYear - a.fedPerYear || a.cell - b.cell)[0];
    if (best) jobs.push(best);
  }
  return jobs;
}

/** What a castle needs: its own staff plus the hands of the best job on each hex it works. */
export function castleNeed(state: GameState, c: Settlement, cells: number[]): { staff: number; hexHands: number; total: number; jobs: Job[] } {
  const jobs = castleJobs(state.map, cells);
  const hexHands = jobs.reduce((t, j) => t + j.hands, 0);
  const staff = castleKindOf(c).staffHands;
  return { staff, hexHands, total: staff + hexHands, jobs };
}

/** What each castle got of what it needs this month, and what each settlement gives. */
export interface ServicePlan {
  /** hands each settlement gives to castles (after its own buildings, before its fields) */
  given: Map<string, number>;
  byCastle: Map<string, { need: number; got: number; staffing: number; reach: number; from: { id: string; hands: number }[] }>;
}

/**
 * Share the castles' staff out (DESIGN §3.5): each castle (id order) takes
 * from the settlements in its reach in proportion to the hands they can
 * spare — what is left of their working hands after their own buildings, and
 * never more than `maxShareOfHands` of them in all. A castle with less than
 * it needs is staffed in proportion (staffing = got / need).
 */
export function allocateService(state: GameState, worked: Map<string, number[]>): ServicePlan {
  const given = new Map<string, number>();
  const byCastle: ServicePlan['byCastle'] = new Map();
  const avail = new Map<string, number>();
  const availOf = (s: Settlement): number => {
    let a = avail.get(s.id);
    if (a === undefined) {
      const hands = workingHands(s.pop);
      let bstaff = 0;
      for (const id of s.buildings) bstaff += buildingDef(id).hands;
      a = Math.max(0, Math.min(CASTLES.service.maxShareOfHands * hands, hands - Math.min(hands, bstaff)));
      avail.set(s.id, a);
    }
    return a;
  };
  for (const c of activeCastles(state)) {
    const need = castleNeed(state, c, worked.get(c.id) ?? []).total;
    const reach = c.faction ? reachOf(state, c) : [];
    const total = reach.reduce((t, s) => t + availOf(s), 0);
    const got = Math.min(need, total);
    const from: { id: string; hands: number }[] = [];
    if (got > 1e-9 && total > 0) {
      for (const s of reach) {
        const take = got * (availOf(s) / total);
        given.set(s.id, (given.get(s.id) ?? 0) + take);
        avail.set(s.id, availOf(s) - take);
        if (take > 1e-9) from.push({ id: s.id, hands: take });
      }
    }
    byCastle.set(c.id, { need, got, staffing: need > 0 ? got / need : 0, reach: reach.length, from });
  }
  return { given, byCastle };
}

// ---- building ----

/** What building a castle of this kind on this cell costs: the table's price, or its share when a ruin stands there. */
export function castleBuildCost(state: GameState, tierId: string, cell: number): { money: number; materials: Materials; months: number; rebuild: boolean } {
  const k = castleKind(tierId).build;
  const w = state.map.width;
  const here = settlementIdAt(state, cell % w, Math.floor(cell / w));
  const ruin = here ? isRuin(state.settlements[here]) : false;
  const share = ruin ? CASTLES.ruin.rebuildCostShare : 1;
  const materials = emptyMaterials();
  materials.timber = k.timber * share;
  materials.stone = k.stone * share;
  return { money: k.money * share, materials, months: k.months, rebuild: ruin };
}

/** Is there a castle (standing) on this cell? */
export function castleAt(state: GameState, cell: number): Settlement | null {
  const w = state.map.width;
  const id = settlementIdAt(state, cell % w, Math.floor(cell / w));
  const s = id ? state.settlements[id] : null;
  return s && isCastle(s) && !isRuin(s) ? s : null;
}

/** The hands a castle's upgrade can use this month: spare hands of the settlements in reach (as last reported) plus work-bands standing on it. */
export function upgradeHandsAvailable(state: GameState, c: Settlement): number {
  let hands = 0;
  for (const s of reachOf(state, c)) hands += s.report.idleHands;
  for (const u of Object.values(state.units)) {
    if (u.faction === c.faction && u.col === c.col && u.row === c.row && u.order === null && u.type === 'workband') hands += workingHands(u.pop);
  }
  return hands;
}

/** Rebuild a ruin as a standing castle of `tierId` (a work-band finished the job): staffing starts again. */
export function restoreRuin(_state: GameState, s: Settlement, tierId: string): void {
  s.tier = tierIndex(tierId);
  if (s.castle) { s.castle.ruin = false; s.castle.unstaffedMonths = 0; }
  s.food = 0;
}

/** A name for a new castle: the nearest settlement's, with "Castle" (numbered when taken). PLACEHOLDER for DESIGN §4.10. */
export function castleName(state: GameState, col: number, row: number): string {
  const at = offsetToAxial(col, row);
  let near: Settlement | null = null, nd = Infinity;
  for (const o of Object.values(state.settlements)) {
    if (isCastle(o)) continue;
    const d = axialDistance(at, settlementAxial(o));
    if (d < nd || (d === nd && near && o.id < near.id)) { near = o; nd = d; }
  }
  const base = near ? `${near.name} Castle` : 'Castle';
  const taken = new Set(Object.values(state.settlements).map((o) => o.name));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
}

export { MATERIAL_IDS };
