// Session 11: buildings with effects, materials (cluster stockpiles), the build
// queue and the pull factor (DESIGN §3.3, §4.1, §4.2 — DECIDED by Omer 2026-11-05).
// Session 12: money costs, stockpile caps with overflow to the realm, the pull
// on prosperity (DESIGN §4.2, §4.1 — Session 11b decisions).

import { describe, it, expect, afterEach } from 'vitest';
import { createMap } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { resourceIndex } from '../src/sim/resources';
import { createGameState, serializeState, deserializeState, STATE_VERSION, type GameState } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';
import { applyCommand, factionStockKey } from '../src/sim/commands';
import { resolveAllParents, workedCellsBySettlement, BUILDINGS, TIERS, tierIndex, buildingDef, setAbandonBelow, type Settlement } from '../src/sim/settlements';
import { buildableFor, canBuild, sumEffects, monthsLeft } from '../src/sim/buildings';
import { MATERIALS, clusterStock, payFromCluster, clusterCap, realmCap, setStockCaps } from '../src/sim/materials';
import { planLabour, granaryTerms } from '../src/sim/economy';
import { totalPopulation, workingHands } from '../src/sim/demography';
import { setNoise, NO_NOISE } from '../src/sim/noise';
setNoise(NO_NOISE);
setAbandonBelow(0);

const G = terrainIndex('grassland');
const W = terrainIndex('woodland');
const F = terrainIndex('forest');
const H = terrainIndex('hills');
const R = terrainIndex('river');
const STONE = resourceIndex('stone');
afterEach(() => { setStockCaps(true); setNoise(NO_NOISE); });

function found(state: GameState, name: string, tier: string, col: number, row: number, population: number): Settlement {
  applyCommand(state, { type: 'foundSettlement', settlement: { name, tier, col, row, population } });
  return Object.values(state.settlements).find((s) => s.name === name)!;
}

function cell(state: GameState, col: number, row: number): number {
  return row * state.map.width + col;
}

/** a town on grassland with a woodland village 3 hexes away whose centre hex carries stone */
function pair(): { state: GameState; town: Settlement; village: Settlement } {
  const state = createGameState('b', createMap(30, 30, G));
  const town = found(state, 'Town', 'town', 15, 15, 9000);
  // the village's side of its ring: woodland (outside the town's 2-ring work zone), one stone hex
  for (let c = 18; c <= 20; c++) for (let r = 14; r <= 16; r++) state.map.terrain[cell(state, c, r)] = W;
  state.map.resource[cell(state, 18, 15)] = STONE;
  const village = found(state, 'Village', 'village', 18, 15, 1800);
  resolveAllParents(state);
  state.factions[state.playerFaction].treasury = 10_000; // the Session 11 cases are about materials; money is tested on its own
  return { state, town, village };
}

function run(state: GameState, months: number): void {
  for (let i = 0; i < months; i++) endTurn(state);
}

describe('buildings data', () => {
  it('every buildable building has a cost, construction time, labour and a valid minTier; mandatory ones have none', () => {
    for (const b of BUILDINGS) {
      if (b.mandatory) { expect(b.tier).toBeDefined(); expect(b.cost).toBeUndefined(); continue; }
      expect(b.minTier).toBeDefined();
      expect(() => tierIndex(b.minTier!)).not.toThrow();
      expect(b.cost).toBeDefined();
      expect(b.cost!.money!).toBeGreaterThan(0); // every building costs money (Session 11b)
      expect(b.buildMonths!).toBeGreaterThan(0);
      expect(b.buildHands!).toBeGreaterThan(0);
    }
    const villageList = buildableFor(tierIndex('village')).map((b) => b.id);
    expect(villageList).toContain('mill');
    expect(villageList).toContain('archery_range');
    expect(villageList).toContain('stables');
    expect(villageList).not.toContain('workshop');
    expect(buildableFor(tierIndex('town')).map((b) => b.id)).toContain('workshop');
    expect(buildableFor(tierIndex('town')).map((b) => b.id)).toContain('warehouse');
    expect(buildableFor(tierIndex('city')).map((b) => b.id)).toContain('citadel');
    // Workshop and Market are multipliers, not employers (Omer, Session 11b)
    expect(buildingDef('workshop').hands).toBeLessThanOrEqual(60);
    expect(buildingDef('market').hands).toBeLessThanOrEqual(60);
    expect(buildingDef('warehouse').stockCap!.timber).toBeGreaterThan(0);
  });
});

