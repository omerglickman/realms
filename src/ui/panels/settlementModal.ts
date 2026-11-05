// The settlement ledger (Session 13): one modal, five pages — Overview,
// People, Land & Food, Economy, Buildings. Display only, except the player
// actions it forwards (build / cancel, and the editor's rename / people / remove).

import type { GameState } from '../../sim/state';
import { calendar } from '../../sim/state';
import { TIERS, growthTrend, childrenOf, workedCellsBySettlement, buildingDef, type Settlement } from '../../sim/settlements';
import { totalPopulation, workingHands, recruitableMen, fertileWomen, DEMOGRAPHY, BANDS, granaryBrakeFactor } from '../../sim/demography';
import { planLabour, granaryTerms, monthsUntilHarvest, forecastBeforeHarvest, monthlyProduction, taxRate, titheShare, type LabourPlan } from '../../sim/economy';
import { buildableFor, canBuild, moneyCost } from '../../sim/buildings';
import { clusterStock, clusterCap, MATERIAL_IDS } from '../../sim/materials';
import { TERRAIN } from '../../sim/terrain';
import { resourceByIndex } from '../../sim/resources';
import { getTerrain, getResource } from '../../sim/map';
import { fmt, fmt1, pct, signed, esc, tierName, tierGlyph, foodMonths, clusterLine, projectText, gauge, hbar, stack, stat, kv, ICON, jobIcon, jobName, sparkSvg } from './format';
import type { ModalSpec } from './modal';

export interface SettlementHost {
  onRename(id: string, name: string): void;
  onSetPopulation(id: string, population: number): void;
  onRemove(id: string): void;
  onBuild(id: string, building: string): void;
  onCancelBuild(id: string): void;
}

export const SETTLEMENT_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'people', label: 'People' },
  { id: 'land', label: 'Land & Food' },
  { id: 'economy', label: 'Economy' },
  { id: 'buildings', label: 'Buildings' },
];

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

interface Ctx {
  state: GameState;
  s: Settlement;
  plan: LabourPlan;
  worked: number[];
  pop: number;
  hands: number;
  month: number;
}

/** Build the modal spec for settlement `s` on page `tab`. */
export function settlementSpec(state: GameState, s: Settlement, tab: string, editing: boolean): ModalSpec {
  const worked = workedCellsBySettlement(state).get(s.id) ?? [];
  const plan = planLabour(state.map, s, worked);
  const ctx: Ctx = { state, s, plan, worked, pop: totalPopulation(s.pop), hands: workingHands(s.pop), month: calendar(state.turn).month };
  const parent = s.parent ? state.settlements[s.parent] : null;
  const c = clusterLine(state, s);
  const cal = calendar(state.turn);
  const subBits = [
    parent ? `under <a href="#" data-focus="${parent.id}">${esc(parent.name)}</a> (${tierName(parent).toLowerCase()})` : TIERS[s.tier].rank < 2 ? '<span class="dim">no parent in range</span>' : 'independent',
    c ? `<a href="#" data-cluster="${c.root}">${esc(c.text)}</a>` : '',
    `hex (${s.col}, ${s.row})`,
  ].filter(Boolean);
  const body =
    tab === 'people' ? peoplePage(ctx) :
    tab === 'land' ? landPage(ctx) :
    tab === 'economy' ? economyPage(ctx) :
    tab === 'buildings' ? buildingsPage(ctx) :
    overviewPage(ctx);
  const foot = editing ? `<span class="dim">Editor:</span> <label>Set people <input id="sp-pop" type="number" min="1" step="100" value="${Math.round(ctx.pop)}" /></label> <button id="sp-pop-apply" class="btn small">Apply</button><span class="spacer"></span><button id="sp-remove" class="btn small danger">Remove settlement</button>` : undefined;
  return {
    title: `<input id="sp-name" type="text" value="${esc(s.name)}" ${editing ? '' : 'readonly'} />`,
    badge: tierName(s),
    stripe: state.factions[s.faction ?? '']?.color ?? '#4a2f1a',
    sub: subBits.join(' · '),
    right: `${cal.monthName}, year ${cal.year}`,
    tabs: SETTLEMENT_TABS,
    tab,
    body,
    foot,
  };
}

