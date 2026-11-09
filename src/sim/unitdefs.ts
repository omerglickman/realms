// The unit type table, split out of units.ts so garrison.ts / forts.ts can read it without a cycle.
import unitData from '../../data/units.json';
import type { UnitTypeDef } from './units';

export function unitTypeDefOf(id: string): UnitTypeDef {
  const d = (unitData as unknown as { types: UnitTypeDef[] }).types.find((t) => t.id === id);
  if (!d) throw new Error(`Unknown unit type "${id}"`);
  return d;
}
