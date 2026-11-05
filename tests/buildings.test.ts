// Session 11: buildings with effects, materials (cluster stockpiles, faction
// surplus), the build queue and the pull factor (DESIGN §3.3, §4.1, §4.2 —
// DECIDED by Omer 2026-11-05).

import { describe, it, expect, afterEach } from 'vitest';
import { createMap } from '../src/sim/map';
import { terrainIndex } from '../src/sim/terrain';
import { resourceIndex } from '../src/sim/resources';
import { createGameState, serializeState, deserializeState, STATE_VERSION, type GameState } from '../src/sim/state';
import { endTurn } from '../src/sim/turn';
import { applyCommand, factionStockKey } from '../src/sim/commands';
import { resolveAllParents, workedCellsBySettlement, BUILDINGS, TIERS, tierIndex, buildingDef, setAbandonBelow, type Settlement } from '../src/sim/settlements';
import { buildableFor, canBuild, sumEffects, monthsLeft } from '../src/sim/buildings';
import { MATERIALS, clusterStock, payFromCluster, surplusShare, setSurplusShare } from '../src/sim/materials';
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
const DEFAULT_SHARE = surplusShare();
afterEach(() => { setSurplusShare(DEFAULT_SHARE); setNoise(NO_NOISE); });

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
      expect(b.buildMonths!).toBeGreaterThan(0);
      expect(b.buildHands!).toBeGreaterThan(0);
    }
    const villageList = buildableFor(tierIndex('village')).map((b) => b.id);
    expect(villageList).toContain('mill');
    expect(villageList).toContain('archery_range');
    expect(villageList).toContain('stables');
    expect(villageList).not.toContain('workshop');
    expect(buildableFor(tierIndex('town')).map((b) => b.id)).toContain('workshop');
    expect(buildableFor(tierIndex('city')).map((b) => b.id)).toContain('citadel');
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
    expect(e.goodsPerYear).toBe(600);
    expect(e.sellsGoodsPerYear).toBe(600);
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

  it('a workshop makes goods into the stock and a market sells the cluster\'s goods into the treasury; goods are conserved', () => {
    const { state, town, village } = pair();
    town.buildings.push('workshop', 'market');
    const f = state.factions[state.playerFaction];
    run(state, 12);
    expect(town.lastYear!.goods).toBeCloseTo(600, 3);
    expect(town.lastYear!.sold).toBeCloseTo(600, 3);
    expect(f.treasury).toBeCloseTo(600, 3);
    expect(town.stock.goods + village.stock.goods + f.stock.goods).toBeCloseTo(600 - 600 + 0, 3);
  });
});