describe('gathering materials', () => {
  it('spare hands gather timber from woodland and stone from a Stone hex into the settlement\'s own stock; grassland yields nothing', () => {
    const { state, town, village } = pair();
    const plan = planLabour(state.map, village, [cell(state, 18, 15), cell(state, 19, 15), cell(state, 20, 15)]);
    expect(plan.gather.some((g) => g.kind === 'timber')).toBe(true);
    expect(plan.gather.some((g) => g.kind === 'stone')).toBe(true);
    expect(plan.idleHands).toBeGreaterThan(plan.constructionHands + plan.gatherHands - 1e-9); // gatherers are a subset of the spare hands
    run(state, 1);
    expect(village.stock.timber).toBeGreaterThan(0);
    expect(village.stock.stone).toBeCloseTo(MATERIALS.stone.perYearOnStoneHex / 12, 6);
    expect(village.report.timber).toBeCloseTo(village.stock.timber, 6);
    expect(town.stock.timber).toBe(0); // all grassland
    expect(town.stock.stone).toBe(0);
  });

  it('gathering never takes hands from food: a village short of hands gathers nothing', () => {
    const state = createGameState('g', createMap(20, 20, W));
    const village = found(state, 'Hamlet', 'village', 10, 10, 300); // 174 hands: hall 30 + granary 90 leave 54, all needed by the fields
    run(state, 1);
    expect(village.report.idleHands).toBe(0);
    expect(village.stock.timber).toBe(0);
    expect(village.report.fieldHands).toBeGreaterThan(0);
  });

  it('the cluster stockpile is the sum over members and a project pays from the builder\'s own stock first', () => {
    const { state, town, village } = pair();
    village.stock.timber = 100; village.stock.stone = 50;
    town.stock.timber = 60;
    const pool = clusterStock(state, town.id);
    expect(pool).toEqual({ timber: 160, stone: 50, goods: 0 });
    expect(clusterStock(state, village.id)).toEqual(pool);
    const paid = payFromCluster(state, town, { timber: 90, stone: 30 });
    expect(town.stock.timber).toBe(0);
    expect(village.stock.timber).toBe(70);
    expect(village.stock.stone).toBe(20);
    expect(paid).toEqual([{ id: town.id, amount: { timber: 60, stone: 0, goods: 0 } }, { id: village.id, amount: { timber: 30, stone: 30, goods: 0 } }]);
    expect(() => payFromCluster(state, town, { stone: 1000 })).toThrow(/short of 980 stone/);
  });
});

