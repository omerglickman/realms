// Tier upgrades (DESIGN §3.2b rule 10, DECIDED 2026-11-07; numbers draft in
// data/settlements.json `upgrades`). A settlement that has reached the next
// tier's population gate (§3.3) may be upgraded by the player: the money leaves
// the treasury and the timber and stone the cluster's stockpile when ordered;
// the hall grows over the step's months (no builders — the hall's own staff);
// at completion the tier changes, so its zones, hall and granary grow with it.
// The city → metropolis step is a PLACEHOLDER (Session 15b): its real
// prerequisites (roads, an institution) are not designed yet. Rules here,
// numbers in data/; every change goes through commands.ts.

import type { GameState } from './state';
import { logEvent } from './state';
import { TIERS, UPGRADES, tierIndex, type Settlement, type UpgradeDef, type UpgradeProject } from './settlements';
import { totalPopulation } from './demography';
import { clusterStock, payFromCluster, MATERIAL_IDS, type Materials, emptyMaterials } from './materials';

/** The upgrade step a settlement of this tier may take, or null at the top. */
export function upgradeStep(tier: number): UpgradeDef | null {
  return UPGRADES.find((u) => u.from === TIERS[tier].id) ?? null;
}

export interface UpgradeCheck {
  ok: boolean;
  reason?: string;
  step: UpgradeDef | null;
  /** people still missing to the gate (0 when reached) */
  shortPeople: number;
  lacking?: Materials;
  lackingMoney?: number;
}

export function canUpgrade(state: GameState, s: Settlement): UpgradeCheck {
  const step = upgradeStep(s.tier);
  if (!step) return { ok: false, reason: 'there is no higher tier', step: null, shortPeople: 0 };
  const to = TIERS[tierIndex(step.to)];
  const pop = totalPopulation(s.pop);
  const shortPeople = Math.max(0, to.popMin - pop);
  if (s.upgrade) return { ok: false, reason: `already becoming a ${TIERS[s.upgrade.to].name.toLowerCase()}`, step, shortPeople };
  if (!s.faction) return { ok: false, reason: 'the settlement belongs to no one', step, shortPeople };
  if (shortPeople > 0) return { ok: false, reason: `needs ${Math.ceil(to.popMin).toLocaleString('en-US')} people to become a ${to.name.toLowerCase()} — ${Math.ceil(shortPeople).toLocaleString('en-US')} short`, step, shortPeople };
  const f = state.factions[s.faction];
  if (f && f.treasury + 1e-9 < step.money) return { ok: false, reason: `the treasury lacks ${Math.ceil(step.money - f.treasury).toLocaleString('en-US')} coins`, step, shortPeople, lackingMoney: step.money - f.treasury };
  const pool = clusterStock(state, s.id);
  const lacking = emptyMaterials();
  let short = false;
  for (const k of MATERIAL_IDS) {
    const want = (step as unknown as Record<string, number>)[k] ?? 0;
    if (want > pool[k] + 1e-9) { lacking[k] = want - pool[k]; short = true; }
  }
  if (short) return { ok: false, reason: `the cluster's stockpile is short of ${MATERIAL_IDS.filter((k) => lacking[k] > 0).map((k) => `${Math.ceil(lacking[k])} ${k}`).join(', ')} (ship it from the realm)`, step, shortPeople, lacking };
  return { ok: true, step, shortPeople };
}

/** Pay and start the upgrade. Throws when it cannot be done. */
export function startUpgrade(state: GameState, s: Settlement): UpgradeProject {
  const check = canUpgrade(state, s);
  if (!check.ok || !check.step) throw new Error(`${s.name} cannot be upgraded: ${check.reason}`);
  const step = check.step;
  const paid = payFromCluster(state, s, { timber: step.timber, stone: step.stone });
  const f = state.factions[s.faction!];
  if (f) { f.treasury -= step.money; f.year.spent += step.money; }
  s.upgrade = { to: tierIndex(step.to), progress: 0, paid, paidMoney: step.money, startedTurn: state.turn };
  logEvent(state, 'upgrade', `${s.name} began its rise to ${TIERS[s.upgrade.to].name.toLowerCase()} (${step.months} months).`);
  return s.upgrade;
}

/** One month of a running upgrade; completes it when done. Called from economyMonth. */
export function upgradeMonth(state: GameState, s: Settlement): void {
  if (!s.upgrade) return;
  const step = upgradeStep(s.tier);
  const months = step ? Math.max(1, step.months) : 12;
  s.upgrade.progress += 1 / months;
  if (s.upgrade.progress >= 1 - 1e-9) completeUpgrade(state, s);
}

/** The settlement becomes the next tier: hall and granary swap, zones follow the tier. */
export function completeUpgrade(state: GameState, s: Settlement): void {
  if (!s.upgrade) return;
  const from = TIERS[s.tier], to = TIERS[s.upgrade.to];
  s.buildings = s.buildings.filter((b) => b !== from.hall && b !== from.granary);
  s.buildings.unshift(to.hall, to.granary);
  s.tier = s.upgrade.to;
  s.upgrade = null;
  // Omer 2026-11-07: the settlement stays in its cluster under its old parent even when it now matches its tier
  if (s.parent && TIERS[state.settlements[s.parent].tier].rank <= TIERS[s.tier].rank) s.parentOverride = s.parent;
  logEvent(state, 'upgraded', `${s.name} is now a ${to.name.toLowerCase()}.`);
}

/** Undo a completed upgrade exactly (for the command layer): the previous tier and buildings come back. */
export function revertTier(s: Settlement, fromTier: number, project: UpgradeProject, parentOverride: string | null): void {
  const to = TIERS[s.tier], from = TIERS[fromTier];
  s.buildings = s.buildings.filter((b) => b !== to.hall && b !== to.granary);
  s.buildings.unshift(from.hall, from.granary);
  s.tier = fromTier;
  s.upgrade = project;
  s.parentOverride = parentOverride;
}

/** The members of `root`'s cluster that share its tier — the candidates for leadership (DESIGN §3.3, Omer 2026-11-07). */
export function clusterPeers(state: GameState, root: Settlement, members: string[]): Settlement[] {
  return members.map((id) => state.settlements[id]).filter((m) => m.tier === root.tier);
}
