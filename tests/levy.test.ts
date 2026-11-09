import { describe, it, expect } from 'vitest';
import { createMap } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { createGameState, type GameState } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';
import { applyCommand } from '../src/sim/commands';
import { setAbandonBelow, isCastle, type Settlement } from '../src/sim/settlements';
import { setNoise, NO_NOISE } from '../src/sim/noise';
import { setStockCaps } from '../src/sim/materials';
import { totalPopulation } from '../src/sim/demography';
import { OPEN } from '../src/sim/pathfinding';
import { type Unit, disbandTarget } from '../src/sim/units';
import { fortAt, canFortify } from '../src/sim/forts';
import { garrisonOf, garrisonShare, isMilitary } from '../src/sim/garrison';
import { CASTLES } from '../src/sim/castles';

setNoise(NO_NOISE);
setAbandonBelow(0);
setStockCaps(false);

const P = terrainIndex('plains');

function world() {
  const map = createMap(30, 24, P);
  const state = createGameState('levy', map);
  const f = state.factions[state.playerFaction];
  f.treasury = 500_000; f.stock.timber = 20_000; f.stock.stone = 20_000;
  return { state, f };
}

function found(state: GameState, name: string, tier: string, col: number, row: number, population = 0): Settlement {
  applyCommand(state, { type: 'foundSettlement', settlement: { name, tier, col, row, population, faction: state.playerFaction } });
  const s = Object.values(state.settlements).find((x) => x.name === name)!;
  s.stock.timber = 1000; s.stock.stone = 1000;
  if (!isCastle(s)) s.food = 100_000;
  return s;
}

function levy(state: GameState, home: Settlement, people = 200): Unit {
  applyCommand(state, { type: 'raiseUnit', spec: { type: 'levy', at: home.id, muster: [{ id: home.id, people }], provisionMonths: 3 } });
  const u = Object.values(state.units).find((x) => x.type === 'levy')!;
  endTurn(state);
  const b = state.units[u.id];
  b.bank = OPEN;
  return b;
}

describe('the levy (DESIGN §3.2b rule 9, Session 19)', () => {
  it('is enabled and takes men aged 15–44 only', () => {
    const { state } = world();
    const home = found(state, 'Home', 'town', 12, 10, 6000);
    const before = totalPopulation(home.pop);
    applyCommand(state, { type: 'raiseUnit', spec: { type: 'levy', at: home.id, muster: [{ id: home.id, people: 200 }], provisionMonths: 3 } });
    const u = Object.values(state.units).find((x) => x.type === 'levy')!;
    expect(isMilitary(u)).toBe(true);
    expect(u.home).toBe(home.id);
    expect(u.pop.f.every((x) => x === 0)).toBe(true);
    expect(totalPopulation(u.pop)).toBeCloseTo(200, 3);
    expect(totalPopulation(home.pop)).toBeCloseTo(before - 200, 3);
  });

  it('is paid a coin a man a month from the treasury, and the year ledger shows it', () => {
    const { state, f } = world();
    const home = found(state, 'Home', 'town', 12, 10, 6000);
    const u = levy(state, home, 200);
    const people = totalPopulation(u.pop);
    const pay0 = f.year.pay;
    endTurn(state);
    expect(f.year.pay - pay0).toBeCloseTo(people, 3);
    expect(state.units[u.id].report.pay).toBeCloseTo(people, 3);
  });

  it('disbanding walks home from any distance and puts the men back', () => {
    const { state } = world();
    const home = found(state, 'Home', 'town', 12, 10, 6000);
    const u = levy(state, home, 200);
    u.col = 24; u.row = 20; // far outside the usual disband reach
    const d = disbandTarget(state, u);
    expect(d.ok).toBe(true);
    expect(d.target!.id).toBe(home.id);
    const popAway = totalPopulation(home.pop);
    applyCommand(state, { type: 'disbandUnit', id: u.id });
    expect(state.units[u.id]).toBeTruthy(); // still walking
    for (let i = 0; i < 60 && state.units[u.id]; i++) endTurn(state);
    expect(state.units[u.id]).toBeUndefined();
    expect(totalPopulation(home.pop)).toBeGreaterThan(popAway + 150);
  });

  it('never disbands into a castle (it holds no residents)', () => {
    const { state } = world();
    const home = found(state, 'Home', 'town', 12, 10, 6000);
    const keep = found(state, 'Keep', 'small_castle', 16, 10);
    const u = levy(state, home, 200);
    u.col = keep.col; u.row = keep.row;
    const d = disbandTarget(state, u);
    expect(d.ok).toBe(true);
    expect(d.target!.id).toBe(home.id);
  });

  it('fortifies the ground it stands on; undo gives the timber back exactly', () => {
    const { state, f } = world();
    const home = found(state, 'Home', 'town', 12, 10, 6000);
    const u = levy(state, home, 200);
    u.col = 20; u.row = 18;
    expect(canFortify(state, u).ok).toBe(true);
    const timber = f.stock.timber + home.stock.timber;
    const inv = applyCommand(state, { type: 'fortify', unitId: u.id });
    expect(fortAt(state, 20, 18)).toBeTruthy();
    const after = f.stock.timber + home.stock.timber;
    expect(after).toBeLessThanOrEqual(timber - CASTLES.fort.fortifyTimber + 1e-6);
    applyCommand(state, inv);
    expect(fortAt(state, 20, 18)).toBeNull();
    expect(f.stock.timber + home.stock.timber).toBeCloseTo(timber, 6);
  });

  it('a garrison inside its castle eats from the castle reserve, not its own bags', () => {
    const { state } = world();
    const home = found(state, 'Home', 'town', 12, 10, 6000);
    const keep = found(state, 'Keep', 'small_castle', 13, 10);
    endTurn(state);
    expect(keep.castle!.garrisonCapacity).toBeGreaterThan(0);
    const u = levy(state, home, 100);
    u.col = keep.col; u.row = keep.row;
    keep.food = 10_000;
    const g = garrisonOf(state, keep);
    expect(g.inside).toBeGreaterThan(0);
    const share = garrisonShare(state, u)!;
    expect(share.castle.id).toBe(keep.id);
    const bags = state.units[u.id].provisions;
    const reserve = keep.food;
    const inside = share.inside;
    endTurn(state);
    const after = state.units[u.id];
    expect(after.report.garrison?.castle).toBe(keep.id);
    expect(keep.food).toBeLessThan(reserve);
    expect(after.provisions).toBeGreaterThanOrEqual(bags - (totalPopulation(after.pop) * (1 - inside)) - 1e-6);
  });
});
