// Buildings the player builds (DESIGN §3.3, DECIDED by Omer 2026-11-05, Session 11).
// What may be built where, what it needs, and the effects the economy reads.
// The construction itself (progress each month) runs in economy.ts; paying for
// a project is in materials.ts; the player's commands are in commands.ts.

import type { GameState } from './state';
import type { MapData } from './map';
import { TERRAIN, terrainIndex } from './terrain';
import { RESOURCES } from './resources';
import { isFishable } from './water';
import { BUILDINGS, TIERS, buildingDef, tierIndex, workedCellsBySettlement, type BuildingDef, type Settlement } from './settlements';
import { clusterStock, canAfford, shortfall, type Materials } from './materials';

const RIVER = terrainIndex('river');
const STONE_RES = RESOURCES.findIndex((r) => r.id === 'stone');

/** Buildings a settlement of this tier index may ever build (not the mandatory ones). */
export function buildableFor(tier: number): BuildingDef[] {
  const rank = TIERS[tier].rank;
  return BUILDINGS.filter((b) => !b.mandatory && b.minTier !== undefined && TIERS[tierIndex(b.minTier)].rank <= rank);
}

/** Does a worked hex satisfy a building's `requires`? */
export function cellMeets(map: MapData, cell: number, req: NonNullable<BuildingDef['requires']>): boolean {
  const t = TERRAIN[map.terrain[cell]];
  switch (req) {
    case 'river': return map.terrain[cell] === RIVER;
    case 'shore': return isFishable(map, cell);
    case 'pasture': return t.pasture > 0;
  }
}

export function hasStone(map: MapData, cell: number): boolean {
  return map.resource[cell] === STONE_RES;
}

export interface BuildCheck {
  ok: boolean;
  reason?: string;
  /** what the cluster lacks (zeros when affordable) */
  lacking?: Materials;
  /** coins the treasury lacks (Session 11b) */
  lackingMoney?: number;
}

/** The money a building costs (0 when free). */
export function moneyCost(def: BuildingDef): number {
  return def.cost?.money ?? 0;
}

/**
 * May `s` queue `buildingId` now? Checks tier, duplicates, a project already
 * running, the required hex among the worked cells, the cluster's stock and the
 * faction's treasury (Session 11b). `worked` may be passed to avoid recomputing
 * the work assignment.
 */
export function canBuild(state: GameState, s: Settlement, buildingId: string, worked?: number[]): BuildCheck {
  const def = buildingDef(buildingId);
  if (def.mandatory || def.minTier === undefined) return { ok: false, reason: `${def.name} cannot be built` };
  if (TIERS[tierIndex(def.minTier)].rank > TIERS[s.tier].rank) return { ok: false, reason: `needs a ${TIERS[tierIndex(def.minTier)].name.toLowerCase()} or larger` };
  if (s.buildings.includes(buildingId)) return { ok: false, reason: 'already built' };
  if (s.build) return { ok: false, reason: `already building ${buildingDef(s.build.building).name}` };
  if (def.requires) {
    const cells = worked ?? (workedCellsBySettlement(state).get(s.id) ?? []);
    if (!cells.some((c) => cellMeets(state.map, c, def.requires!))) {
      const what = def.requires === 'river' ? 'a river hex' : def.requires === 'shore' ? 'a shore, lake or river hex' : 'a pasture hex';
      return { ok: false, reason: `needs ${what} in the work zone` };
    }
  }
  const pool = clusterStock(state, s.id);
  if (def.cost && !canAfford(pool, def.cost)) {
    const lack = shortfall(pool, def.cost);
    return { ok: false, reason: `the cluster lacks ${(['timber', 'stone', 'goods'] as const).filter((k) => lack[k] > 0).map((k) => `${Math.ceil(lack[k])} ${k}`).join(', ')}`, lacking: lack };
  }
  const money = moneyCost(def);
  if (money > 0) {
    const f = s.faction ? state.factions[s.faction] : undefined;
    const have = f?.treasury ?? 0;
    if (have + 1e-9 < money) return { ok: false, reason: `the treasury lacks ${Math.ceil(money - have)} coins`, lackingMoney: money - have };
  }
  return { ok: true };
}

/** The effects of a settlement's staffed buildings, each scaled by its staffing fraction. */
export interface BuildingEffects {
  farmingMult: number;
  fishingMult: number;
  granaryExtraMonths: number;
  granarySpoilageMult: number;
  /** Session 11b: multiplier on the goods the private hands make (Workshop); the share of the cluster's goods sold a year (Market — the only way goods become money) */
  goodsMult: number;
  salesShare: number;
  order: number;
}

export function sumEffects(staffed: { id: string; fraction: number }[]): BuildingEffects {
  const e: BuildingEffects = { farmingMult: 1, fishingMult: 1, granaryExtraMonths: 0, granarySpoilageMult: 1, goodsMult: 1, salesShare: 0, order: 0 };
  for (const b of staffed) {
    const def = buildingDef(b.id);
    const f = b.fraction;
    const x = def.effects;
    if (x.farmingBonus) e.farmingMult += x.farmingBonus * f;
    if (x.fishingBonus) e.fishingMult += x.fishingBonus * f;
    if (x.granaryCapacityMonths) e.granaryExtraMonths += x.granaryCapacityMonths * f;
    if (x.granarySpoilageMult !== undefined) e.granarySpoilageMult *= 1 - (1 - x.granarySpoilageMult) * f;
    if (x.goodsMult) e.goodsMult += x.goodsMult * f;
    if (x.salesShare) e.salesShare += x.salesShare * f;
    if (x.order) e.order += x.order * f;
  }
  return e;
}

/** Months a project still needs at full labour (for panels). */
export function monthsLeft(s: Settlement): number | null {
  if (!s.build) return null;
  const def = buildingDef(s.build.building);
  return Math.max(0, Math.ceil((1 - s.build.progress) * (def.buildMonths ?? 1) - 1e-9));
}