describe('build queue', () => {
  it('canBuild checks tier, duplicates, a running project, the required hex and the stockpile', () => {
    const { state, town, village } = pair();
    expect(canBuild(state, village, 'workshop').ok).toBe(false);
    expect(canBuild(state, village, 'workshop').reason).toMatch(/town or larger/);
    expect(canBuild(state, town, 'mill').reason).toMatch(/river hex/);
    expect(canBuild(state, town, 'workshop').reason).toMatch(/lacks 180 timber, 90 stone/);
    village.stock.timber = 1000; village.stock.stone = 1000;
    expect(canBuild(state, town, 'workshop').ok).toBe(true);
    applyCommand(state, { type: 'queueBuilding', id: town.id, building: 'workshop' });
    expect(canBuild(state, town, 'market').reason).toMatch(/already building Workshop/);
    expect(() => applyCommand(state, { type: 'queueBuilding', id: town.id, building: 'market' })).toThrow();
    town.build = null; town.buildings.push('workshop');
    expect(canBuild(state, town, 'workshop').reason).toBe('already built');
    // a river hex in the work zone unlocks the mill
    state.map.terrain[cell(state, 14, 15)] = R;
    expect(canBuild(state, town, 'mill').ok).toBe(true);
  });

  it('queue pays at once; cancel refunds exactly; undo of the cancel takes it back', () => {
    const { state, town, village } = pair();
    village.stock.timber = 200; village.stock.stone = 100; town.stock.timber = 100;
    const inverse = applyCommand(state, { type: 'queueBuilding', id: town.id, building: 'workshop' });
    expect(inverse.type).toBe('cancelBuilding');
    expect(town.build!.building).toBe('workshop');
    expect(clusterStock(state, town.id)).toEqual({ timber: 120, stone: 10, goods: 0 });
    expect(town.stock.timber).toBe(0); // own stock first
    const restore = applyCommand(state, inverse);
    expect(town.build).toBeNull();
    expect(town.stock.timber).toBe(100);
    expect(village.stock).toEqual({ timber: 200, stone: 100, goods: 0 });
    expect(restore.type).toBe('restoreProject');
    applyCommand(state, restore);
    expect(town.build!.building).toBe('workshop');
    expect(clusterStock(state, town.id)).toEqual({ timber: 120, stone: 10, goods: 0 });
  });

  it('a project finishes after buildMonths with enough spare hands, slower when hands are short, and is logged', () => {
    const { state, town, village } = pair();
    village.stock.timber = 1000; village.stock.stone = 1000;
    applyCommand(state, { type: 'queueBuilding', id: town.id, building: 'market' }); // 6 months, 60 hands
    expect(monthsLeft(town)).toBe(6);
    run(state, 5);
    expect(town.build).not.toBeNull();
    expect(monthsLeft(town)).toBe(1);
    run(state, 1);
    expect(town.build).toBeNull();
    expect(town.buildings).toContain('market');
    expect(state.events.some((e) => e.kind === 'built' && e.text.includes('Market'))).toBe(true);

    // a hamlet on one grassland hex among mountains (one farm hex, nothing else to work) with ~50 spare hands builds a 60-hand chapel below full speed
    const s2 = createGameState('slow', createMap(20, 20, terrainIndex('mountains')));
    s2.map.terrain[cell(s2, 10, 10)] = G;
    const hamlet = found(s2, 'Hamlet', 'village', 10, 10, 450);
    hamlet.stock.timber = 500; hamlet.stock.stone = 500;
    s2.factions[s2.playerFaction].treasury = 1000;
    // make sure the hamlet has a few spare hands but far fewer than 60
    const spare0 = planLabour(s2.map, hamlet, workedCellsBySettlement(s2).get(hamlet.id)!).idleHands;
    expect(spare0).toBeGreaterThan(0);
    expect(spare0).toBeLessThan(60);
    applyCommand(s2, { type: 'queueBuilding', id: hamlet.id, building: 'chapel' }); // 9 months at full labour
    run(s2, 9);
    expect(hamlet.build).not.toBeNull();
    expect(hamlet.build!.progress).toBeLessThan(0.9);
    expect(hamlet.build!.progress).toBeCloseTo(spare0 / 60, 1);
    expect(hamlet.report.constructionHands).toBeCloseTo(spare0, 0);
  });
});

