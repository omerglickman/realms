import { describe, it, expect } from 'vitest';
import { createMap, idx } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { createGameState, type GameState } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';
import { applyCommand } from '../src/sim/commands';
import { setAbandonBelow, isCastle } from '../src/sim/settlements';
import { castleAt } from '../src/sim/castles';
import { setNoise, NO_NOISE } from '../src/sim/noise';
import { setStockCaps } from '../src/sim/materials';
import { OPEN } from '../src/sim/pathfinding';
import { makeBuildOrder, makeRoadBetween, pendingSteps } from '../src/sim/workbands';
import { builtRoad } from '../src/sim/infrastructure';

setNoise(NO_NOISE);
setAbandonBelow(0);
setStockCaps(false);
const P = terrainIndex('plains');

function world() {
  const map = createMap(30, 24, P);
  const state = createGameState('orders21', map);
  const f = state.factions[state.playerFaction];
  f.treasury = 500_000; f.stock.timber = 20_000; f.stock.stone = 20_000;
  applyCommand(state, { type: 'foundSettlement', settlement: { name: 'Home', tier: 'town', col: 12, row: 10, population: 6000, faction: state.playerFaction } });
  const home = Object.values(state.settlements).find((x) => x.name === 'Home')!;
  home.food = 100_000; home.stock.timber = 1000; home.stock.stone = 1000;
  return { state, home };
}

let n = 0;
function band(state: GameState, col: number, row: number) {
  const home = Object.values(state.settlements).find((x) => x.name === 'Home')!;
  const before = new Set(Object.keys(state.units));
  applyCommand(state, { type: 'raiseUnit', spec: { type: 'workband', at: home.id, muster: [{ id: home.id, people: 300 }], provisionMonths: 12 } });
  endTurn(state); n++;
  const u = Object.values(state.units).find((x) => !before.has(x.id))!;
  const b = state.units[u.id];
  b.col = col; b.row = row; b.bank = OPEN;
  return b;
}

describe('Road between… and Castle at… (Session 21)', () => {
  it('the band walks to the nearer end of the road and lays it toward the other', () => {
    const { state } = world();
    const u = band(state, 5, 5);
    const A = idx(state.map, 8, 5), B = idx(state.map, 13, 5);
    const made = makeRoadBetween(state, u, 'dirt', A, B);
    expect(made.reason).toBeUndefined();
    expect(made.order!.route[0]).toBe(A);           // A is nearer to (5,5)
    expect(made.order!.route[made.order!.route.length - 1]).toBe(B);
    const flipped = makeRoadBetween(state, u, 'dirt', B, A);
    expect(flipped.order!.route[0]).toBe(A);        // the order of the two clicks does not matter
    expect(flipped.order!.route[flipped.order!.route.length - 1]).toBe(B);
    const far = band(state, 20, 5);
    expect(makeRoadBetween(state, far, 'dirt', A, B).order!.route[0]).toBe(B);
    expect(makeRoadBetween(state, u, 'dirt', A, A).reason).toMatch(/different/);
    applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: made.order! });
    for (let i = 0; i < 60 && state.units[u.id]?.build; i++) endTurn(state);
    expect(state.units[u.id].build).toBeNull();
    expect(builtRoad(state, A)).toBeGreaterThan(0);
    expect(builtRoad(state, B)).toBeGreaterThan(0);
    expect(pendingSteps(state, made.order!)).toHaveLength(0);
  });

  it('a castle can be ordered on a distant hex: the band walks there and builds', () => {
    const { state } = world();
    const u = band(state, 5, 5);
    const site = idx(state.map, 9, 5);
    const made = makeBuildOrder(state, u, 'castle_small', site);
    expect(made.reason).toBeUndefined();
    expect(made.order!.route).toEqual([site]);
    applyCommand(state, { type: 'orderUnit', id: u.id, order: null, build: made.order! });
    endTurn(state);
    expect(state.units[u.id].col).not.toBe(5);       // on its way
    expect(castleAt(state, site)).toBeNull();
    for (let i = 0; i < 20; i++) endTurn(state);
    const c = castleAt(state, site);
    expect(c).toBeTruthy();
    expect(isCastle(c!)).toBe(true);
    // a hex that may not hold a castle is refused with the reason, wherever it is
    const city = Object.values(state.settlements)[0];
    expect(makeBuildOrder(state, u, 'castle_small', idx(state.map, city.col, city.row)).reason).toBeTruthy();
  });
});
