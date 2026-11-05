// Settlement readouts: the one-line hover text and the detail panel (#settlement).
// Display only — reads the state and the labour plan, never changes anything.
// The numbers shown are the ones DESIGN §3.3 / §4.1 / §4.2 define: people,
// growth trend, hands (staffed / field / idle), granary months, land capacity, parent.

import type { GameState } from '../../sim/state';
import { TIERS, growthTrend, childrenOf, workedCellsBySettlement, buildingDef, type Settlement } from '../../sim/settlements';
import { totalPopulation, workingHands } from '../../sim/demography';
import { planLabour, granaryTerms, type LabourPlan } from '../../sim/economy';
import { calendar } from '../../sim/state';
import { clusterLine } from './clusterPanel';
import { buildableFor, canBuild, monthsLeft, moneyCost } from '../../sim/buildings';
import { clusterStock, MATERIAL_IDS, type Materials } from '../../sim/materials';
import type { BuildingDef } from '../../sim/settlements';

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const pct = (x: number): string => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1)} %`;

/** "120 timber · 30 stone" (goods only when present); "nothing" when empty. */
export function materialsText(m: Partial<Materials>, showZero = false): string {
  const parts = MATERIAL_IDS.filter((k) => showZero || (m[k] ?? 0) >= 0.5).map((k) => `${fmt(m[k] ?? 0)} ${k}`);
  return parts.length ? parts.join(' · ') : 'nothing';
}

/** "400 coins · 90 timber · 30 stone" — the full price of a building (Session 12). */
export function costText(def: BuildingDef): string {
  const money = moneyCost(def);
  const mats = materialsText(def.cost ?? {});
  return (money > 0 ? `${fmt(money)} coins` : '') + (money > 0 && mats !== 'nothing' ? ' · ' : '') + (mats !== 'nothing' ? mats : money > 0 ? '' : 'free');
}

/** "Mill — 3 of 6 months" for a settlement's project. */
export function projectText(s: Settlement): string | null {
  if (!s.build) return null;
  const def = buildingDef(s.build.building);
  const left = monthsLeft(s) ?? 0;
  return `${def.name} — ${Math.round(100 * s.build.progress)} % done, ~${left} month${left === 1 ? '' : 's'} left`;
}

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

/** The small hover card next to a settlement (Omer 2026-11-05): name, tier, people, growth, food, parent. */
export function renderPopover(root: HTMLElement, state: GameState, s: Settlement): void {
  const pop = totalPopulation(s.pop);
  const parent = s.parent ? state.settlements[s.parent] : null;
  const months = foodMonths(s);
  const t = growthTrend(s);
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const row = (k: string, v: string) => `<div class="pop-row"><span>${k}</span><span>${v}</span></div>`;
  root.innerHTML = `
    <div><span class="pop-name">${esc(s.name)}</span><span class="pop-tier">${tierName(s)}</span></div>
    ${row('People', fmt(pop))}
    ${row('Growth', t === null ? '— (new)' : `${pct(t)} / yr`)}
    ${row('Food', `${months.toFixed(1)} months <span class="dim">(${fmt(s.food)})</span>`)}
    ${row('Subordinate to', parent ? `${esc(parent.name)} <span class="dim">(${tierName(parent)})</span>` : TIERS[s.tier].rank < 2 ? '<span class="dim">none in range</span>' : '<span class="dim">independent</span>')}
    ${(() => { const c = clusterLine(state, s); return c ? row('Cluster', esc(c.text)) : ''; })()}
    ${s.build ? row('Building', esc(projectText(s)!)) : ''}
    ${Math.abs(s.harvestFactor - 1) > 0.005 ? row('Harvest this year', `${Math.round(100 * s.harvestFactor)} % of normal`) : ''}
    ${s.report.epidemic ? '<div class="warn">⚠ epidemic this year</div>' : ''}
    ${s.report.hungerDeaths > 0.5 ? `<div class="warn">⚠ ${fmt(s.report.hungerDeaths)} starved last month</div>` : ''}
    <div class="pop-hint">click for details</div>
  `;
}

export interface PanelHost {
  onRename(id: string, name: string): void;
  onSetPopulation(id: string, population: number): void;
  onRemove(id: string): void;
  onFocus(id: string): void;
  onCluster(root: string): void;
  onClose(): void;
  /** player actions (Session 11): start / cancel a building */
  onBuild(id: string, building: string): void;
  onCancelBuild(id: string): void;
}

/** Fill #settlement with the details of `s`. */
export function renderPanel(root: HTMLElement, state: GameState, s: Settlement, host: PanelHost, editing: boolean): void {
  const pop = totalPopulation(s.pop);
  const hands = workingHands(s.pop);
  const worked = workedCellsBySettlement(state).get(s.id) ?? [];
  const plan: LabourPlan = planLabour(state.map, s, worked);
  const g = granaryTerms(plan.granaryStaffing, plan.effects);
  const pool = clusterStock(state, s.id);
  const options = buildableFor(s.tier).filter((b) => !s.buildings.includes(b.id)).map((b) => ({ def: b, check: canBuild(state, s, b.id, worked) }));
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
    ['Last year', r.births || r.deaths ? `${fmt(r.births)} born, ${fmt(r.deaths)} died` + (r.epidemic ? ' <b class="warn">(epidemic)</b>' : '') + (r.trickleOut > 0.5 ? `, ${fmt(r.trickleOut)} moved to town` : '') + (r.trickleIn > 0.5 ? `, ${fmt(r.trickleIn)} arrived from the countryside` : '') : '<span class="dim">no year-end yet</span>'],
    ['Harvest', Math.abs(s.harvestFactor - 1) > 0.005 ? `${Math.round(100 * s.harvestFactor)} % of a normal year` : 'a normal year'],
    ['Granary', `${months.toFixed(1)} months <span class="dim">(${fmt(s.food)} food · holds ${cap.toFixed(0)} mo · spoils ${(100 * g.spoilage).toFixed(1)} %/mo)</span>`],
    ['Hands', `${fmt(plan.staffedHands)} in buildings · ${fmt(plan.fieldHands)} in the fields · <b>${fmt(plan.idleHands)} ${plan.privateHands > 0 ? 'private' : 'spare'}</b>` + (plan.constructionHands > 0.5 || plan.gatherHands > 0.5 ? ` <span class="dim">(${plan.constructionHands > 0.5 ? `${fmt(plan.constructionHands)} building` : ''}${plan.constructionHands > 0.5 && plan.gatherHands > 0.5 ? ', ' : ''}${plan.gatherHands > 0.5 ? `${fmt(plan.gatherHands)} gathering` : ''})</span>` : '') + (plan.vacancies > 0.5 ? ` · <b class="warn">${fmt(plan.vacancies)} hands short</b>` : '')],
    ...(plan.privateHands > 0 ? [['Tax base', `${fmt(plan.taxableHands)} private hands → <b>${fmt(plan.taxPerYear)} coins</b> and ${fmt(plan.goodsPerYear)} goods a year` + (plan.taxLostPerYear > 0.5 ? ` <span class="warn">· −${fmt(plan.taxLostPerYear)} coins/yr while ${fmt(plan.privateHands - plan.taxableHands)} build or gather</span>` : '') + (plan.adminQuality < 0.999 ? ` <span class="dim">· administration ${Math.round(100 * plan.adminQuality)} % (hall understaffed)</span>` : '') + (plan.salesSharePerYear > 0 ? ` <span class="dim">· sells ${Math.round(100 * plan.salesSharePerYear)} % of the cluster's goods a year</span>` : '')] as [string, string]] : []),
    ['Land', `${worked.length} hexes worked · feeds ${fmt(plan.plannedPerYear)} / yr now, ${fmt(plan.landCapacity)} at full labour`],
    ['Subordinate to', parent ? `<a href="#" data-focus="${parent.id}">${esc(parent.name)}</a> (${tierName(parent)})` : TIERS[s.tier].rank < 2 ? '<span class="dim">nobody in range</span>' : '<span class="dim">— (independent)</span>'],
    ['Dependants', children.length ? children.map((c) => `<a href="#" data-focus="${c.id}">${esc(c.name)}</a>`).join(', ') : '<span class="dim">none</span>'],
    ['Cluster', (() => { const c = clusterLine(state, s); return c ? `<a href="#" data-cluster="${c.root}">${esc(c.text)}</a>` : '<span class="dim">—</span>'; })()],
    ['Buildings', plan.buildings.map((b) => `<span title="${esc(buildingDef(b.id).blurb ?? '')}">${esc(buildingDef(b.id).name)}</span> <span class="dim">${Math.round(100 * b.fraction)} %</span>`).join(' · ') + (s.build ? `<div class="project">⚒ ${esc(projectText(s)!)} <span class="dim">(${fmt(plan.constructionHands)} of ${fmt(buildingDef(s.build.building).buildHands ?? 0)} hands)</span> <button id="sp-cancel" class="small">Cancel</button></div>` : '')],
    ['Materials', `own ${materialsText(s.stock)} <span class="dim">· cluster ${materialsText(pool)}</span>` + (r.timber + r.stone + r.goods > 0.5 ? ` <span class="dim">· last month +${materialsText({ timber: r.timber, stone: r.stone, goods: r.goods })}${r.sold > 0.5 ? `, sold goods for ${fmt(r.sold)}` : ''}${r.tax > 0.5 ? `, ${fmt(r.tax)} coins in tax` : ''}</span>` : '')],
    ['Last month', `${r.produced ? `+${fmt(r.produced)} grown` : 'nothing grown'}, ${fmt(r.consumed)} eaten` + (r.titheIn > 0.5 ? `, +${fmt(r.titheIn)} tithe` : '') + (r.received ? `, +${fmt(r.received)} received` : '') + (r.titheOut > 0.5 ? `, ${fmt(r.titheOut)} tithed` : '') + (r.sent ? `, ${fmt(r.sent)} sent up` : '') + (r.hungerDeaths > 0.5 ? `, <b class="warn">${fmt(r.hungerDeaths)} starved</b>` : '') + (r.migrantsOut > 0.5 ? `, ${fmt(r.migrantsOut)} left` : '') + (r.migrantsIn > 0.5 ? `, ${fmt(r.migrantsIn)} arrived` : '')],
    ['Founded', `${founded.monthName}, year ${founded.year} · hex (${s.col}, ${s.row})`],
  ];

  root.innerHTML = `
    <div class="panel-head">
      <input id="sp-name" type="text" value="${esc(s.name)}" ${editing ? '' : 'readonly'} />
      <span class="tier">${tierName(s)}</span>
      <button id="sp-close" title="Close">×</button>
    </div>
    <table class="kv">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>
    ${options.length ? `<div class="build-row">
      <label>Build <select id="sp-build">${options.map((o) => `<option value="${o.def.id}" ${o.check.ok ? '' : 'class="dim"'}>${esc(o.def.name)} — ${costText(o.def)}, ${o.def.buildMonths} mo${o.check.ok ? '' : ` (${esc(o.check.reason ?? '')})`}</option>`).join('')}</select></label>
      <button id="sp-build-go" ${s.build ? 'disabled title="one project at a time"' : ''}>Start</button>
      <div id="sp-build-blurb" class="dim blurb"></div>
    </div>` : ''}
    ${editing ? `<div class="row"><label class="edit-pop">Set people <input id="sp-pop" type="number" min="1" step="100" value="${Math.round(pop)}" /> <button id="sp-pop-apply">Apply</button></label><button id="sp-remove" class="danger">Remove settlement</button></div>` : ''}
  `;
  const name = root.querySelector<HTMLInputElement>('#sp-name')!;
  if (editing) {
    name.addEventListener('change', () => { const v = name.value.trim(); if (v && v !== s.name) host.onRename(s.id, v); });
    const popInput = root.querySelector<HTMLInputElement>('#sp-pop')!;
    const apply = () => { const v = Math.round(Number(popInput.value)); if (v > 0 && Math.abs(v - pop) >= 0.5) host.onSetPopulation(s.id, v); };
    root.querySelector<HTMLButtonElement>('#sp-pop-apply')!.addEventListener('click', apply);
    popInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
    root.querySelector<HTMLButtonElement>('#sp-remove')!.addEventListener('click', () => host.onRemove(s.id));
  }
  root.querySelector<HTMLButtonElement>('#sp-close')!.addEventListener('click', () => host.onClose());
  root.querySelector<HTMLButtonElement>('#sp-cancel')?.addEventListener('click', () => host.onCancelBuild(s.id));
  const sel = root.querySelector<HTMLSelectElement>('#sp-build');
  if (sel) {
    const go = root.querySelector<HTMLButtonElement>('#sp-build-go')!;
    const blurb = root.querySelector<HTMLElement>('#sp-build-blurb')!;
    const update = () => {
      const o = options.find((x) => x.def.id === sel.value);
      if (!o) return;
      blurb.textContent = (o.def.blurb ?? '') + (o.def.hands ? ` Needs ${o.def.hands} hands to run.` : '') + (o.def.buildHands ? ` ${o.def.buildHands} hands build it${plan.privateHands > 0 ? ` (−${fmt(o.def.buildHands * (plan.taxableHands > 0 ? plan.taxPerYear / plan.taxableHands : 0))} coins/yr of tax while they do)` : ''}.` : '') + (o.check.ok ? '' : ` — ${o.check.reason}`);
      go.disabled = !!s.build || !o.check.ok;
    };
    sel.addEventListener('change', update);
    go.addEventListener('click', () => { if (!go.disabled) host.onBuild(s.id, sel.value); });
    update();
  }
  root.querySelectorAll<HTMLAnchorElement>('a[data-focus]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); host.onFocus(a.dataset.focus!); });
  });
  root.querySelectorAll<HTMLAnchorElement>('a[data-cluster]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); host.onCluster(a.dataset.cluster!); });
  });
}