describe('effects', () => {
  it('sumEffects scales with staffing', () => {
    const e = sumEffects([{ id: 'mill', fraction: 0.5 }, { id: 'great_granary', fraction: 1 }, { id: 'workshop', fraction: 1 }, { id: 'market', fraction: 1 }]);
    expect(e.farmingMult).toBeCloseTo(1.075, 9);
    expect(e.granaryExtraMonths).toBe(12);
    expect(e.granarySpoilageMult).toBe(0.5);
    expect(e.goodsMult).toBe(1.5);
    expect(e.salesShareBonus).toBeCloseTo(0.4, 9);
    expect(granaryTerms(1, e).capacityMonths).toBe(36);
    expect(granaryTerms(1, e).spoilage).toBeCloseTo(0.0025, 9);
  });

  it('a mill raises the harvest by 15 %; a wharf raises fishing by 50 %', () => {
    const mk = (withMill: boolean) => {
      const state = createGameState('m', createMap(20, 20, G));
      state.map.terrain[cell(state, 11, 10)] = R;
      const v = found(state, 'Mill Village', 'village', 10, 10, 1800);
      if (withMill) v.buildings.push('mill');
      run(state, 10); // through the September harvest
      return v.lastYear ? v.lastYear.produced : v.year.produced;
    };
    const a = mk(false), b = mk(true);
    // the river hex also fishes monthly; farming (6 grassland + 1 river hex) is the bulk, and only it gets the +15 %
    expect(b).toBeGreaterThan(a * 1.1);
    expect(b).toBeLessThan(a * 1.15 + 1e-6);
  });

  it('a town\'s private hands make goods on their own; a workshop makes +50 % more; a market sells more of them; goods are conserved', () => {
    const a = pair();
    run(a.state, 12);
    const plain = a.town.lastYear!.goods;
    expect(plain).toBeGreaterThan(0);
    expect(a.village.lastYear!.goods).toBe(0); // villages have spare hands, not private hands
    const b = pair();
    b.town.buildings.push('workshop');
    run(b.state, 12);
    // +50 % per private hand; the workshop's own 30 clerks are no longer private, so a hair under 1.5×
    expect(b.town.lastYear!.goods).toBeGreaterThan(plain * 1.45);
    expect(b.town.lastYear!.goods).toBeLessThanOrEqual(plain * 1.5 + 1e-6);
    const c = pair();
    c.town.buildings.push('market');
    run(c.state, 12);
    expect(c.town.lastYear!.sold).toBeGreaterThan(a.town.lastYear!.sold * 2);
    // goods made = goods sold + goods still in the cluster + goods that overflowed to the realm
    for (const x of [a, b, c]) {
      const f = x.state.factions[x.state.playerFaction];
      const made = x.town.lastYear!.goods + x.village.lastYear!.goods;
      expect(x.town.lastYear!.sold + clusterStock(x.state, x.town.id).goods + f.stock.goods + f.lastYear!.lost.goods).toBeCloseTo(made, 3);
    }
  });
});

