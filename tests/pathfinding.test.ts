import { describe, it, expect } from 'vitest';
import { createMap, idx } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { createGameState } from '../src/sim/state';
import { applyCommand } from '../src/sim/commands';
import { findRoute, riverBanks, stepsFrom, stepsThisMonth, walkMonths, OPEN } from '../src/sim/pathfinding';

const G = terrainIndex('grassland'), P = terrainIndex('plains'), H = terrainIndex('hills'), F = terrainIndex('forest');
const M = terrainIndex('mountains'), R = terrainIndex('river'), SEA = terrainIndex('sea'), LAKE = terrainIndex('lake');

function world(w = 12, h = 12, fill = P) {
  const map = createMap(w, h, fill);
  const state = createGameState('path', map);
  return { map, state, at: (c: number, r: number) => idx(map, c, r) };
}

describe('routes and costs', () => {
  it('walks straight across plains, one point a hex', () => {
    const { state, at } = world();
    const r = findRoute(state, { cell: at(1, 4), bank: OPEN }, at(7, 4), 4)!;
    expect(r).not.toBeNull();
    expect(r.nodes.length).toBe(6);
    expect(r.cost).toBe(6);
    expect(r.months).toBe(2); // 4 + 2
  });

  it('prefers a longer path over cheaper terrain to a forest crossing', () => {
    const { map, state, at } = world();
    for (let r = 0; r < 12; r++) map.terrain[at(5, r)] = F; // a forest wall, cost 3
    map.terrain[at(5, 0)] = P; // a gap at the top
    const route = findRoute(state, { cell: at(3, 6), bank: OPEN }, at(7, 6), 4)!;
    // through the forest: 1 + 3 + 1 + 1 = 6; around through the gap is far longer — so it crosses
    expect(route.nodes.some((n) => map.terrain[n.cell] === F)).toBe(true);
    expect(route.cost).toBe(6);
  });

  it('cannot cross lake or sea, and a surrounded island is unreachable', () => {
    const { map, state, at } = world();
    for (let c = 0; c < 12; c++) map.terrain[at(c, 6)] = SEA;
    expect(findRoute(state, { cell: at(2, 2), bank: OPEN }, at(2, 10), 4)).toBeNull();
    map.terrain[at(6, 6)] = LAKE;
    expect(findRoute(state, { cell: at(2, 2), bank: OPEN }, at(2, 10), 4)).toBeNull();
    expect(findRoute(state, { cell: at(2, 2), bank: OPEN }, at(6, 6), 4)).toBeNull(); // the lake itself is no destination
  });

  it('mountains take the whole month: entering one spends every point', () => {
    const { map, state, at } = world();
    map.terrain[at(3, 4)] = M;
    // 2,4 → 3,4 (mountain) → 4,4
    const path = [{ cell: at(3, 4), bank: OPEN }, { cell: at(4, 4), bank: OPEN }];
    expect(stepsThisMonth(state, at(2, 4), path, 4)).toEqual({ steps: 1, left: 0 });
    expect(walkMonths(state, at(2, 4), path, 4)).toBe(2);
    const r = findRoute(state, { cell: at(2, 4), bank: OPEN }, at(4, 4), 4)!;
    expect(r.cost).toBe(3); // the mountain would cost 4 + 1; three plains hexes round it cost 3
    expect(r.nodes.some((n) => n.cell === at(3, 4))).toBe(false);
    // with no way round, the mountain is taken and costs the month
    for (let row = 0; row < 12; row++) map.terrain[at(3, row)] = M;
    const r2 = findRoute(state, { cell: at(2, 4), bank: OPEN }, at(4, 4), 4)!;
    expect(r2.nodes.some((n) => n.cell === at(3, 4))).toBe(true);
    expect(r2.months).toBe(2);
  });

  it('a unit that has not moved yet may always take one step, even into terrain dearer than its points', () => {
    const { map, state, at } = world();
    map.terrain[at(3, 4)] = F;
    expect(stepsThisMonth(state, at(2, 4), [{ cell: at(3, 4), bank: OPEN }, { cell: at(4, 4), bank: OPEN }], 2)).toEqual({ steps: 1, left: 0 });
    expect(stepsThisMonth(state, at(1, 4), [{ cell: at(2, 4), bank: OPEN }, { cell: at(3, 4), bank: OPEN }], 2)).toEqual({ steps: 1, left: 1 }); // plains 1, then forest 3 > 1 left: stop
  });
});

