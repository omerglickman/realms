// Clusters (DESIGN §3.3, DECIDED 2026-11-05): an unparented settlement together
// with every settlement subordinate to it, transitively. Food flows only inside
// a cluster, so it is the realm's real demographic and food unit. A lone village
// is a cluster of one. Purely DERIVED from the parent links — never stored in
// the state — so it cannot drift from the subordination rule.

import type { GameState } from './state';
import { type Settlement, type YearTotals, TIERS, emptyYearTotals, addYearTotals, influenceCells } from './settlements';
import { totalPopulation } from './demography';

/** One node of a cluster's tree: a settlement and the settlements subordinate to it. */
export interface ClusterNode {
  id: string;
  children: ClusterNode[];
}

export interface ClusterTotals {
  settlements: number;
  /** people by tier index (TIERS order) */
  popByTier: number[];
  population: number;
  /** food in all granaries */
  food: number;
  /** one month's consumption of the whole cluster */
  monthlyNeed: number;
  /** running totals of the current calendar year */
  year: YearTotals;
  /** totals of the last finished year; null until one has passed */
  lastYear: YearTotals | null;
  /** people who starved last month */
  hungerDeathsLastMonth: number;
}

export interface Cluster {
  /** id of the root (the unparented settlement) */
  root: string;
  faction: string | null;
  /** every member id including the root, in tree order (root first) */
  members: string[];
  tree: ClusterNode;
  totals: ClusterTotals;
}

/** Build the cluster tree under `root` from the resolved parent links. */
function buildTree(childrenOf: Map<string, Settlement[]>, root: Settlement, members: string[]): ClusterNode {
  members.push(root.id);
  const kids = (childrenOf.get(root.id) ?? []).slice().sort(
    (a, b) => TIERS[b.tier].rank - TIERS[a.tier].rank || totalPopulation(b.pop) - totalPopulation(a.pop) || (a.id < b.id ? -1 : 1),
  );
  return { id: root.id, children: kids.map((k) => buildTree(childrenOf, k, members)) };
}

function totalsOf(state: GameState, members: string[]): ClusterTotals {
  const popByTier = TIERS.map(() => 0);
  let population = 0, food = 0, hunger = 0;
  const year = emptyYearTotals();
  let lastYear: YearTotals | null = null;
  for (const id of members) {
    const s = state.settlements[id];
    const n = totalPopulation(s.pop);
    popByTier[s.tier] += n;
    population += n;
    food += s.food;
    hunger += s.report.hungerDeaths;
    addYearTotals(year, s.year);
    if (s.lastYear) { if (!lastYear) lastYear = emptyYearTotals(); addYearTotals(lastYear, s.lastYear); }
  }
  return { settlements: members.length, popByTier, population, food, monthlyNeed: population, year, lastYear, hungerDeathsLastMonth: hunger };
}

/**
 * All clusters of the state, roots sorted by population descending (so the
 * biggest cluster comes first). Uses the parent links as they are — call
 * resolveAllParents first if the state may be stale (economyMonth does).
 */
export function clustersOf(state: GameState): Cluster[] {
  const childrenOf = new Map<string, Settlement[]>();
  const roots: Settlement[] = [];
  for (const s of Object.values(state.settlements)) {
    if (s.parent && state.settlements[s.parent]) {
      let arr = childrenOf.get(s.parent);
      if (!arr) { arr = []; childrenOf.set(s.parent, arr); }
      arr.push(s);
    } else roots.push(s);
  }
  const out: Cluster[] = [];
  for (const r of roots) {
    const members: string[] = [];
    const tree = buildTree(childrenOf, r, members);
    out.push({ root: r.id, faction: r.faction, members, tree, totals: totalsOf(state, members) });
  }
  out.sort((a, b) => b.totals.population - a.totals.population || (a.root < b.root ? -1 : 1));
  return out;
}

/** The root settlement id of the cluster `id` belongs to (follows parent links up). */
export function clusterRootOf(state: GameState, id: string): string {
  let cur = state.settlements[id];
  const seen = new Set<string>();
  while (cur && cur.parent && state.settlements[cur.parent] && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = state.settlements[cur.parent];
  }
  return cur ? cur.id : id;
}

/** The cluster containing settlement `id`. */
export function clusterOf(state: GameState, id: string): Cluster | null {
  const root = clusterRootOf(state, id);
  return clustersOf(state).find((c) => c.root === root) ?? null;
}

/** Union of the members' influence cells — the area a cluster outline is drawn around. */
export function clusterInfluenceCells(state: GameState, c: Cluster): Set<number> {
  const set = new Set<number>();
  for (const id of c.members) for (const i of influenceCells(state.map, state.settlements[id])) set.add(i);
  return set;
}

/** Realm-wide report: the sum over clusters (DESIGN §3.3) plus the count of clusters by size. */
export function realmReport(state: GameState, faction: string | null = state.playerFaction) {
  const clusters = clustersOf(state).filter((c) => faction === null || c.faction === faction);
  const popByTier = TIERS.map(() => 0);
  let population = 0, food = 0, singletons = 0;
  const year = emptyYearTotals();
  let lastYear: YearTotals | null = null;
  for (const c of clusters) {
    for (let i = 0; i < popByTier.length; i++) popByTier[i] += c.totals.popByTier[i];
    population += c.totals.population;
    food += c.totals.food;
    if (c.members.length === 1) singletons += 1;
    addYearTotals(year, c.totals.year);
    if (c.totals.lastYear) { if (!lastYear) lastYear = emptyYearTotals(); addYearTotals(lastYear, c.totals.lastYear); }
  }
  return { clusters, population, popByTier, food, singletons, year, lastYear };
}
