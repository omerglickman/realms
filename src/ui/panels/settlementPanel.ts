// Settlement readouts: the one-line hover text and the detail panel (#settlement).
// Display only — reads the state and the labour plan, never changes anything.
// The numbers shown are the ones DESIGN §3.3 / §4.1 / §4.2 define: people,
// growth trend, hands (staffed / field / idle), granary months, land capacity, parent.

import type { GameState } from '../../sim/state';
import { TIERS, growthTrend, childrenOf, workedCellsBySettlement, buildingDef, type Settlement } from '../../sim/settlements';
import { totalPopulation, workingHands } from '../../sim/demography';
import { planLabour, granaryTerms, type LabourPlan } from '../../sim/economy';
import { calendar } from '../../sim/state';

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const pct = (x: number): string => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1)} %`;

export function tierName(s: Settlement): string {
  return TIERS[s.tier].name;
}

/** Months of food in the granary at the current consumption. */
export function foodMonths(s: Settlement): number {
  const pop = totalPopulation(s.pop);
  return pop > 0 ? s.food / pop : 0;
}

function trendText(s: Settlement): string {
  const t = growthTrend(s);
  return t === null ? 'trend —' : `${pct(t)}/yr`;
}

/** One line for the HUD when the cursor is on a settlement. */
export function hoverLine(state: GameState, s: Settlement): string {
  const pop = totalPopulation(s.pop);
  const parent = s.parent ? state.settlements[s.parent] : null;
  const months = foodMonths(s);
  const parts = [
    `${s.name} (${tierName(s)})`,
    `${fmt(pop)} people`,
    trendText(s),
    `food ${months.toFixed(1)} mo (${fmt(s.food)})`,
    parent ? `under ${parent.name}` : (TIERS[s.tier].rank < 2 ? 'no parent' : 'independent'),
  ];
  if (s.report.hungerDeaths > 0.5) parts.push(`⚠ hunger`);
  return parts.join(' · ');
}

export interface PanelHost {
  onRename(id: string, name: string): void;
  onRemove(id: string): void;
  onFocus(id: string): void;
  onClose(): void;
}

/** Fill #settlement with the details of `s`. */
export function renderPanel(root: HTMLElement, state: GameState, s: Settlement, host: PanelHost, editing: boolean): void {
  const pop = totalPopulation(s.pop);
  const hands = workingHands(s.pop);
  const worked = workedCellsBySettlement(state).get(s.id) ?? [];
  const plan: LabourPlan = planLabour(state.map, s, worked);
  const g = granaryTerms(plan.granaryStaffing);
  const months = foodMonths(s);
  const cap = g.capacityMonths;
  const parent = s.parent ? state.settlements[s.parent] : null;
  const children = childrenOf(state, s.id);
  const founded = calendar(s.foundedTurn);
  const trend = growthTrend(s);
  const sinceFounding = s.popHistory.length ? pop / s.popHistory[0] - 1 : null;
  const r = s.report;
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

  const rows: [string, string][] = [
    ['People', `${fmt(pop)} <span class="dim">(${fmt(hands)} hands)</span>`],
    ['Growth', trend === null ? '<span class="dim">— (needs two year-ends)</span>' : `${pct(trend)} per year` + (sinceFounding !== null && s.popHistory.length > 1 ? ` <span class="dim">· ${pct(sinceFounding)} since founding</span>` : '')],
    ['Last year', r.births || r.deaths ? `${fmt(r.births)} born, ${fmt(r.deaths)} died` : '<span class="dim">no year-end yet</span>'],
    ['Granary', `${months.toFixed(1)} months <span class="dim">(${fmt(s.food)} food · holds ${cap.toFixed(0)} mo · spoils ${(100 * g.spoilage).toFixed(1)} %/mo)</span>`],
    ['Hands', `${fmt(plan.staffedHands)} in buildings · ${fmt(plan.fieldHands)} in the fields · <b>${fmt(plan.idleHands)} idle</b>`],
    ['Land', `${worked.length} hexes worked · feeds ${fmt(plan.plannedPerYear)} / yr now, ${fmt(plan.landCapacity)} at full labour`],
    ['Subordinate to', parent ? `<a href="#" data-focus="${parent.id}">${esc(parent.name)}</a> (${tierName(parent)})` : TIERS[s.tier].rank < 2 ? '<span class="dim">nobody in range</span>' : '<span class="dim">— (independent)</span>'],
    ['Dependants', children.length ? children.map((c) => `<a href="#" data-focus="${c.id}">${esc(c.name)}</a>`).join(', ') : '<span class="dim">none</span>'],
    ['Buildings', plan.buildings.map((b) => `${esc(buildingDef(b.id).name)} <span class="dim">${Math.round(100 * b.fraction)} %</span>`).join(' · ')],
    ['Last month', `${r.produced ? `+${fmt(r.produced)} grown` : 'nothing grown'}, ${fmt(r.consumed)} eaten` + (r.received ? `, +${fmt(r.received)} received` : '') + (r.sent ? `, ${fmt(r.sent)} sent up` : '') + (r.hungerDeaths > 0.5 ? `, <b class="warn">${fmt(r.hungerDeaths)} starved</b>` : '') + (r.migrantsOut > 0.5 ? `, ${fmt(r.migrantsOut)} left` : '') + (r.migrantsIn > 0.5 ? `, ${fmt(r.migrantsIn)} arrived` : '')],
    ['Founded', `${founded.monthName}, year ${founded.year} · hex (${s.col}, ${s.row})`],
  ];

  root.innerHTML = `
    <div class="panel-head">
      <input id="sp-name" type="text" value="${esc(s.name)}" ${editing ? '' : 'readonly'} />
      <span class="tier">${tierName(s)}</span>
      <button id="sp-close" title="Close">×</button>
    </div>
    <table class="kv">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>
    ${editing ? `<div class="row"><button id="sp-remove" class="danger">Remove settlement</button></div>` : ''}
  `;
  const name = root.querySelector<HTMLInputElement>('#sp-name')!;
  if (editing) {
    name.addEventListener('change', () => { const v = name.value.trim(); if (v && v !== s.name) host.onRename(s.id, v); });
    root.querySelector<HTMLButtonElement>('#sp-remove')!.addEventListener('click', () => host.onRemove(s.id));
  }
  root.querySelector<HTMLButtonElement>('#sp-close')!.addEventListener('click', () => host.onClose());
  root.querySelectorAll<HTMLAnchorElement>('a[data-focus]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); host.onFocus(a.dataset.focus!); });
  });
}