/** Wire the page's controls after the shell rendered it. */
export function wireSettlement(root: HTMLElement, state: GameState, s: Settlement, host: SettlementHost, editing: boolean): void {
  const name = root.querySelector<HTMLInputElement>('#sp-name');
  if (name && editing) name.addEventListener('change', () => { const v = name.value.trim(); if (v && v !== s.name) host.onRename(s.id, v); });
  const popInput = root.querySelector<HTMLInputElement>('#sp-pop');
  if (popInput) {
    const apply = () => { const v = Math.round(Number(popInput.value)); if (v > 0 && Math.abs(v - totalPopulation(s.pop)) >= 0.5) host.onSetPopulation(s.id, v); };
    root.querySelector<HTMLButtonElement>('#sp-pop-apply')?.addEventListener('click', apply);
    popInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
    root.querySelector<HTMLButtonElement>('#sp-remove')?.addEventListener('click', () => host.onRemove(s.id));
  }
  root.querySelectorAll<HTMLButtonElement>('[data-build]').forEach((b) => b.addEventListener('click', () => { if (!b.disabled) host.onBuild(s.id, b.dataset.build!); }));
  root.querySelectorAll<HTMLButtonElement>('[data-cancel-build]').forEach((b) => b.addEventListener('click', () => host.onCancelBuild(s.id)));
}

// ---------------------------------------------------------------- pages

function granaryStat(ctx: Ctx): string {
  const g = granaryTerms(ctx.plan.granaryStaffing, ctx.plan.effects);
  const months = foodMonths(ctx.s);
  const until = monthsUntilHarvest(ctx.month);
  return stat(ICON.granary, 'Granary', `${fmt1(months)} <small>of ${g.capacityMonths.toFixed(0)} months</small>`,
    `${fmt(ctx.s.food)} food · next harvest in ${until} mo · spoils ${(100 * g.spoilage).toFixed(1)} %/mo`,
    gauge(g.capacityMonths > 0 ? months / g.capacityMonths : 0, { marks: [g.capacityMonths > 0 ? until / g.capacityMonths : 0], title: 'the mark is the next harvest: stock to the left of it runs out first' }));
}

function peopleStat(ctx: Ctx): string {
  const t = growthTrend(ctx.s);
  return stat(ICON.people, 'People', fmt(ctx.pop), `${fmt(ctx.hands)} hands (15–59) · ${t === null ? 'no trend yet' : `${pct(t)} a year`}`);
}

function lastYearText(ctx: Ctx): string {
  const r = ctx.s.report;
  if (!(r.births || r.deaths)) return '<span class="dim">no year-end yet</span>';
  const bits = [`<b class="num">${fmt(r.births)}</b> born`, `<b class="num">${fmt(r.deaths)}</b> died${r.epidemic ? ' <b class="warn">(epidemic)</b>' : ''}`];
  if (r.trickleOut > 0.5) bits.push(`${fmt(r.trickleOut)} moved to the town`);
  if (r.trickleIn > 0.5) bits.push(`${fmt(r.trickleIn)} arrived from the countryside`);
  const ly = ctx.s.lastYear;
  if (ly) {
    if (ly.migrantsOut > 0.5) bits.push(`${fmt(ly.migrantsOut)} fled hunger`);
    if (ly.migrantsIn > 0.5) bits.push(`${fmt(ly.migrantsIn)} took refuge here`);
    if (ly.hungerDeaths > 0.5) bits.push(`<b class="warn">${fmt(ly.hungerDeaths)} starved</b>`);
  }
  return bits.join(', ');
}

function lastMonthFood(ctx: Ctx): string {
  const r = ctx.s.report;
  const bits = [`${r.produced ? `+${fmt(r.produced)} grown` : 'nothing grown'}`, `${fmt(r.consumed)} eaten`];
  if (r.titheIn > 0.5) bits.push(`+${fmt(r.titheIn)} tithe in`);
  if (r.received > 0.5) bits.push(`+${fmt(r.received)} received`);
  if (r.titheOut > 0.5) bits.push(`${fmt(r.titheOut)} tithed up`);
  if (r.sent > 0.5) bits.push(`${fmt(r.sent)} sent up`);
  if (r.spoiled > 0.5) bits.push(`${fmt(r.spoiled)} spoiled`);
  if (r.hungerDeaths > 0.5) bits.push(`<b class="warn">${fmt(r.hungerDeaths)} starved</b>`);
  if (r.migrantsOut > 0.5) bits.push(`${fmt(r.migrantsOut)} left`);
  if (r.migrantsIn > 0.5) bits.push(`${fmt(r.migrantsIn)} arrived`);
  return bits.join(', ');
}

