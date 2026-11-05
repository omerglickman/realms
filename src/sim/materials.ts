// Materials (DESIGN §4.2, DECIDED by Omer 2026-11-05, Session 11): timber,
// stone and goods. Every settlement holds its own stock; the CLUSTER's stockpile
// is the sum over its members, and that is what building projects draw from —
// a grassland town builds with its woodland villages' timber. Each December a
// cluster keeps a reserve and sends a share of the rest to the faction
// stockpile, which the player ships to any cluster (instantly for now —
// PLACEHOLDER until roads and caravans carry it). Numbers in data/economy.json.

import economyData from '../../data/economy.json';
import type { GameState } from './state';
import type { Settlement } from './settlements';
import { clusterMembers } from './clusters';

export const MATERIAL_IDS = ['timber', 'stone', 'goods'] as const;
export type MaterialId = (typeof MATERIAL_IDS)[number];
export type Materials = Record<MaterialId, number>;

export const MATERIAL_NAMES: Record<MaterialId, string> = { timber: 'Timber', stone: 'Stone', goods: 'Goods' };

type MaterialsData = {
  timber: { perYearByTimber: number[]; hands: number };
  stone: { perYearOnStoneHex: number; hands: number };
  reserve: Materials;
  surplusShare: number;
};
export const MATERIALS: MaterialsData = (economyData as unknown as { materials: MaterialsData }).materials;

/** Faction surplus share (read live so the runner and tests can change it). */
export function surplusShare(): number {
  return MATERIALS.surplusShare ?? 0;
}
export function setSurplusShare(x: number): void {
  MATERIALS.surplusShare = x;
}

export function emptyMaterials(): Materials {
  return { timber: 0, stone: 0, goods: 0 };
}

export function addMaterials(into: Materials, from: Partial<Materials>, k = 1): Materials {
  for (const m of MATERIAL_IDS) into[m] += (from[m] ?? 0) * k;
  return into;
}

export function materialsTotal(m: Materials): number {
  return m.timber + m.stone + m.goods;
}

export function isEmptyMaterials(m: Partial<Materials>): boolean {
  return MATERIAL_IDS.every((k) => !(m[k] && m[k]! > 0));
}

/** Clamp a stock at zero (floating-point dust after proportional takes). */
export function tidyMaterials(m: Materials): void {
  for (const k of MATERIAL_IDS) if (m[k] < 1e-9) m[k] = 0;
}

/** Sum of the stocks of a cluster's members (the cluster `id` belongs to). */
export function clusterStock(state: GameState, id: string): Materials {
  const out = emptyMaterials();
  for (const mid of clusterMembers(state, id)) {
    const s = state.settlements[mid];
    if (s) addMaterials(out, s.stock);
  }
  return out;
}

export function canAfford(stock: Materials, cost: Partial<Materials>): boolean {
  return MATERIAL_IDS.every((k) => stock[k] + 1e-9 >= (cost[k] ?? 0));
}

/** What `cost` lacks against `stock` (zeros when affordable). */
export function shortfall(stock: Materials, cost: Partial<Materials>): Materials {
  const out = emptyMaterials();
  for (const k of MATERIAL_IDS) out[k] = Math.max(0, (cost[k] ?? 0) - stock[k]);
  return out;
}

/** One member's contribution to a payment, for the inverse command. */
export interface Payment {
  id: string;
  amount: Materials;
}

/**
 * Take `cost` from the cluster that `s` belongs to: the settlement's own stock
 * first, then the other members (root first, then the rest in member order).
 * Throws when the cluster cannot pay. Returns who paid what, so the payment can
 * be refunded exactly (cancel / undo).
 */
export function payFromCluster(state: GameState, s: Settlement, cost: Partial<Materials>): Payment[] {
  const members = clusterMembers(state, s.id).filter((m) => m !== s.id);
  const order = [s.id, ...members];
  const pool = clusterStock(state, s.id);
  if (!canAfford(pool, cost)) {
    const lack = shortfall(pool, cost);
    throw new Error(`The cluster cannot pay: short of ${MATERIAL_IDS.filter((k) => lack[k] > 0).map((k) => `${Math.ceil(lack[k])} ${k}`).join(', ')}`);
  }
  const paid: Payment[] = [];
  const left: Materials = { timber: cost.timber ?? 0, stone: cost.stone ?? 0, goods: cost.goods ?? 0 };
  for (const id of order) {
    const m = state.settlements[id];
    if (!m) continue;
    const amount = emptyMaterials();
    let any = false;
    for (const k of MATERIAL_IDS) {
      const take = Math.min(left[k], m.stock[k]);
      if (take > 0) { amount[k] = take; m.stock[k] -= take; left[k] -= take; any = true; }
    }
    tidyMaterials(m.stock);
    if (any) paid.push({ id, amount });
    if (isEmptyMaterials(left)) break;
  }
  return paid;
}

/** Give a payment back to whoever paid it (to the cluster root if a payer is gone). */
export function refund(state: GameState, paid: Payment[], fallbackId: string): void {
  for (const p of paid) {
    const m = state.settlements[p.id] ?? state.settlements[fallbackId];
    if (m) addMaterials(m.stock, p.amount);
  }
}

/**
 * Take `amount` from a cluster's pooled stock proportionally to what each
 * member holds (used by the yearly surplus and the realm's "take" command).
 * Returns what was actually taken (capped at what the cluster has).
 */
export function takeFromCluster(state: GameState, id: string, amount: Partial<Materials>): Materials {
  const members = clusterMembers(state, id).map((m) => state.settlements[m]).filter(Boolean) as Settlement[];
  const pool = clusterStock(state, id);
  const taken = emptyMaterials();
  for (const k of MATERIAL_IDS) {
    const want = Math.min(amount[k] ?? 0, pool[k]);
    if (want <= 0 || pool[k] <= 0) continue;
    const share = want / pool[k];
    for (const m of members) {
      const t = m.stock[k] * share;
      m.stock[k] -= t;
      taken[k] += t;
    }
  }
  for (const m of members) tidyMaterials(m.stock);
  return taken;
}