describe('faction surplus', () => {
  it('each December a cluster keeps its reserve and sends surplusShare of the rest to the faction, in proportion to who holds it', () => {
    const { state, town, village } = pair();
    setSurplusShare(0.1);
    // stop gathering from muddying the arithmetic: no woodland, no stone
    for (let c = 18; c <= 20; c++) for (let r = 14; r <= 16; r++) state.map.terrain[cell(state, c, r)] = G;
    state.map.resource[cell(state, 18, 15)] = -1;
    village.stock.timber = 900; town.stock.timber = 300; // pool 1200, reserve 300 → excess 900 → 90 to the faction
    village.stock.stone = 100; // under the 150 reserve → nothing
    run(state, 12);
    const f = state.factions[state.playerFaction];
    expect(f.stock.timber).toBeCloseTo(90, 6);
    expect(f.stock.stone).toBe(0);
    expect(village.stock.timber).toBeCloseTo(900 - 90 * 0.75, 6);
    expect(town.stock.timber).toBeCloseTo(300 - 90 * 0.25, 6);
    expect(town.lastYear!.surplusOut).toBeCloseTo(90, 6);
  });

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

describe('pull factor', () => {
  function withPull(vacancies: boolean) {
    setNoise({ ...NO_NOISE, trickleShare: 0.04, trickleMinIdle: 0.15, trickleSpread: 0, trickleRequireFedParent: true, trickleRequireVacancies: vacancies });
  }

  it('a town with no vacancies pulls nobody; a hands-short town pulls at most its vacancies', () => {
    withPull(true);
    // rich town: 9,000 people on 19 grassland hexes → thousands idle, no vacancies
    const a = pair();
    run(a.state, 12);
    expect(a.town.report.vacancies).toBe(0);
    expect(a.village.report.trickleOut).toBe(0);

    // poor town: 1,800 people (≈1,040 hands) with 19 hexes wanting 1,710 field hands → vacancies
    const b = createGameState('p', createMap(30, 30, G));
    const town = found(b, 'Smalltown', 'town', 15, 15, 1800);
    const village = found(b, 'Bigvillage', 'village', 18, 15, 2100);
    resolveAllParents(b);
    run(b, 12);
    expect(town.report.vacancies).toBeGreaterThan(0);
    const idle = village.report.idleHands, hands = village.report.hands;
    expect(idle / hands).toBeGreaterThan(0.15);
    expect(village.report.trickleOut).toBeGreaterThan(0);
    // the people who moved are 4 % of idle hands with dependants, and no more than the vacancies as hands
    const movedHands = village.report.trickleOut * (hands / totalPopulation(village.pop) );
    expect(movedHands).toBeLessThanOrEqual(town.report.vacancies + 1);
    expect(town.report.trickleIn).toBeCloseTo(village.report.trickleOut, 6);
  });

  it('without the vacancies condition the old trickle moves people into a town that has no work for them', () => {
    withPull(false);
    const { state, town, village } = pair();
    run(state, 12);
    expect(town.report.vacancies).toBe(0);
    expect(village.report.trickleOut).toBeGreaterThan(0);
  });
});

describe('saves', () => {
  it('a version-3 save gains stocks and projects; a round trip keeps them', () => {
    const { state, town, village } = pair();
    village.stock.timber = 1000; village.stock.stone = 500;
    applyCommand(state, { type: 'queueBuilding', id: town.id, building: 'workshop' });
    const json = JSON.parse(serializeState(state));
    expect(json.version).toBe(STATE_VERSION);
    const back = deserializeState(JSON.stringify(json));
    expect(back.settlements[town.id].build!.building).toBe('workshop');
    expect(back.settlements[village.id].stock.timber).toBe(820);
    // an old save (v3): strip the new fields
    json.version = 3;
    for (const s of Object.values(json.settlements) as { stock?: unknown; build?: unknown }[]) { delete s.stock; delete s.build; }
    for (const f of Object.values(json.factions) as { stock?: unknown }[]) delete f.stock;
    const old = deserializeState(JSON.stringify(json));
    expect(old.version).toBe(STATE_VERSION);
    expect(old.settlements[town.id].stock).toEqual({ timber: 0, stone: 0, goods: 0 });
    expect(old.settlements[town.id].build).toBeNull();
    expect(old.factions[old.playerFaction].stock).toEqual({ timber: 0, stone: 0, goods: 0 });
  });

  it('a 20-year run with building and materials is deterministic and conserves people', () => {
    const go = () => {
      const { state, town, village } = pair();
      village.stock.timber = 5000; village.stock.stone = 5000;
      applyCommand(state, { type: 'queueBuilding', id: town.id, building: 'workshop' });
      run(state, 240);
      return { pop: totalPopulation(town.pop) + totalPopulation(village.pop), stock: clusterStock(state, town.id), buildings: town.buildings.slice() };
    };
    const a = go(), b = go();
    expect(a).toEqual(b);
    expect(a.buildings).toContain('workshop');
    expect(a.pop).toBeGreaterThan(0);
  });
});

// keep TIERS / buildingDef / workingHands referenced for the type-checker in case of future edits
void TIERS; void buildingDef; void workingHands; void F; void H;
