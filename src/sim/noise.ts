// The PROPOSED demographic-realism knobs (Session 9) in one place, read live
// from the data files so tests and the headless runner can turn them off or
// override them. All of them are zero-able; with every knob at zero the model
// is the exact deterministic one of Sessions 5–8.

import demographyData from '../../data/demography.json';
import economyData from '../../data/economy.json';

export interface NoiseKnobs {
  /** 1 = births/deaths are Poisson draws; 0 = exact fractions */
  vitalSampling: number;
  epidemicChance: number;
  epidemicDeathMultiplier: number;
  harvestSd: number;
  harvestRegionalShare: number;
  harvestRegionSize: number;
  harvestMinFactor: number;
  trickleShare: number;
  trickleMinIdle: number;
  trickleSpread: number;
  trickleRequireFedParent: boolean;
}

type D = { noise?: { vitalSampling?: number; epidemic?: { chancePerYear: number; deathMultiplier: number } }; migration: { trickle?: { sharePerYear: number; minIdleShare: number; spread: number; requireFedParent: boolean } } };
type E = { farming: { harvest: { variance?: { sd: number; regionalShare: number; regionSize: number; minFactor: number } } } };

const d = demographyData as unknown as D;
const e = economyData as unknown as E;

/** The knobs as the data files currently hold them (mutable through setNoise). */
export function noise(): NoiseKnobs {
  const v = e.farming.harvest.variance;
  const t = d.migration.trickle;
  return {
    vitalSampling: d.noise?.vitalSampling ?? 0,
    epidemicChance: d.noise?.epidemic?.chancePerYear ?? 0,
    epidemicDeathMultiplier: d.noise?.epidemic?.deathMultiplier ?? 1,
    harvestSd: v?.sd ?? 0,
    harvestRegionalShare: v?.regionalShare ?? 0,
    harvestRegionSize: v?.regionSize ?? 1,
    harvestMinFactor: v?.minFactor ?? 0.3,
    trickleShare: t?.sharePerYear ?? 0,
    trickleMinIdle: t?.minIdleShare ?? 0,
    trickleSpread: t?.spread ?? 0,
    trickleRequireFedParent: t?.requireFedParent ?? true,
  };
}

/** Override knobs in place (tests, headless A/B). Returns the previous values so they can be restored. */
export function setNoise(k: Partial<NoiseKnobs>): NoiseKnobs {
  const prev = noise();
  d.noise = d.noise ?? { vitalSampling: 0, epidemic: { chancePerYear: 0, deathMultiplier: 1 } };
  d.noise.epidemic = d.noise.epidemic ?? { chancePerYear: 0, deathMultiplier: 1 };
  e.farming.harvest.variance = e.farming.harvest.variance ?? { sd: 0, regionalShare: 0, regionSize: 1, minFactor: 0.3 };
  d.migration.trickle = d.migration.trickle ?? { sharePerYear: 0, minIdleShare: 0, spread: 0, requireFedParent: true };
  if (k.vitalSampling !== undefined) d.noise.vitalSampling = k.vitalSampling;
  if (k.epidemicChance !== undefined) d.noise.epidemic.chancePerYear = k.epidemicChance;
  if (k.epidemicDeathMultiplier !== undefined) d.noise.epidemic.deathMultiplier = k.epidemicDeathMultiplier;
  if (k.harvestSd !== undefined) e.farming.harvest.variance.sd = k.harvestSd;
  if (k.harvestRegionalShare !== undefined) e.farming.harvest.variance.regionalShare = k.harvestRegionalShare;
  if (k.harvestRegionSize !== undefined) e.farming.harvest.variance.regionSize = k.harvestRegionSize;
  if (k.harvestMinFactor !== undefined) e.farming.harvest.variance.minFactor = k.harvestMinFactor;
  if (k.trickleShare !== undefined) d.migration.trickle.sharePerYear = k.trickleShare;
  if (k.trickleMinIdle !== undefined) d.migration.trickle.minIdleShare = k.trickleMinIdle;
  if (k.trickleSpread !== undefined) d.migration.trickle.spread = k.trickleSpread;
  if (k.trickleRequireFedParent !== undefined) d.migration.trickle.requireFedParent = k.trickleRequireFedParent;
  return prev;
}

/** Every knob off: the deterministic model. */
export const NO_NOISE: NoiseKnobs = {
  vitalSampling: 0, epidemicChance: 0, epidemicDeathMultiplier: 1,
  harvestSd: 0, harvestRegionalShare: 0, harvestRegionSize: 1, harvestMinFactor: 0.3,
  trickleShare: 0, trickleMinIdle: 0, trickleSpread: 0, trickleRequireFedParent: true,
};