function projectCard(ctx: Ctx): string {
  const s = ctx.s;
  if (!s.build) return '';
  const def = buildingDef(s.build.building);
  return `<div class="card project"><div class="ch"><span class="cn">${ICON.hammer} ${esc(def.name)}</span><span class="cf">under construction</span></div>
    <div class="blurb">${esc(projectText(s)!)} · ${fmt(ctx.plan.constructionHands)} of ${fmt(def.buildHands ?? 0)} hands on the site${ctx.plan.constructionFraction < 0.999 ? ` <span class="warn">(building at ${Math.round(100 * ctx.plan.constructionFraction)} % speed)</span>` : ''}</div>
    <div class="cfoot">${gauge(s.build.progress, { cls: 'mid' })}<button class="btn small" data-cancel-build="1" title="Cancel for a full refund">Cancel</button></div></div>`;
}

function overviewPage(ctx: Ctx): string {
  const { state, s, plan, worked } = ctx;
  const children = childrenOf(state, s.id);
  const founded = calendar(s.foundedTurn);
  const sinceFounding = s.popHistory.length > 1 ? ctx.pop / s.popHistory[0] - 1 : null;
  const built = plan.buildings.map((b) => `<span title="${esc(buildingDef(b.id).blurb ?? '')}">${esc(buildingDef(b.id).name)}</span> <span class="dim num">${Math.round(100 * b.fraction)} %</span>`).join(' · ');
  const stats = [
    peopleStat(ctx),
    granaryStat(ctx),
    stat(ICON.wheat, 'Land', `${worked.length} <small>hexes</small>`, `feeds ${fmt(plan.plannedPerYear)} a year now · ${fmt(plan.landCapacity)} at full labour`),
    plan.privateHands > 0
      ? stat(ICON.coin, 'Tax', `${fmt(plan.taxPerYear)} <small>coins / yr</small>`, `${fmt(plan.taxableHands)} private hands at work · ${fmt(plan.goodsPerYear)} goods a year`)
      : stat(ICON.hand, 'Spare hands', fmt(plan.idleHands), `${fmt(plan.constructionHands)} building · ${fmt(plan.gatherHands)} gathering · ${Math.round(100 * (ctx.hands > 0 ? plan.idleHands / ctx.hands : 0))} % of hands`),
    stat(ICON.sun, 'Harvest', Math.abs(s.harvestFactor - 1) > 0.005 ? `${Math.round(100 * s.harvestFactor)} %` : 'normal', Math.abs(s.harvestFactor - 1) > 0.005 ? 'of a normal year' : 'an average year'),
  ].join('');
  const rows: [string, string][] = [
    ['Last year', lastYearText(ctx) + (sinceFounding !== null ? ` <span class="dim">· ${pct(sinceFounding)} since founding</span>` : '')],
    ['Last month', lastMonthFood(ctx)],
    ['Hands', `${fmt(plan.staffedHands)} in buildings · ${fmt(plan.fieldHands)} in the fields · <b>${fmt(plan.idleHands)} ${plan.privateHands > 0 ? 'private' : 'spare'}</b>` + (plan.vacancies > 0.5 ? ` · <b class="warn">${fmt(plan.vacancies)} hands short</b>` : '')],
    ['Dependants', children.length ? children.map((k) => `${tierGlyph(k.tier)}<a href="#" data-focus="${k.id}">${esc(k.name)}</a>`).join(', ') : '<span class="dim">none</span>'],
    ['Buildings', built + ` <a href="#" data-open="settlement" data-id="${s.id}" data-tab="buildings" class="dim">· all buildings →</a>`],
    ['Founded', `${founded.monthName}, year ${founded.year}`],
  ];
  const warnings: string[] = [];
  if (s.report.hungerDeaths > 0.5) warnings.push(`${ICON.skull} <b>${fmt(s.report.hungerDeaths)} starved last month.</b> The granary is empty; the next harvest is ${monthsUntilHarvest(ctx.month)} months away.`);
  if (forecastBeforeHarvest(s, plan, ctx.month) < 0 && s.report.hungerDeaths <= 0.5) warnings.push(`${ICON.warn} <b>Food will run out before the harvest</b> at this rate${plan.idleHands > 0.5 && s.parent ? ' — spare hands are leaving for the parent' : ''}.`);
  if (s.report.epidemic) warnings.push(`${ICON.warn} An epidemic year: deaths doubled.`);
  if (plan.vacancies > 0.5) warnings.push(`${ICON.hand} <b>${fmt(plan.vacancies)} hands short:</b> the buildings and fields could use more people than live here.`);
  return `<div class="stats">${stats}</div>
    ${warnings.length ? `<p class="warn">${warnings.join('<br>')}</p>` : ''}
    ${projectCard(ctx)}
    ${kv(rows)}`;
}

