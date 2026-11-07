// The scripted settler-spammer (Phase 2 session 1, ROADMAP Part C): measures how
// fast a realm sprawls when nothing but people and coins brake it (DESIGN §3.2b
// rule 12 — no administrative capacity). Every month each cluster of the player's
// faction tries to raise ONE party of settlers at its root, mustered from the
// SPARE hands of its members (so no field is stripped — the "sensible" spammer),
// aimed at the best unclaimed village site within reach; the party walks there
// and founds a village. Used by `npm run sim -- --scenario start --settlers 1`.

import type { GameState } from '../sim/state';
import { calendar } from '../sim/state';
import { idx } from '../sim/map';
import { TERRAIN } from '../sim/terrain';
import { TIERS, settlementAxial, type Settlement } from '../sim/settlements';
import { axialDistance, axialRange, axialToOffset } from '../sim/hex';
import { totalPopulation } from '../sim/demography';
import { clustersOf } from '../sim/clusters';
import { applyCommand } from '../sim/commands';
import { raiseCheck, defaultSize, defaultProvisionMonths, musterSources, handsShare, bestJob, cellsAround, canFoundAt, unitTypeDef, type MusterRow } from '../sim/units';
import { findRoute, OPEN } from '../sim/pathfinding';

export interface SpammerOptions {
  /** how far from a cluster root a site may be (hexes) */
  reach: number;
  /** people a party may take from a source beyond its spare hands (0 = spare hands only) */
  recklessShare: number;
}

export interface SpammerStats {
  raised: number;
  founded: number;
  refusedMoney: number;
  refusedMaterials: number;
  waitedForPeople: number;
  noSite: number;
  /** people who left in parties */
  peopleOut: number;
  /** settlements at the end of each calendar year */
  curve: number[];
}

export function emptyStats(): SpammerStats {
  return { raised: 0, founded: 0, refusedMoney: 0, refusedMaterials: 0, waitedForPeople: 0, noSite: 0, peopleOut: 0, curve: [] };
}

/** Cells no new village may be founded on: every settlement's work zone plus a ring round every party's target. */
function blockedCells(state: GameState): Set<number> {
  const map = state.map;
  const out = new Set<number>();
  for (const s of Object.values(state.settlements)) for (const c of cellsAround(map, idx(map, s.col, s.row), TIERS[s.tier].workRings)) out.add(c);
  for (const u of Object.values(state.units)) if (u.order) for (const c of cellsAround(map, u.order.dest, 2)) out.add(c);
  return out;
}

/**
 * Yearly food the hexes round `cell` would feed at their best jobs — counting only
 * hexes nobody works yet: a contested hex goes to the higher tier (DESIGN §3.3),
 * so a village founded beside a town keeps only the hexes outside the town's zone.
 */
function siteFood(state: GameState, cell: number, blocked: Set<number>): { food: number; hexes: number } {
  let food = 0, hexes = 0;
  for (const c of cellsAround(state.map, cell, TIERS[0].workRings)) {
    if (c !== cell && blocked.has(c)) continue;
    const j = bestJob(state.map, c);
    if (j) { food += j.fedPerYear; hexes++; }
  }
  return { food, hexes };
}

/** The best unclaimed village site within reach of `root`: most food, nearer wins ties, must be reachable. */
function pickSite(state: GameState, root: Settlement, reach: number, blocked: Set<number>): number | null {
  const map = state.map;
  const centre = settlementAxial(root);
  const cands: { cell: number; score: number; d: number }[] = [];
  for (const h of axialRange(centre, reach)) {
    const o = axialToOffset(h.q, h.r);
    if (o.col < 0 || o.row < 0 || o.col >= map.width || o.row >= map.height) continue;
    const cell = idx(map, o.col, o.row);
    if (blocked.has(cell)) continue; // the blocked set already holds every work zone and settlement centre
    const t = TERRAIN[map.terrain[cell]];
    if (!t.passable) continue;
    const { food, hexes } = siteFood(state, cell, blocked);
    if (food < 1500 || hexes < 5) continue; // not worth a village (a seven-farm site feeds ~3,000–4,000)
    const d = axialDistance(centre, h);
    cands.push({ cell, score: food - 150 * d, d });
  }
  cands.sort((a, b) => b.score - a.score || a.d - b.d || a.cell - b.cell);
  const start = { cell: idx(map, root.col, root.row), bank: OPEN };
  const mp = unitTypeDef('settlers').movePoints;
  for (const c of cands.slice(0, 6)) {
    if (!canFoundAt(state, c.cell).ok) continue;
    const r = findRoute(state, start, c.cell, mp);
    if (r && Number.isFinite(r.months) && r.months <= 6) return c.cell;
  }
  return null;
}

/** One month of the spammer. */
export function spamSettlers(state: GameState, opts: SpammerOptions, stats: SpammerStats): void {
  const blocked = blockedCells(state);
  const month = calendar(state.turn).month;
  for (const c of clustersOf(state)) {
    if (c.faction !== state.playerFaction) continue;
    const root = state.settlements[c.root];
    if (!root) continue;
    // one party in the field per cluster root at a time keeps the measurement readable
    if (Object.values(state.units).some((u) => u.home === root.id && u.order)) continue;
    const site = pickSite(state, root, opts.reach, blocked);
    if (site === null) { stats.noSite++; continue; }
    const size = defaultSize(state, 'settlers', root, site);
    // muster: spare hands of every source, as people, biggest first; reckless mode may dip into the rest
    const sources = musterSources(state, root.id);
    const rows: MusterRow[] = [];
    let left = size;
    const offers = sources.map((m) => {
      const s = m.settlement;
      const share = Math.max(0.3, handsShare(s.pop));
      const spare = m.spareHands / share;
      const extra = opts.recklessShare > 0 ? totalPopulation(s.pop) * opts.recklessShare : 0;
      return { id: s.id, people: Math.max(0, Math.min(totalPopulation(s.pop) - 100, spare + extra)) };
    }).sort((a, b) => b.people - a.people || (a.id < b.id ? -1 : 1));
    for (const o of offers) {
      if (left <= 0) break;
      const take = Math.min(left, Math.floor(o.people));
      if (take <= 0) continue;
      rows.push({ id: o.id, people: take });
      left -= take;
    }
    if (left > size * 0.1) { stats.waitedForPeople++; continue; }
    const spec = { type: 'settlers', at: root.id, muster: rows, provisionMonths: defaultProvisionMonths('settlers', month), dest: site, then: 'settle' as const };
    const check = raiseCheck(state, spec);
    if (!check.ok) {
      if (check.lackingMoney) stats.refusedMoney++; else if (check.lacking) stats.refusedMaterials++; else stats.waitedForPeople++;
      continue;
    }
    applyCommand(state, { type: 'raiseUnit', spec });
    stats.raised++;
    stats.peopleOut += rows.reduce((t, r) => t + r.people, 0);
    for (const cell of cellsAround(state.map, site, 2)) blocked.add(cell);
  }
}

/** For the report: the parties in the field and their people. */
export function fieldReport(state: GameState): { units: number; people: number; starving: number } {
  let people = 0, starving = 0;
  const units = Object.values(state.units);
  for (const u of units) { people += totalPopulation(u.pop); if (u.report.shortfall > 0) starving++; }
  return { units: units.length, people, starving };
}