describe('the private economy (DESIGN §4.2b)', () => {
  it('private hands are the spare hands of a town; they pay tax into the treasury scaled by the hall\'s staffing; a village pays none', () => {
    const { state, town, village } = pair();
    const f = state.factions[state.playerFaction];
    f.treasury = 0;
    const plan = planLabour(state.map, town, workedCellsBySettlement(state).get(town.id)!);
    expect(plan.privateHands).toBe(plan.idleHands);
    expect(plan.privateHands).toBeGreaterThan(1000);
    expect(plan.taxableHands).toBeCloseTo(plan.privateHands - plan.constructionHands - plan.gatherHands, 9);
    expect(plan.adminQuality).toBe(1);
    expect(plan.taxPerYear).toBeCloseTo(plan.taxableHands * 0.2, 6);
    const vplan = planLabour(state.map, village, workedCellsBySettlement(state).get(village.id)!);
    expect(vplan.privateHands).toBe(0);
    expect(vplan.taxPerYear).toBe(0);
    run(state, 1);
    expect(town.report.tax).toBeCloseTo(plan.taxPerYear / 12, 3);
    expect(village.report.tax).toBe(0);
    expect(f.treasury).toBeCloseTo(town.report.tax + town.report.sold, 6);
    expect(f.year.tax).toBeCloseTo(town.report.tax, 9);
    // an understaffed hall collects less: a town of 200 people (≈116 hands) cannot fill its 150-hand hall
    const s2 = createGameState('h', createMap(20, 20, G));
    const small = found(s2, 'Smalltown', 'town', 10, 10, 200);
    const p2 = planLabour(s2.map, small, workedCellsBySettlement(s2).get(small.id)!);
    expect(p2.adminQuality).toBeLessThan(1);
    expect(p2.adminQuality).toBeGreaterThan(0);
  });

  it('hands on the building site pay no tax: the dent is the cost of building', () => {
    const { state, town, village } = pair();
    village.stock.timber = 1000; village.stock.stone = 1000;
    const before = planLabour(state.map, town, workedCellsBySettlement(state).get(town.id)!);
    applyCommand(state, { type: 'queueBuilding', id: town.id, building: 'walls' }); // 180 hands on the site
    const during = planLabour(state.map, town, workedCellsBySettlement(state).get(town.id)!);
    expect(during.constructionHands).toBe(180);
    expect(during.privateHands).toBe(before.privateHands);
    expect(during.taxableHands).toBeCloseTo(before.taxableHands - 180, 9);
    expect(during.taxLostPerYear).toBeCloseTo(180 * 0.2, 9);
    expect(before.taxPerYear - during.taxPerYear).toBeCloseTo(180 * 0.2, 9);
  });

  it('money: queuing pays the treasury, cancel refunds it, undo takes it back; a poor treasury refuses', () => {
    const { state, town, village } = pair();
    village.stock.timber = 1000; village.stock.stone = 1000;
    const f = state.factions[state.playerFaction];
    f.treasury = 1000;
    const cost = buildingDef('market').cost!.money!;
    const inv = applyCommand(state, { type: 'queueBuilding', id: town.id, building: 'market' });
    expect(f.treasury).toBeCloseTo(1000 - cost, 9);
    expect(town.build!.paidMoney).toBe(cost);
    expect(f.year.spent).toBe(cost);
    const restore = applyCommand(state, inv);
    expect(f.treasury).toBeCloseTo(1000, 9);
    expect(f.year.spent).toBe(0);
    applyCommand(state, restore);
    expect(f.treasury).toBeCloseTo(1000 - cost, 9);
    expect(town.build!.paidMoney).toBe(cost);
    town.build = null;
    f.treasury = 100;
    const check = canBuild(state, town, 'market');
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/treasury lacks 500 coins/);
    expect(() => applyCommand(state, { type: 'queueBuilding', id: town.id, building: 'market' })).toThrow(/treasury/);
  });
});

