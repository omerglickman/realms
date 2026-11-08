// The food jobs a hex offers (DESIGN §3.1, §4.2). Split out of economy.ts in
// Session 18 so settlements.ts (castles choose the hexes they work by yield)
// can use it without a circular import; economy.ts re-exports everything here.

import economyData from '../../data/economy.json';
import type { MapData } from './map';
import { TERRAIN } from './terrain';
import { RESOURCES } from './resources';
import { isFishable } from './water';

const ECONOMY = economyData;

const FISH_RES = RESOURCES.findIndex((r) => r.id === 'fish');
const GAME_RES = RESOURCES.findIndex((r) => r.id === 'game');

export type JobKind = 'farm' | 'herd' | 'fish' | 'hunt';
export interface Job {
  kind: JobKind;
  cell: number;
  /** people fed per year at full labour */
  fedPerYear: number;
  /** hands for full labour */
  hands: number;
}

/** The food jobs a single hex offers (DESIGN §3.1, §4.2). */
export function hexJobs(map: MapData, cell: number): Job[] {
  const t = TERRAIN[map.terrain[cell]];
  const res = map.resource[cell];
  const jobs: Job[] = [];
  if (t.fertility > 0) {
    jobs.push({ kind: 'farm', cell, fedPerYear: ECONOMY.farming.fedPerYearByFertility[t.fertility], hands: ECONOMY.farming.hands });
  }
  if (t.pasture > 0) {
    jobs.push({ kind: 'herd', cell, fedPerYear: ECONOMY.herding.fedPerYearByPasture[t.pasture], hands: ECONOMY.herding.hands });
  }
  if (isFishable(map, cell)) {
    if (res === FISH_RES) jobs.push({ kind: 'fish', cell, fedPerYear: ECONOMY.fishing.withFish.fedPerYear, hands: ECONOMY.fishing.withFish.hands });
    else jobs.push({ kind: 'fish', cell, fedPerYear: ECONOMY.fishing.fedPerYear, hands: ECONOMY.fishing.hands });
  }
  if (res === GAME_RES) {
    jobs.push({ kind: 'hunt', cell, fedPerYear: ECONOMY.hunting.fedPerYear, hands: ECONOMY.hunting.hands });
  }
  return jobs;
}


