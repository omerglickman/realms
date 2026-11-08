import { describe, it, expect } from 'vitest';
import { createGameState, serializeState, deserializeState } from '../src/sim/state';
import { applyCommand } from '../src/sim/commands';
import { infraBrushResult, infraCellAt, emptyInfra } from '../src/sim/infrastructure';
import { terrainIndex } from '../src/sim/terrain';
import { createMap } from '../src/sim/map';
import { resourceIndex } from '../src/sim/resources';

function world() {
  const map = createMap(8, 8, terrainIndex('plains'));
  map.terrain[1 * 8 + 3] = terrainIndex('river');
  map.terrain[2 * 8 + 3] = terrainIndex('sea');
  map.terrain[3 * 8 + 1] = terrainIndex('mountains');
  map.resource[4 * 8 + 6] = resourceIndex('silver');
  map.resource[5 * 8 + 6] = resourceIndex('wine');
  return createGameState('t', map);
}

describe('editor infrastructure (Session 17)', () => {
  it('places and undoes roads, bridges, quarries and lumber camps', () => {
    const s = world();
    const plains = 4 * 8 + 4, river = 1 * 8 + 3;
    const ok = (i: number, b: Parameters<typeof infraBrushResult>[2]) => { const r = infraBrushResult(s, i, b); if (!r.ok) throw new Error(r.reason); return r.cell; };
    const inv1 = applyCommand(s, { type: 'setInfra', cells: [ok(plains, 'paved')] });
    expect(s.infra.roads[plains]).toBe(2);
    const inv2 = applyCommand(s, { type: 'setInfra', cells: [ok(river, 'bridge')] });
    expect(s.infra.bridges[river]).toBe(true);
    expect(s.infra.roads[river]).toBe(1); // a bridge carries a dirt road
    const q = 4 * 8 + 6, l = 6 * 8 + 5;
    applyCommand(s, { type: 'setInfra', cells: [ok(q, 'quarry'), ok(l, 'lumber')] });
    expect(s.infra.sites[q]).toBe('quarry');
    expect(s.infra.sites[l]).toBe('lumber');
    // erase clears everything on the hex
    applyCommand(s, { type: 'setInfra', cells: [ok(plains, 'erase')] });
    expect(infraCellAt(s, plains)).toEqual({ i: plains, road: 0, bridge: false, site: '' });
    applyCommand(s, inv2); expect(s.infra.bridges[river]).toBeUndefined(); expect(s.infra.roads[river]).toBeUndefined();
    void inv1;
  });
  it('refuses what cannot be built', () => {
    const s = world();
    const river = 1 * 8 + 3, sea = 2 * 8 + 3, plains = 4 * 8 + 4;
    expect(infraBrushResult(s, river, 'dirt').ok).toBe(false);   // a river hex needs a bridge first
    expect(infraBrushResult(s, plains, 'bridge').ok).toBe(false); // a bridge goes on a river hex
    expect(infraBrushResult(s, sea, 'dirt').ok).toBe(false);
    expect(infraBrushResult(s, sea, 'quarry').ok).toBe(false);
    expect(infraBrushResult(s, river, 'quarry').ok).toBe(false);
    expect(infraBrushResult(s, plains, 'quarry').ok).toBe(false);        // plain land, no deposit
    expect(infraBrushResult(s, 5 * 8 + 6, 'quarry').ok).toBe(false);     // wine is not mineable
    expect(infraBrushResult(s, 4 * 8 + 6, 'quarry').ok).toBe(true);      // silver is
    expect(infraBrushResult(s, 3 * 8 + 1, 'quarry').ok).toBe(true);      // mountains need no resource
    expect(infraBrushResult(s, 3 * 8 + 1, 'lumber').ok).toBe(false);     // no lumber camps on mountains
    expect(infraBrushResult(s, plains, 'lumber').ok).toBe(true);
    expect(infraBrushResult(s, 3 * 8 + 1, 'dirt').ok).toBe(true);        // a road may cross mountains
  });
  it('survives save/load and a v8 save migrates with empty sites', () => {
    const s = world();
    applyCommand(s, { type: 'setInfra', cells: [{ i: 20, road: 1, bridge: false, site: 'quarry' }] });
    const back = deserializeState(serializeState(s));
    expect(back.infra.sites[20]).toBe('quarry');
    const old = JSON.parse(serializeState(s));
    old.version = 8; delete old.infra.sites;
    const mig = deserializeState(JSON.stringify(old));
    expect(mig.infra.sites).toEqual({});
    expect(mig.infra.roads[20]).toBe(1);
    expect(emptyInfra().sites).toEqual({});
  });
});