// ---- People ----

function pyramidSvg(s: Settlement): string {
  const W = 420, rowH = 29, H = 20 + BANDS * rowH + 16, mid = W / 2, left = 54, right = W - 54;
  const max = Math.max(1, ...s.pop.m, ...s.pop.f);
  const scale = (mid - left - 6) / max;
  const working = new Set(DEMOGRAPHY.workingBands);
  let out = `<svg class="pyramid" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  for (let b = 0; b < BANDS; b++) {
    const y = H - 18 - (b + 1) * rowH + 11;
    const band = DEMOGRAPHY.bands[b];
    const cls = working.has(band.id) ? 'hands' : 'nohands';
    const mw = s.pop.m[b] * scale, fw = s.pop.f[b] * scale;
    out += `<rect class="m ${cls}" x="${(mid - 3 - mw).toFixed(1)}" y="${y}" width="${mw.toFixed(1)}" height="${rowH - 11}" rx="1.5"><title>men ${band.name}: ${fmt(s.pop.m[b])}</title></rect>`;
    out += `<rect class="f ${cls}" x="${mid + 3}" y="${y}" width="${fw.toFixed(1)}" height="${rowH - 11}" rx="1.5"><title>women ${band.name}: ${fmt(s.pop.f[b])}</title></rect>`;
    out += `<text x="${left - 6}" y="${y + (rowH - 11) / 2 + 4}" text-anchor="end">${fmt(s.pop.m[b])}</text>`;
    out += `<text x="${right + 6}" y="${y + (rowH - 11) / 2 + 4}" text-anchor="start">${fmt(s.pop.f[b])}</text>`;
    out += `<text x="${mid}" y="${y - 2}" text-anchor="middle" font-size="9.5">${band.name}</text>`;
  }
  out += `<text x="${mid - 40}" y="${H - 4}" text-anchor="middle">men</text><text x="${mid + 40}" y="${H - 4}" text-anchor="middle">women</text></svg>`;
  return out;
}

function peoplePage(ctx: Ctx): string {
  const { s, plan } = ctx;
  const r = s.report;
  const tier = TIERS[s.tier];
  const stats = [
    peopleStat(ctx),
    stat(ICON.hand, 'Hands', fmt(ctx.hands), 'everyone 15–59'),
    stat(ICON.people, 'Men 15–44', fmt(recruitableMen(s.pop)), 'the levy pool (Phase 4)'),
    stat(ICON.people, 'Women 15–44', fmt(fertileWomen(s.pop)), `${(100 * DEMOGRAPHY.birthsPerWomanPerYear).toFixed(0)} births per 100 a year, well fed`),
  ].join('');
  // what limits growth here
  let brake: string;
  if ((DEMOGRAPHY.crowdingAppliesTo as string[]).includes(tier.id)) {
    const idleShare = ctx.hands > 0 ? plan.idleHands / ctx.hands : 0;
    const factor = Math.max(0, 1 - DEMOGRAPHY.crowdingBirthPenalty * idleShare);
    brake = `<b>Crowding.</b> A village's births fall with the share of its hands that have no field to work: ${Math.round(100 * idleShare)} % are spare, so births run at <b>${Math.round(100 * factor)} %</b> of the well-fed rate. When its land is full a village settles with about a quarter of its hands spare — the levy pool — instead of starving.`;
  } else {
    const spare = foodMonths(s) - monthsUntilHarvest(ctx.month);
    const factor = granaryBrakeFactor(tier.id, spare);
    brake = `<b>The granary brake.</b> A ${tier.name.toLowerCase()} breeds less when its stock is thin: at the December reckoning births are scaled by the months of grain it will have <i>to spare</i> at the next harvest (full at ${DEMOGRAPHY.granaryBrake.spareFull}, a quarter at ${DEMOGRAPHY.granaryBrake.spareEmpty}). Reckoned now that is <b>${fmt1(spare)} months</b> → births at <b>${Math.round(100 * factor)} %</b>.`;
  }
  const sufficiency = r.sufficiency;
  const rows: [string, string][] = [
    ['Last year', lastYearText(ctx)],
    ['Fed', s.yearMonths > 0 ? `${Math.round(100 * (s.yearSufficiency / s.yearMonths))} % of need so far this year` : '—' + (r.births || r.deaths ? ` <span class="dim">· ${Math.round(100 * sufficiency)} % last year</span>` : '')],
    ['Growth', growthTrend(s) === null ? '<span class="dim">needs two year-ends</span>' : `${pct(growthTrend(s)!)} a year`],
  ];
  if (s.report.hungerDeaths > 0.5) rows.push(['Last month', `<b class="warn">${fmt(s.report.hungerDeaths)} starved</b> — children and the old die first`]);
  return `<div class="stats">${stats}</div>
    <div class="cols">
      <div><h3>Who lives here</h3>${pyramidSvg(s)}<p class="note">Darker bands are the working hands; children and the old depend on them.</p></div>
      <div><h3>Growth</h3>${sparkSvg(s.popHistory, ctx.pop, 'now')}<p class="note">People at each December since founding.</p></div>
    </div>
    <h3>What moves the numbers</h3>
    <p>${brake}</p>
    ${kv(rows)}`;
}

