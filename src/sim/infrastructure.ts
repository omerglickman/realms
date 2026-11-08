// Infrastructure on the map (Phase 2 session 2; DESIGN §3.2b rule 7, §3.4):
// roads (dirt, paved) and bridges, built hex by hex by work-bands
// (src/sim/workbands.ts). The data is data/infrastructure.json; what stands on
// the map is `state.infra`. This file knows the data, the accessors and the
// movement rule — pathfinding reads it, workbands writes it. No DOM.

import infraData from '../../data/infrastructure.json';
import type { GameState } from './state';
import type { MapData } from './map';
import { TERRAIN, terrainIndex } from './terrain';
import { settlementIdAt } from './settlements';
import type { Materials } from './materials';

export interface InfraItem {
  id: string;
  kind: 'road' | 'bridge';
  /** road level it gives (1 dirt, 2 paved); 0 for a bridge */
  level: number;
  name: string;
  months: number;
  cost: Partial<Materials>;
  requires?: string;
  blurb?: string;
}

interface InfraData {
  work: { refPeople: number; maxRate: number };
  movement: { minCost: number; factor: Record<string, number> };
  planning: { bridgePenalty: number; reuse: number };
  items: InfraItem[];
}

export const INFRA: InfraData = infraData as unknown as InfraData;
export const INFRA_ITEMS: readonly InfraItem[] = INFRA.items;

export function infraItem(id: string): InfraItem {
  const i = INFRA_ITEMS.find((x) => x.id === id);
  if (!i) throw new Error(`Unknown infrastructure item "${id}"`);
  return i;
}

/** What stands on the map outside settlements: road level by cell (1 dirt, 2 paved) and the bridged river hexes. */
export interface InfraState {
  roads: Record<string, number>;
  bridges: Record<string, true>;
}

export function emptyInfra(): InfraState {
  return { roads: {}, bridges: {} };
}

const RIVER = terrainIndex('river');
const MOUNTAINS = terrainIndex('mountains');

/** Road level of a hex for movement: built roads, a settlement's hex counts as a dirt road. */
export function roadLevelAt(state: GameState, cell: number): number {
  const built = state.infra?.roads[cell] ?? 0;
  if (built >= 1) return built;
  const w = state.map.width;
  return settlementIdAt(state, cell % w, Math.floor(cell / w)) !== null ? 1 : 0;
}

/** The level of road that is actually built on a hex (a settlement does not count). */
export function builtRoad(state: GameState, cell: number): number {
  return state.infra?.roads[cell] ?? 0;
}

export function hasBridge(state: GameState, cell: number): boolean {
  return !!state.infra?.bridges[cell];
}

/** Level of the road link between two adjacent hexes: the lower of the two (0 = no road link). */
export function roadLink(state: GameState, from: number, to: number): number {
  return Math.min(roadLevelAt(state, from), roadLevelAt(state, to));
}

const r2 = (x: number): number => Math.round(x * 100) / 100;

/** The cheapest a step can be (the A* heuristic's unit). */
export function minStep(): number { return Math.min(1, INFRA.movement.minCost); }

/**
 * Movement points to step from `from` onto `to` for a unit with `movePoints` a
 * month; null if impassable. Without a road link: terrain `moveCost`, mountains
 * the whole month. With one: terrain `moveCost` × the road's factor, never
 * under `movement.minCost` (mountains too — a road makes them an ordinary hill).
 */
export function stepCostBetween(state: GameState, from: number, to: number, movePoints: number): number | null {
  const map: MapData = state.map;
  const ti = map.terrain[to];
  const link = roadLink(state, from, to);
  if (ti === MOUNTAINS) {
    if (link <= 0) return movePoints; // one hex a month (DECIDED 2026-11-07)
    return Math.max(INFRA.movement.minCost, r2(TERRAIN[ti].moveCost * (INFRA.movement.factor[String(link)] ?? 1)));
  }
  const t = TERRAIN[ti];
  if (!t.passable) return null;
  if (link <= 0) return t.moveCost;
  return Math.max(INFRA.movement.minCost, r2(t.moveCost * (INFRA.movement.factor[String(link)] ?? 1)));
}

/** Does entering `to` from `from` take the unit's whole month (mountains without a road)? */
export function takesWholeMonth(state: GameState, from: number, to: number): boolean {
  return state.map.terrain[to] === MOUNTAINS && roadLink(state, from, to) <= 0;
}

export function isRiverCell(map: MapData, cell: number): boolean {
  return map.terrain[cell] === RIVER;
}