describe('stockpile caps (DESIGN §4.2, Session 11b)', () => {
  it('a cluster\'s cap is base + per settlement + its warehouses; the realm cap is flat; caps can be switched off', () => {
    const { state, town } = pair();
    const cap = clusterCap(state, town.id);
    expect(cap.timber).toBe(MATERIALS.cap.base.timber + 2 * MATERIALS.cap.perSettlement.timber);
    expect(cap.stone).toBe(MATERIALS.cap.base.stone + 2 * MATERIALS.cap.perSettlement.stone);
    town.buildings.push('warehouse');
    expect(clusterCap(state, town.id).timber).toBe(cap.timber + buildingDef('warehouse').stockCap!.timber!);
    expect(realmCap()).toEqual(MATERIALS.realmCap);
    setStockCaps(false);
    expect(clusterCap(state, town.id).timber).toBe(Infinity);
    expect(realmCap().stone).toBe(Infinity);
  });

  it('what a cluster gathers above its cap flows to the realm each month, proportionally to who holds it; above the realm cap it is lost', () => {
    const { state, town, village } = pair();
    // no gathering, so the arithmetic is exact
    for (let c = 18; c <= 20; c++) for (let r = 14; r <= 16; r++) state.map.terrain[cell(state, c, r)] = G;
    state.map.resource[cell(state, 18, 15)] = -1;
    const cap = clusterCap(state, town.id); // 420 timber / 210 stone
    village.stock.timber = 900; town.stock.timber = 300; // pool 1200 → 780 over
    village.stock.stone = 100; // under the cap
    const f = state.factions[state.playerFaction];
    run(state, 1);
    const over = 1200 - cap.timber;
    expect(clusterStock(state, town.id).timber).toBeCloseTo(cap.timber, 6);
    expect(village.stock.timber).toBeCloseTo(900 - over * 0.75, 6);
    expect(town.stock.timber).toBeCloseTo(300 - over * 0.25, 6);
    expect(village.stock.stone).toBe(100);
    expect(f.stock.timber).toBeCloseTo(over, 6);
    expect(f.year.overflowIn.timber).toBeCloseTo(over, 6);
    expect(town.report.overflow).toBeCloseTo(over, 6);
    expect(town.year.surplusOut).toBeCloseTo(over, 6);
    // the realm cap
    f.stock.timber = MATERIALS.realmCap.timber + 500;
    run(state, 1);
    expect(f.stock.timber).toBe(MATERIALS.realmCap.timber);
    expect(f.year.lost.timber).toBeCloseTo(500, 6);
    // December closes the faction's year
    run(state, 10);
    expect(f.lastYear).not.toBeNull();
    expect(f.lastYear!.lost.timber).toBeCloseTo(500, 6);
    expect(f.year.months).toBe(0);
  });

  it('a warehouse lets the cluster keep what would have overflowed', () => {
    const { state, town, village } = pair();
    for (let c = 18; c <= 20; c++) for (let r = 14; r <= 16; r++) state.map.terrain[cell(state, c, r)] = G;
    state.map.resource[cell(state, 18, 15)] = -1;
    town.buildings.push('warehouse');
    village.stock.timber = 900; town.stock.timber = 300;
    run(state, 1);
    expect(clusterStock(state, town.id).timber).toBeCloseTo(1200, 6);
    expect(state.factions[state.playerFaction].stock.timber).toBe(0);
  });
});

describe('faction stockpile', () => {
  it('transferMaterials ships from the faction stockpile to a settlement, capped at what it holds, and inverts exactly', () => {
    const { state, town } = pair();
    const f = state.factions[state.playerFaction];
    f.stock.stone = 50;
    const inv = applyCommand(state, { type: 'transferMaterials', from: factionStockKey(f.id), to: town.id, amount: { stone: 80, timber: 10 } });
    expect(town.stock.stone).toBe(50);
    expect(f.stock.stone).toBe(0);
    expect(inv).toEqual({ type: 'transferMaterials', from: town.id, to: factionStockKey(f.id), amount: { stone: 50 } });
    applyCommand(state, inv);
    expect(f.stock.stone).toBe(50);
    expect(town.stock.stone).toBe(0);
  });
});