describe('rivers', () => {
  /** a straight river down column 5 */
  function riverWorld() {
    const w = world();
    for (let r = 0; r < 12; r++) w.map.terrain[w.at(5, r)] = R;
    return w;
  }

  it('a straight river hex has two banks; so does one at the map edge; a source is open', () => {
    const { map, state, at } = riverWorld();
    const banks = riverBanks(state, at(5, 5))!;
    expect(banks).not.toBeNull();
    expect(banks[0].length + banks[1].length).toBe(4);
    expect(riverBanks(state, at(5, 0))).not.toBeNull(); // the map edge separates the banks like water does
    map.terrain[at(5, 0)] = P; // now (5,1) is a source: one river neighbour, land all round
    expect(riverBanks(state, at(5, 1))).toBeNull();
  });

  it('cannot cross a river without a bridge — not along its reach, not at the map edge, not at its mouth', () => {
    const { map, state, at } = riverWorld();
    expect(findRoute(state, { cell: at(2, 5), bank: OPEN }, at(8, 5), 4)).toBeNull();
    for (let c = 0; c < 12; c++) map.terrain[at(c, 0)] = SEA; // the river now flows into the sea at the top
    expect(riverBanks(state, at(5, 1))).not.toBeNull(); // the mouth keeps its two banks
    expect(findRoute(state, { cell: at(2, 5), bank: OPEN }, at(8, 5), 4)).toBeNull();
  });

  it('the source hex is open: a route may cross there', () => {
    const { map, state, at } = riverWorld();
    map.terrain[at(5, 0)] = P; // cut the river short so (5,1) is a source with one river neighbour
    const r = findRoute(state, { cell: at(2, 5), bank: OPEN }, at(8, 5), 4);
    expect(r).not.toBeNull();
    expect(r!.nodes.some((n) => n.cell === at(5, 1))).toBe(true);
  });

  it('a settlement on the river is a bridge', () => {
    const { state, at } = riverWorld();
    applyCommand(state, { type: 'foundSettlement', settlement: { name: 'Ford', tier: 'village', col: 5, row: 5, population: 900, faction: 'A' } });
    const r = findRoute(state, { cell: at(2, 5), bank: OPEN }, at(8, 5), 4)!;
    expect(r).not.toBeNull();
    expect(r.nodes.some((n) => n.cell === at(5, 5))).toBe(true);
  });

  it('a unit on a bank may walk along the river and leave only onto its own bank', () => {
    const { state, at } = riverWorld();
    // stand on the river at (5,5) having come from the west (col 4)
    const from = at(4, 5);
    const banks = riverBanks(state, at(5, 5))!;
    const bank = banks[0].includes(from) ? 0 : 1;
    const steps = stepsFrom(state, { cell: at(5, 5), bank }, 4);
    const landSteps = steps.filter((s) => s.node.bank === OPEN).map((s) => s.node.cell);
    for (const c of landSteps) expect(banks[bank]).toContain(c);
    const riverSteps = steps.filter((s) => s.node.bank !== OPEN);
    expect(riverSteps.length).toBe(2); // up and down the river, bank carried over
    // and from the west bank the east bank is not reachable at all
    expect(findRoute(state, { cell: at(5, 5), bank }, at(8, 5), 4)).toBeNull();
    // but the west is
    expect(findRoute(state, { cell: at(5, 5), bank }, at(1, 5), 4)).not.toBeNull();
  });
});
