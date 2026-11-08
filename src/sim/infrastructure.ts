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
import { resourceByIndex } from './resources';
import type { Materials } from './materials';
import { castleKind } from './castles';

export interface InfraItem {
  id: string;
  kind: 'road' | 'bridge' | 'castle';
  /** castles: the settlement tier id the item builds (months and cost are read from data/castles.json) */
  tier?: string;
  /** road level it gives (1 dirt, 2 paved); 0 for a bridge */
  level: number;
  name: string;
  months: number;
  cost: Partial<Materials> & { money?: number };
  requires?: string;
  blurb?: string;
}

/** A quarry or lumber camp on a hex (Session 17): a map entity whose economic influence is not decided yet. */
export type SiteKind = 'quarry' | 'lumber';
export interface SiteInfo { id: SiteKind; name: string; icon: string; blurb?: string; rule?: string; onTerrain?: string[]; notOnTerrain?: string[] }

interface InfraData {
  sites: SiteInfo[];
  work: { refPeople: number; maxRate: number };
  movement: { minCost: Record<string, number>; factor: Record<string, number> };
  planning: { bridgePenalty: number; reuse: number };
  items: InfraItem[];
}

export const INFRA: InfraData = infraData as unknown as InfraData;
export const INFRA_ITEMS: readonly InfraItem[] = INFRA.items;
// castles take their months and price from data/castles.json (one place for the numbers)
for (const it of INFRA_ITEMS) {
  if (it.kind === 'castle' && it.tier) { const b = castleKind(it.tier).build; it.months = b.months; it.cost = { timber: b.timber, stone: b.stone, money: b.money }; }
}

export const SITE_KINDS: readonly SiteInfo[] = INFRA.sites;
export function siteInfo(kind: string): SiteInfo | undefined { return SITE_KINDS.find((x) => x.id === kind); }

export function infraItem(id: string): InfraItem {
  const i = INFRA_ITEMS.find((x) => x.id === id);
  if (!i) throw new Error(`Unknown infrastructure item "${id}"`);
  return i;
}

/** What stands on the map outside settlements: road level by cell (1 dirt, 2 paved) and the bridged river hexes. */
export interface InfraState {
  roads: Record<string, number>;
  bridges: Record<string, true>;
  /** quarries and lumber camps by cell (state v9) */
  sites: Record<string, SiteKind>;
}

export function emptyInfra(): InfraState {
  return { roads: {}, bridges: {}, sites: {} };
}

/** Everything the editor can put on one hex, as absolute values (the unit of the `setInfra` command and its inverse). */
export interface InfraCell { i: number; road: number; bridge: boolean; site: SiteKind | '' }

export function infraCellAt(state: GameState, i: number): InfraCell {
  return { i, road: state.infra?.roads[i] ?? 0, bridge: !!state.infra?.bridges[i], site: state.infra?.sites?.[i] ?? '' };
}

/** What the editor's Infrastructure tab can place. */
export type InfraBrush = 'dirt' | 'paved' | 'bridge' | 'quarry' | 'lumber' | 'erase';

/** The new contents of hex `i` for a brush, or the reason it cannot go there (editor rules; DESIGN §3.4). */
export function infraBrushResult(state: GameState, i: number, brush: InfraBrush): { ok: true; cell: InfraCell } | { ok: false; reason: string } {
  const map = state.map;
  const w = map.width;
  const t = TERRAIN[map.terrain[i]];
  const cur = infraCellAt(state, i);
  if (brush === 'erase') return { ok: true, cell: { i, road: 0, bridge: false, site: '' } };
  if (settlementIdAt(state, i % w, Math.floor(i / w)) !== null) return { ok: false, reason: 'a settlement stands there' };
  const isRiver = map.terrain[i] === RIVER;
  if (brush === 'bridge') {
    if (!isRiver) return { ok: false, reason: 'a bridge goes on a river hex' };
    return { ok: true, cell: { ...cur, bridge: true, road: Math.max(cur.road, 1) } };
  }
  if (t.id === 'sea' || t.id === 'lake') return { ok: false, reason: `${t.name.toLowerCase()} cannot be built on` };
  if (brush === 'dirt' || brush === 'paved') {
    if (isRiver && !cur.bridge) return { ok: false, reason: 'a river hex needs a bridge first' };
    return { ok: true, cell: { ...cur, road: brush === 'dirt' ? 1 : 2 } };
  }
  if (isRiver) return { ok: false, reason: 'not on a river hex' };
  if (brush === 'quarry') {
    const res = resourceByIndex(map.resource[i]);
    if (!(res?.mineable || t.id === 'mountains')) return { ok: false, reason: 'a quarry needs a mineable resource (stone, iron, silver, salt) or mountains' };
  } else if (t.id === 'mountains') {
    return { ok: false, reason: 'no lumber camps on mountains' };
  }
  return { ok: true, cell: { ...cur, site: brush } };
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
export function minStep(): number { return Math.min(1, ...Object.values(INFRA.movement.minCost)); }

/** The least a road link of this level may cost per step (DECIDED 2026-11-08: dirt 0.5, paved 0.25). */
function minCostFor(link: number): number { return INFRA.movement.minCost[String(link)] ?? 1; }

/**
 * Movement points to step from `from` onto `to` for a unit with `movePoints` a
 * month; null if impassable. Without a road link: terrain `moveCost`, mountains
 * the whole month. With one: terrain `moveCost` × the road's factor, never
 * under the link level's `movement.minCost` (mountains too — a road makes them an ordinary hill).
 */
export function stepCostBetween(state: GameState, from: number, to: number, movePoints: number): number | null {
  const map: MapData = state.map;
  const ti = map.terrain[to];
  const link = roadLink(state, from, to);
  if (ti === MOUNTAINS) {
    if (link <= 0) return movePoints; // one hex a month (DECIDED 2026-11-07)
    return Math.max(minCostFor(link), r2(TERRAIN[ti].moveCost * (INFRA.movement.factor[String(link)] ?? 1)));
  }
  const t = TERRAIN[ti];
  if (!t.passable) return null;
  if (link <= 0) return t.moveCost;
  return Math.max(minCostFor(link), r2(t.moveCost * (INFRA.movement.factor[String(link)] ?? 1)));
}

/** Does entering `to` from `from` take the unit's whole month (mountains without a road)? */
export function takesWholeMonth(state: GameState, from: number, to: number): boolean {
  return state.map.terrain[to] === MOUNTAINS && roadLink(state, from, to) <= 0;
}

export function isRiverCell(map: MapData, cell: number): boolean {
  return map.terrain[cell] === RIVER;
}
