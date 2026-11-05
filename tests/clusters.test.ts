// Session 10: clusters (DESIGN §3.3) — derived from parent links; yearly totals.

import { describe, it, expect } from 'vitest';
import { createMap } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { createGameState, serializeState, deserializeState, type GameState } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';
import { applyCommand } from '../src/sim/commands';
import { resolveAllParents, type Settlement } from '../src/sim/settlements';
import { clustersOf, clusterOf, clusterRootOf, clusterInfluenceCells, realmReport } from '../src/sim/clusters';
import { totalPopulation } from '../src/sim/demography';
import { setNoise, NO_NOISE } from '../src/sim/noise';
setNoise(NO_NOISE);

const G = terrainIndex('grassland');

function found(state: GameState, name: string, tier: string, col: number, row: number, population: number): Settlement {
  applyCommand(state, { type: 'foundSettlement', settlement: { name, tier, col, row, population } });
  return Object.values(state.settlements).find((s) => s.name === name)!;
}

/** city at centre, a town 5 away (inside the city's 5 rings), two villages under the town, one village under the city, one lone village far away */
function realm(): GameState {
  const s = createGameState('c', createMap(40, 30, G));
  found(s, 'City', 'city', 15, 15, 24000);
  found(s, 'Town', 'town', 20, 15, 9000);
  found(s, 'TV1', 'village', 23, 15, 900);
  found(s, 'TV2', 'village', 22, 17, 900);
  found(s, 'CV', 'village', 11, 15, 900);
  found(s, 'Lone', 'village', 35, 5, 900);
  resolveAllParents(s);
  return s;
}

const byName = (s: GameState, n: string) => Object.values(s.settlements).find((x) => x.name === n)!;

describe('clusters', () => {
  it('derives one cluster per unparented settlement, with transitive members in tree order', () => {
    const s = realm();
    const cs = clustersOf(s);
    expect(cs.length).toBe(2);
    const city = cs[0], lone = cs[1];
    expect(city.root).toBe(byName(s, 'City').id);
    expect(city.members.length).toBe(5);
    expect(city.members[0]).toBe(city.root);
    // the town is nested under the city, its villages under the town
    const townNode = city.tree.children.find((c) => c.id === byName(s, 'Town').id)!;
    expect(townNode).toBeDefined();
    expect(townNode.children.map((c) => c.id).sort()).toEqual([byName(s, 'TV1').id, byName(s, 'TV2').id].sort());
    expect(city.tree.children.map((c) => c.id)).toContain(byName(s, 'CV').id);
    expect(lone.members).toEqual([byName(s, 'Lone').id]);
    expect(lone.totals.settlements).toBe(1);
  });

  it('totals add up and by-tier counts match the members', () => {
    const s = realm();
    const city = clustersOf(s)[0];
    const members = city.members.map((id) => s.settlements[id]);
    expect(city.totals.population).toBeCloseTo(members.reduce((a, m) => a + totalPopulation(m.pop), 0), 6);
    expect(city.totals.popByTier.reduce((a, b) => a + b, 0)).toBeCloseTo(city.totals.population, 6);
    expect(city.totals.food).toBeCloseTo(members.reduce((a, m) => a + m.food, 0), 6);
    expect(city.totals.popByTier[2]).toBeCloseTo(24000, 6); // city tier index 2
  });

  it('clusterOf / clusterRootOf follow the chain village → town → city', () => {
    const s = realm();
    const tv1 = byName(s, 'TV1').id, cityId = byName(s, 'City').id;
    expect(clusterRootOf(s, tv1)).toBe(cityId);
    expect(clusterOf(s, tv1)!.root).toBe(cityId);
    expect(clusterRootOf(s, byName(s, 'Lone').id)).toBe(byName(s, 'Lone').id);
  });

  it('the influence union covers every member centre and is larger than the root alone', () => {
    const s = realm();
    const city = clustersOf(s)[0];
    const cells = clusterInfluenceCells(s, city);
    for (const id of city.members) {
      const m = s.settlements[id];
      expect(cells.has(m.row * s.map.width + m.col)).toBe(true);
    }
    expect(cells.size).toBeGreaterThan(91); // the city's own 5 rings
  });

  it('yearly totals accumulate month by month and roll over in December; the cluster sums them', () => {
    const s = realm();
    for (let i = 0; i < 12; i++) endTurn(s); // Jan..Dec of year 1
    const city = byName(s, 'City');
    expect(city.lastYear).not.toBeNull();
    expect(city.lastYear!.months).toBe(12);
    expect(city.lastYear!.consumed).toBeGreaterThan(0);
    expect(city.year.months).toBe(0);
    endTurn(s); // January again
    expect(city.year.months).toBe(1);
    const c = clustersOf(s)[0];
    const sumConsumed = c.members.reduce((a, id) => a + s.settlements[id].lastYear!.consumed, 0);
    expect(c.totals.lastYear!.consumed).toBeCloseTo(sumConsumed, 6);
    expect(c.totals.year.months).toBe(1);
    // food produced by the villages last year was partly sent up: sent and received balance inside the cluster
    const sent = c.members.reduce((a, id) => a + s.settlements[id].lastYear!.sent, 0);
    const received = c.members.reduce((a, id) => a + s.settlements[id].lastYear!.received, 0);
    expect(received).toBeCloseTo(sent, 6);
  });

  it('a save without yearly totals loads with empty ones', () => {
    const s = realm();
    endTurn(s);
    const raw = JSON.parse(serializeState(s));
    for (const st of Object.values(raw.settlements) as Record<string, unknown>[]) { delete st.year; delete st.lastYear; }
    const back = deserializeState(JSON.stringify(raw));
    const v = Object.values(back.settlements)[0];
    expect(v.year.months).toBe(0);
    expect(v.lastYear).toBeNull();
  });

  it('the realm report sums the player clusters and counts singletons', () => {
    const s = realm();
    const r = realmReport(s);
    expect(r.clusters.length).toBe(2);
    expect(r.singletons).toBe(1);
    expect(r.population).toBeCloseTo(24000 + 9000 + 4 * 900, 6);
  });
});
