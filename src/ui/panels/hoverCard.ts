// The hover card next to a settlement (Session 13 restyle): name, tier,
// people and growth, a food gauge, parent and cluster, warnings. Display only.

import type { GameState } from '../../sim/state';
import { TIERS, growthTrend, workedCellsBySettlement, type Settlement } from '../../sim/settlements';
import { totalPopulation } from '../../sim/demography';
import { planLabour, granaryTerms } from '../../sim/economy';
import { fmt, fmt1, pct, esc, tierName, foodMonths, clusterLine, projectText, gauge } from './format';

export function renderHoverCard(root: HTMLElement, state: GameState, s: Settlement): void {
  const pop = totalPopulation(s.pop);
  const parent = s.parent ? state.settlements[s.parent] : null;
  const months = foodMonths(s);
  const t = growthTrend(s);
  const worked = workedCellsBySettlement(state).get(s.id) ?? [];
  const plan = planLabour(state.map, s, worked);
  const cap = granaryTerms(plan.granaryStaffing, plan.effects).capacityMonths;
  const row = (k: string, v: string) => `<div class="pop-row"><span>${k}</span><span class="num">${v}</span></div>`;
  const c = clusterLine(state, s);
  root.innerHTML = `
    <div class="pop-head"><span class="pop-name">${esc(s.name)}</span><span class="pop-tier">${tierName(s)}</span></div>
    ${row('People', `${fmt(pop)}${t !== null ? ` <span class="dim">(${pct(t)}/yr)</span>` : ''}`)}
    ${row('Food', `${fmt1(months)} months <span class="dim">of ${cap.toFixed(0)}</span>`)}
    ${gauge(cap > 0 ? months / cap : 0, { marks: [cap > 0 ? 3 / cap : 0], title: `${fmt(s.food)} food; the mark is the 3-month reserve` })}
    ${row('Land', `${worked.length} hexes · feeds ${fmt(plan.plannedPerYear)}/yr`)}
    ${plan.privateHands > 0 ? row('Tax', `${fmt(plan.taxPerYear)} coins/yr`) : ''}
    ${row(parent ? 'Under' : 'Parent', parent ? `${esc(parent.name)} <span class="dim">(${tierName(parent)})</span>` : TIERS[s.tier].rank < 2 ? '<span class="dim">none in range</span>' : '<span class="dim">independent</span>')}
    ${c && c.root !== s.id && (parent === null || parent.id !== c.root) ? row('Cluster', esc(state.settlements[c.root].name)) : ''}
    ${s.build ? row('Building', esc(projectText(s)!)) : ''}
    ${s.upgrade ? row('Rising to', `${esc(TIERS[s.upgrade.to].name.toLowerCase())} <span class="dim">(${Math.round(100 * s.upgrade.progress)} %)</span>`) : ''}
    ${Math.abs(s.harvestFactor - 1) > 0.005 ? row('Harvest', `${Math.round(100 * s.harvestFactor)} % of normal`) : ''}
    ${s.report.epidemic ? '<div class="warnline">⚠ epidemic this year</div>' : ''}
    ${s.report.hungerDeaths > 0.5 ? `<div class="warnline">⚠ ${fmt(s.report.hungerDeaths)} starved last month</div>` : ''}
    ${plan.vacancies > 0.5 ? `<div class="warnline">⚠ ${fmt(plan.vacancies)} hands short</div>` : ''}
    <div class="pop-hint">click to open the ledger</div>
  `;
}