describe('pull factor (on prosperity — Omer, Session 11b)', () => {
  function withPull(prosperous: boolean) {
    setNoise({ ...NO_NOISE, trickleShare: 0.04, trickleMinIdle: 0.15, trickleSpread: 0, trickleRequireFedParent: true, trickleRequireProsperous: prosperous, trickleProsperousSpare: 4 });
  }

  it('a fed town with margin pulls 4 % of the village\'s idle hands with dependants; a town with a thin granary pulls nobody', () => {
    withPull(true);
    // rich town: 9,000 people on 19 grassland hexes, a full granary after the harvest → prosperous
    const a = pair();
    run(a.state, 12);
    expect(a.town.report.vacancies).toBe(0); // no vacancies — and that no longer matters
    expect(a.town.food / totalPopulation(a.town.pop) - 9).toBeGreaterThanOrEqual(4);
    expect(a.village.report.trickleOut).toBeGreaterThan(0);
    expect(a.town.report.trickleIn).toBeCloseTo(a.village.report.trickleOut, 6);
    const idle = a.village.report.idleHands, hands = a.village.report.hands;
    const expected = (0.04 * idle / hands) * (totalPopulation(a.village.pop) + a.village.report.trickleOut);
    expect(a.village.report.trickleOut).toBeCloseTo(expected, 3);

    // the same town with its granary emptied in November: fed all year (sufficiency 1) but no margin → nobody moves
    const b = pair();
    run(b.state, 11);
    b.town.food = 9 * totalPopulation(b.town.pop); // exactly enough to reach the harvest: spare 0
    run(b.state, 1);
    expect(b.town.report.sufficiency).toBeGreaterThanOrEqual(0.999);
    expect(b.village.report.trickleOut).toBe(0);
  });

  it('without the prosperity condition the old trickle moves people into any fed town', () => {
    withPull(false);
    const b = pair();
    run(b.state, 11);
    b.town.food = 9 * totalPopulation(b.town.pop);
    run(b.state, 1);
    expect(b.village.report.trickleOut).toBeGreaterThan(0);
  });
});

describe('saves', () => {
  it('a version-3 save gains stocks, projects and faction flows; a round trip keeps them', () => {
    const { state, town, village } = pair();
    village.stock.timber = 1000; village.stock.stone = 500;
    applyCommand(state, { type: 'queueBuilding', id: town.id, building: 'workshop' });
    const json = JSON.parse(serializeState(state));
    expect(json.version).toBe(STATE_VERSION);
    const back = deserializeState(JSON.stringify(json));
    expect(back.settlements[town.id].build!.building).toBe('workshop');
    expect(back.settlements[town.id].build!.paidMoney).toBe(buildingDef('workshop').cost!.money);
    expect(back.settlements[village.id].stock.timber).toBe(820);
    expect(back.factions[back.playerFaction].year.spent).toBe(buildingDef('workshop').cost!.money);
    // an old save (v3): strip the new fields
    json.version = 3;
    for (const s of Object.values(json.settlements) as { stock?: unknown; build?: unknown }[]) { delete s.stock; delete s.build; }
    for (const f of Object.values(json.factions) as { stock?: unknown; year?: unknown; lastYear?: unknown }[]) { delete f.stock; delete f.year; delete f.lastYear; }
    const old = deserializeState(JSON.stringify(json));
    expect(old.version).toBe(STATE_VERSION);
    expect(old.settlements[town.id].stock).toEqual({ timber: 0, stone: 0, goods: 0 });
    expect(old.settlements[town.id].build).toBeNull();
    expect(old.factions[old.playerFaction].stock).toEqual({ timber: 0, stone: 0, goods: 0 });
    expect(old.factions[old.playerFaction].year.tax).toBe(0);
    expect(old.factions[old.playerFaction].lastYear).toBeNull();
  });

  it('a 20-year run with building and materials is deterministic and conserves people', () => {
    const go = () => {
      const { state, town, village } = pair();
      village.stock.timber = 5000; village.stock.stone = 5000;
      applyCommand(state, { type: 'queueBuilding', id: town.id, building: 'workshop' });
      run(state, 240);
      return { pop: totalPopulation(town.pop) + totalPopulation(village.pop), stock: clusterStock(state, town.id), buildings: town.buildings.slice(), treasury: state.factions[state.playerFaction].treasury };
    };
    const a = go(), b = go();
    expect(a).toEqual(b);
    expect(a.buildings).toContain('workshop');
    expect(a.pop).toBeGreaterThan(0);
    expect(a.treasury).toBeGreaterThan(10_000); // twenty years of a town's tax
  });
});

// keep TIERS / buildingDef / workingHands referenced for the type-checker in case of future edits
void TIERS; void buildingDef; void workingHands; void F; void H;