// ---- Land & Food ----

function calendarSvg(ctx: Ctx): string {
  const { plan, s, pop } = ctx;
  const prod = MONTHS.map((_, m) => monthlyProduction(plan, m, s.harvestFactor));
  const total = prod.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...prod, pop) * 1.08;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `<div class="calendar">${prod.map((p, m) => `<div class="${m === ctx.month ? 'now' : ''}" title="${names[m]}: +${fmt(p)} grown, ${fmt(pop)} eaten"><i style="height:${(100 * p / max).toFixed(1)}%"></i><span>${MONTHS[m]}</span></div>`).join('')}<div class="eat" style="bottom:${(100 * pop / max).toFixed(1)}%"><b>eats ${fmt(pop)} a month</b></div></div><div class="calendar-labels"></div>
    <p class="note">What the worked land yields month by month at this labour and this year's harvest (farming lands 60 % in September and 40 % in October; herding, fishing and hunting come in twelfths); the dashed line is what the settlement eats. Over the year: <b>${fmt(total)}</b> grown against <b>${fmt(12 * pop)}</b> eaten — <b class="${total >= 12 * pop ? 'good' : 'warn'}">${signed(total - 12 * pop)}</b>${s.parent ? ', before the tithe and the surplus sent up' : ''}.</p>`;
}

function hexRows(ctx: Ctx): string {
  const { state, plan, worked } = ctx;
  const byCell = new Map<number, string[]>();
  for (const j of plan.jobs) {
    const arr = byCell.get(j.cell) ?? [];
    arr.push(`<span title="${jobName(j.kind)}: ${fmt(j.hands)} hands feed ${fmt(j.fedPerYear)} a year at full labour">${jobIcon(j.kind)} ${fmt(j.fedPerYear * j.fraction)}<span class="dim">/${fmt(j.fedPerYear)}</span></span>`);
    byCell.set(j.cell, arr);
  }
  for (const g of plan.gather) {
    const arr = byCell.get(g.cell) ?? [];
    arr.push(`<span title="${jobName(g.kind)}: ${fmt(g.hands)} hands gather ${fmt(g.perYear)} a year">${jobIcon(g.kind)} ${fmt(g.perYear * g.fraction)}<span class="dim">/${fmt(g.perYear)}</span></span>`);
    byCell.set(g.cell, arr);
  }
  const w = state.map.width;
  const rows = worked.map((cell) => {
    const col = cell % w, row = Math.floor(cell / w);
    const t = TERRAIN[getTerrain(state.map, col, row)];
    const res = resourceByIndex(getResource(state.map, col, row));
    const jobs = byCell.get(cell) ?? [];
    return `<tr><td><span class="chip" style="background:${t.color}"></span>${esc(t.name)}${res ? ` <span class="dim">· ${esc(res.name)}</span>` : ''}</td><td class="dimrow">${t.fertility ? `fertility ${t.fertility}` : ''}${t.pasture ? ` · pasture ${t.pasture}` : ''}${t.timber ? ` · timber ${t.timber}` : ''}</td><td>${jobs.length ? jobs.join(' &nbsp; ') : '<span class="dim">nothing to work</span>'}</td><td class="dimrow r">(${col}, ${row})</td></tr>`;
  });
  return `<table class="data"><tr><th>Hex</th><th>Yields</th><th>Worked · fed or gathered a year (now / full)</th><th class="r">at</th></tr>${rows.join('')}</table>`;
}

