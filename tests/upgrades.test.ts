import { describe, it, expect } from 'vitest';
import { createMap } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { createGameState, serializeState, deserializeState, STATE_VERSION, type GameState } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';
import { applyCommand } from '../src/sim/commands';
import { TIERS, UPGRADES, tierIndex, influenceCells, type Settlement, setAbandonBelow } from '../src/sim/settlements';
import { setNoise, NO_NOISE } from '../src/sim/noise';
import { setStockCaps } from '../src/sim/materials';
import { canUpgrade, upgradeStep } from '../src/sim/upgrades';

setNoise(NO_NOISE);
setAbandonBelow(0);
setStockCaps(false);

const P = terrainIndex('plains');

function world() {
  const state = createGameState('upgrades', createMap(20, 16, P));
  const f = state.factions[state.playerFaction];
  f.treasury = 50_000;
  return { state, f };
}
function found(state: GameState, name: string, tier: string, population: number): Settlement {
  applyCommand(state, { type: 'foundSettlement', settlement: { name, tier, col: 8, row: 8, population, faction: state.playerFaction } });
  const s = Object.values(state.settlements).find((s) => s.name === name)!;
  s.stock.timber = 1000; s.stock.stone = 1000;
  return s;
}

describe('tier upgrades (DESIGN §3.2b rule 10)', () => {
  it('data: three steps, village → town → city → metropolis, the last a placeholder', () => {
    expect(UPGRADES.map((u) => `${u.from}>${u.to}`)).toEqual(['village>town', 'town>city', 'city>metropolis']);
    expect(UPGRADES[0]).toMatchObject({ money: 10000, timber: 300, stone: 150, months: 12 });
    expect(UPGRADES[1]).toMatchObject({ money: 40000, timber: 600, stone: 600, months: 24 });
    expect(UPGRADES[2].placeholder).toBe(true);
    expect(upgradeStep(tierIndex('metropolis'))).toBeNull();
  });

  it('refuses below the gate, without money, or without materials', () => {
    const { state, f } = world();
    const s = found(state, 'Small', 'village', 1000);
    expect(canUpgrade(state, s).ok).toBe(false);
    expect(canUpgrade(state, s).reason).toMatch(/1,500 people/);
    applyCommand(state, { type: 'editSettlement', id: s.id, population: 2000 });
    f.treasury = 5000;
    expect(canUpgrade(state, s).reason).toMatch(/treasury lacks 5,000/);
    f.treasury = 50_000;
    s.stock.stone = 0;
    expect(canUpgrade(state, s).reason).toMatch(/short of 150 stone/);
    s.stock.stone = 1000;
    expect(canUpgrade(state, s).ok).toBe(true);
    expect(() => applyCommand(state, { type: 'upgradeSettlement', id: s.id })).not.toThrow();
    expect(canUpgrade(state, s).reason).toMatch(/already becoming a town/);
  });

  it('pays at once, grows over the months, and the tier, zones, hall and granary change at completion', () => {
    const { state, f } = world();
    const s = found(state, 'Rising', 'village', 2000);
    const zoneBefore = influenceCells(state.map, s).length;
    applyCommand(state, { type: 'upgradeSettlement', id: s.id });
    expect(f.treasury).toBeCloseTo(40_000);
    expect(s.stock.timber).toBeCloseTo(700);
    expect(s.stock.stone).toBeCloseTo(850);
    expect(s.upgrade?.to).toBe(tierIndex('town'));
    for (let i = 0; i < 11; i++) endTurn(state);
    expect(s.tier).toBe(tierIndex('village'));
    expect(s.upgrade?.progress).toBeCloseTo(11 / 12);
    endTurn(state);
    expect(s.upgrade).toBeNull();
    expect(s.tier).toBe(tierIndex('town'));
    expect(s.buildings).toContain(TIERS[1].hall);
    expect(s.buildings).toContain(TIERS[1].granary);
    expect(s.buildings).not.toContain(TIERS[0].hall);
    expect(influenceCells(state.map, s).length).toBeGreaterThan(zoneBefore);
    expect(state.events.some((e) => /is now a town/.test(e.text))).toBe(true);
  });

  it('cancel refunds everything; undo of a cancel takes it back; finish/revert round-trip', () => {
    const { state, f } = world();
    const s = found(state, 'Undo', 'village', 2000);
    const inv = applyCommand(state, { type: 'upgradeSettlement', id: s.id });
    const back = applyCommand(state, inv);
    expect(s.upgrade).toBeNull();
    expect(f.treasury).toBeCloseTo(50_000);
    expect(s.stock.timber).toBeCloseTo(1000);
    const again = applyCommand(state, back);
    expect(s.upgrade).not.toBeNull();
    expect(f.treasury).toBeCloseTo(40_000);
    expect(again.type).toBe('cancelUpgrade');
    const rev = applyCommand(state, { type: 'finishUpgrade', id: s.id });
    expect(s.tier).toBe(tierIndex('town'));
    applyCommand(state, rev);
    expect(s.tier).toBe(tierIndex('village'));
    expect(s.upgrade).not.toBeNull();
    expect(s.buildings).toContain(TIERS[0].hall);
  });

  it('saves and loads, and a v6 save gains the field', () => {
    const { state } = world();
    const s = found(state, 'Saved', 'town', 8000);
    applyCommand(state, { type: 'upgradeSettlement', id: s.id });
    const json = serializeState(state);
    const back = deserializeState(json);
    expect(back.version).toBe(STATE_VERSION);
    expect(Object.values(back.settlements)[0].upgrade?.to).toBe(tierIndex('city'));
    const old = JSON.parse(json);
    old.version = 6;
    for (const t of Object.values(old.settlements) as { upgrade?: unknown }[]) delete t.upgrade;
    const migrated = deserializeState(JSON.stringify(old));
    expect(Object.values(migrated.settlements)[0].upgrade).toBeNull();
  });
});