function landPage(ctx: Ctx): string {
  const { s, plan, worked } = ctx;
  const g = granaryTerms(plan.granaryStaffing, plan.effects);
  const forecast = forecastBeforeHarvest(s, plan, ctx.month);
  const stats = [
    stat(ICON.wheat, 'Worked land', `${worked.length} <small>hexes</small>`, `${TIERS[s.tier].workRings}-ring work zone · ${fmt(plan.fieldHands)} hands in the fields`),
    stat(ICON.sun, 'Feeds a year', fmt(plan.plannedPerYear), `people fed by the land at this labour · ${fmt(plan.landCapacity)} at full labour · harvest ${Math.round(100 * s.harvestFactor)} % this year`),
    granaryStat(ctx),
    stat(forecast < 0 ? ICON.warn : ICON.calendar, 'At the next harvest', `${forecast < 0 ? '<span class="warn">' : ''}${signed(forecast)}${forecast < 0 ? '</span>' : ''}`, forecast < 0 ? 'food runs out before it — people will go hungry or leave' : `${fmt1(ctx.pop > 0 ? forecast / ctx.pop : 0)} months left when it arrives`),
  ].join('');
  const ly = s.lastYear;
  const rows: [string, string][] = [
    ['Last month', lastMonthFood(ctx)],
    ['Last year', ly ? `${fmt(ly.produced)} grown, ${fmt(ly.consumed)} eaten, <b class="${ly.produced >= ly.consumed ? 'good' : 'warn'}">${signed(ly.produced - ly.consumed)}</b>` + (ly.titheOut > 0.5 ? `, ${fmt(ly.titheOut)} tithed up` : '') + (ly.titheIn > 0.5 ? `, ${fmt(ly.titheIn)} tithe in` : '') + (ly.sent > 0.5 ? `, ${fmt(ly.sent)} sent up` : '') + (ly.received > 0.5 ? `, ${fmt(ly.received)} received` : '') + (ly.hungerDeaths > 0.5 ? `, <b class="warn">${fmt(ly.hungerDeaths)} starved</b>` : '') : '<span class="dim">no year-end yet</span>'],
    ['Granary', `holds ${g.capacityMonths.toFixed(0)} months of this settlement's eating${plan.effects.granaryExtraMonths ? ' (Great Granary)' : ''} · spoils ${(100 * g.spoilage).toFixed(1) } % a month · staffed ${Math.round(100 * plan.granaryStaffing)} %`],
    ['Sharing', s.parent ? `${Math.round(100 * titheShare())} % of all food grown here goes to <a href="#" data-focus="${s.parent}">${esc(ctx.state.settlements[s.parent].name)}</a> as tithe; after the harvest, everything above what this settlement eats until the next one plus a 3-month reserve is sent up as surplus` : childrenOf(ctx.state, s.id).length ? 'receives the tithe and surplus of its dependants; sends nothing up' : 'keeps everything it grows'],
  ];
  return `<div class="stats">${stats}</div>
    <h3>The year's harvest</h3>${calendarSvg(ctx)}
    <h3>The worked hexes <small>${plan.fieldHands > 0 ? `${fmt(plan.fieldHands)} hands in the fields, best land first` : 'nobody in the fields'}</small></h3>
    ${hexRows(ctx)}
    <h3>Flows</h3>${kv(rows)}`;
}

// ---- Economy ----

function economyPage(ctx: Ctx): string {
  const { state, s, plan } = ctx;
  const r = s.report;
  const isTown = plan.privateHands > 0 || TIERS[s.tier].rank >= 1;
  const pool = clusterStock(state, s.id), cap = clusterCap(state, s.id);
  const freeHands = Math.max(0, plan.idleHands - plan.constructionHands - plan.gatherHands);
  const stats = [
    stat(ICON.hand, 'Hands', fmt(ctx.hands), `${fmt(plan.staffedHands)} in buildings · ${fmt(plan.fieldHands)} in the fields · ${fmt(plan.idleHands)} ${isTown ? 'private' : 'spare'}`),
    isTown
      ? stat(ICON.coin, 'Tax', `${fmt(plan.taxPerYear)} <small>coins / yr</small>`, `${fmt(plan.taxableHands)} private hands × ${taxRate()} × administration ${Math.round(100 * plan.adminQuality)} %` + (plan.taxLostPerYear > 0.5 ? ` · <span class="warn">−${fmt(plan.taxLostPerYear)} while ${fmt(plan.privateHands - plan.taxableHands)} build or gather</span>` : ''))
      : stat(ICON.coin, 'Tax', '0', 'villages pay no tax — their spare hands are peasants'),
    isTown ? stat(ICON.goods, 'Goods', `${fmt(plan.goodsPerYear)} <small>/ yr</small>`, `made by the private hands${plan.effects.goodsMult > 1 ? ` · Workshop ×${plan.effects.goodsMult.toFixed(2)}` : ''}${plan.salesSharePerYear > 0 ? ` · Market sells ${Math.round(100 * plan.salesSharePerYear)} % of the cluster's goods a year` : ' · no Market here'}`) : '',
    stat(ICON.scroll, 'Administration', `${Math.round(100 * plan.adminQuality)} %`, plan.adminQuality < 0.999 ? 'the hall is understaffed: tax and goods fall with it' : 'the hall is fully staffed'),
  ].join('');
  const handsStack = stack([
    { label: 'buildings', value: plan.staffedHands, cls: 'c4' },
    { label: 'fields', value: plan.fieldHands, cls: 'c2' },
    { label: 'construction', value: plan.constructionHands, cls: 'c3' },
    { label: 'gathering', value: plan.gatherHands, cls: 'c5' },
    { label: isTown ? 'private economy' : 'spare', value: freeHands, cls: 'c1' },
  ]);
  const matRows = MATERIAL_IDS.map((k) => `<div class="bl">${k === 'timber' ? ICON.timber : k === 'stone' ? ICON.stone : ICON.goods} ${k}</div>${hbar(pool[k], Number.isFinite(cap[k]) ? cap[k] : pool[k], k === 'timber' ? 'c4' : k === 'stone' ? 'c1' : 'c3', `cluster ${fmt(pool[k])} of ${Number.isFinite(cap[k]) ? fmt(cap[k]) : '∞'}`)}<div class="bv">${fmt(pool[k])} <span class="dim">/ ${Number.isFinite(cap[k]) ? fmt(cap[k]) : '∞'}</span> <span class="dim">· own ${fmt(s.stock[k])}</span></div>`).join('');
  const gatherRows = plan.gather.length ? `<table class="data"><tr><th>Gathering</th><th class="r">hands</th><th class="r">a year</th></tr>${plan.gather.map((g) => `<tr><td>${jobIcon(g.kind)} ${jobName(g.kind)}</td><td class="r">${fmt(g.hands * g.fraction)}<span class="dim">/${fmt(g.hands)}</span></td><td class="r">${fmt(g.perYear * g.fraction)}</td></tr>`).join('')}</table>` : '<p class="note">Nothing to gather on the worked hexes — no timber-bearing land and no Stone.</p>';
  const rows: [string, string][] = [
    ['Last month', `+${fmt(r.timber)} timber, +${fmt(r.stone)} stone, +${fmt(r.goods)} goods` + (r.tax > 0.5 ? `, <b>${fmt(r.tax)} coins</b> in tax` : '') + (r.sold > 0.5 ? `, sold goods for ${fmt(r.sold)} coins` : '')],
    ...(s.lastYear ? [['Last year', `+${fmt(s.lastYear.timber)} timber, +${fmt(s.lastYear.stone)} stone, +${fmt(s.lastYear.goods)} goods` + (s.lastYear.tax > 0.5 ? `, ${fmt(s.lastYear.tax)} coins in tax` : '') + (s.lastYear.taxLost > 0.5 ? ` <span class="dim">(${fmt(s.lastYear.taxLost)} forgone to building and gathering)</span>` : '') + (s.lastYear.sold > 0.5 ? `, ${fmt(s.lastYear.sold)} from sales` : '')] as [string, string]] : []),
  ];
  return `<div class="stats">${stats}</div>
    <h3>Where the hands go</h3>${handsStack}
    <p class="note">${isTown ? 'Buildings are staffed first, then the fields; everyone else is a private hand — artisans, labourers and traders the crown taxes. Construction gangs and gatherers are drawn from them and pay no tax while they work.' : 'Buildings are staffed first, then the fields; the spare hands build the current project, gather timber and stone, and are the pool that crowding and migration draw on.'}</p>
    <div class="cols">
      <div><h3>The cluster's stockpile</h3><div class="bars">${matRows}</div><p class="note">A project here draws on the whole cluster, own stock first. What a cluster holds above its cap flows to the realm.</p></div>
      <div><h3>Gathering</h3>${gatherRows}</div>
    </div>
    <h3>Receipts</h3>${kv(rows)}`;
}

// ---- Buildings ----

function costChips(def: ReturnType<typeof buildingDef>, check: ReturnType<typeof canBuild>): string {
  const money = moneyCost(def);
  const chips: string[] = [];
  if (money > 0) chips.push(`<span class="${check.lackingMoney ? 'short' : ''}">${ICON.coin} ${fmt(money)}</span>`);
  for (const k of MATERIAL_IDS) {
    const v = def.cost?.[k] ?? 0;
    if (v > 0) chips.push(`<span class="${check.lacking && check.lacking[k] > 0 ? 'short' : ''}">${k === 'timber' ? ICON.timber : k === 'stone' ? ICON.stone : ICON.goods} ${fmt(v)}</span>`);
  }
  chips.push(`<span>${ICON.calendar} ${def.buildMonths ?? 0} mo</span>`);
  chips.push(`<span>${ICON.hammer} ${fmt(def.buildHands ?? 0)} build</span>`);
  if (def.hands) chips.push(`<span>${ICON.hand} ${fmt(def.hands)} run</span>`);
  return chips.join('');
}

function buildingsPage(ctx: Ctx): string {
  const { state, s, plan, worked } = ctx;
  const builtCards = plan.buildings.map((b) => {
    const def = buildingDef(b.id);
    return `<div class="card built"><div class="ch"><span class="cn">${esc(def.name)}</span><span class="cf">${def.mandatory ? 'since founding' : esc(def.family)}</span></div>
      <div class="blurb">${esc(def.blurb ?? (def.family === 'hall' ? 'Where government happens: administration quality is the hall\'s staffing; an understaffed hall lowers tax and goods.' : def.family === 'granary' ? 'Stores the harvest: fully staffed it holds 24 months and spoils 0.5 % a month; unstaffed 15 months and 1.5 %.' : ''))}</div>
      <div class="cfoot">${gauge(b.fraction, { title: `${fmt(b.hands)} of ${fmt(def.hands)} hands` })}<span class="staff num">${fmt(b.hands)} / ${fmt(def.hands)} hands</span></div></div>`;
  }).join('');
  const options = buildableFor(s.tier).filter((b) => !s.buildings.includes(b.id)).map((def) => ({ def, check: canBuild(state, s, def.id, worked) }));
  const taxPerHand = plan.taxableHands > 0 ? plan.taxPerYear / plan.taxableHands : 0;
  const optionCards = options.map(({ def, check }) => {
    const blocked = !check.ok && !s.build;
    const dent = plan.privateHands > 0 && def.buildHands ? ` The ${fmt(def.buildHands)} builders pay no tax while they work (−${fmt(def.buildHands * taxPerHand)} coins a year).` : '';
    return `<div class="card ${blocked ? 'off' : ''}"><div class="ch"><span class="cn">${esc(def.name)}</span><span class="cf">${esc(def.family)}</span></div>
      <div class="cost">${costChips(def, check)}</div>
      <div class="blurb">${esc(def.blurb ?? '')}${esc(dent)}</div>
      ${!check.ok && !s.build ? `<div class="why">${esc(check.reason ?? '')}</div>` : ''}
      <div class="cfoot"><span class="spacer" style="flex:1"></span><button class="btn primary small" data-build="${def.id}" ${check.ok && !s.build ? '' : 'disabled'} title="${s.build ? 'one project at a time' : check.ok ? 'Pay now, build over the coming months' : esc(check.reason ?? '')}">Start</button></div></div>`;
  }).join('');
  return `${projectCard(ctx) ? `<h3>Under construction</h3>${projectCard(ctx)}` : ''}
    <h3>Standing <small>${plan.buildings.length} buildings · ${fmt(plan.staffedHands)} hands</small></h3>
    <div class="cards">${builtCards}</div>
    <h3>Build <small>one project at a time · paid when started · cancel refunds everything</small></h3>
    ${options.length ? `<div class="cards">${optionCards}</div>` : '<p class="note">Nothing left to build at this tier.</p>'}`;
}
