// The settlement ledger (Session 13): one modal, six pages — Overview,
// People, Land & Food, Economy, Buildings, Recruitment (Phase 2, Session 15).
// Display only, except the player actions it forwards (build / cancel, raise /
// cancel a party, and the editor's rename / people / remove).

import type { GameState } from '../../sim/state';
import { calendar } from '../../sim/state';
import { TIERS, tierIndex, growthTrend, childrenOf, workedCellsBySettlement, buildingDef, type Settlement } from '../../sim/settlements';
import { totalPopulation, workingHands, recruitableMen, fertileWomen, DEMOGRAPHY, BANDS, granaryBrakeFactor } from '../../sim/demography';
import { planLabour, granaryTerms, monthsUntilHarvest, forecastBeforeHarvest, monthlyProduction, taxRate, titheShare, type LabourPlan } from '../../sim/economy';
import { buildableFor, canBuild, moneyCost } from '../../sim/buildings';
import { clusterStock, clusterCap, MATERIAL_IDS } from '../../sim/materials';
import { TERRAIN } from '../../sim/terrain';
import { resourceByIndex } from '../../sim/resources';
import { getTerrain, getResource } from '../../sim/map';
import { fmt, fmt1, pct, signed, esc, tierName, tierGlyph, foodMonths, clusterLine, projectText, gauge, hbar, stack, stat, kv, ICON, jobIcon, jobName, sparkSvg } from './format';
import type { ModalSpec } from './modal';
import { UNIT_TYPES, unitTypeDef, raiseCheck, defaultSize, defaultProvisionMonths, isForming, unitCell, type Unit } from '../../sim/units';
import { idx } from '../../sim/map';
import { unitState } from './unitCard';
import { canUpgrade, upgradeStep } from '../../sim/upgrades';

export interface SettlementHost {
  onRename(id: string, name: string): void;
  onSetPopulation(id: string, population: number): void;
  onRemove(id: string): void;
  onBuild(id: string, building: string): void;
  onCancelBuild(id: string): void;
  /** open the raise dialog for a unit type at this settlement */
  onRaise(id: string, type: string): void;
  onCancelRaise(unitId: string): void;
  onSelectUnit(unitId: string): void;
  onUpgrade(id: string): void;
  onCancelUpgrade(id: string): void;
}

export const SETTLEMENT_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'people', label: 'People' },
  { id: 'land', label: 'Land & Food' },
  { id: 'economy', label: 'Economy' },
  { id: 'buildings', label: 'Buildings' },
  { id: 'recruitment', label: 'Recruitment' },
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
    parent ? `under <a href="#" data-focus="${parent.id}">${esc(parent.name)}</a> (${tierName(parent).toLowerCase()})` : TIERS[s.tier].rank < 3 ? '<span class="dim">no parent in range</span>' : 'independent',
    c ? `<a href="#" data-cluster="${c.root}">${esc(c.text)}</a>` : '',
    `hex (${s.col}, ${s.row})`,
  ].filter(Boolean);
  const body =
    tab === 'people' ? peoplePage(ctx) :
    tab === 'land' ? landPage(ctx) :
    tab === 'economy' ? economyPage(ctx) :
    tab === 'buildings' ? buildingsPage(ctx) :
    tab === 'recruitment' ? recruitmentPage(ctx) :
    overviewPage(ctx);
  const foot = editing ? `<span class="dim">Editor:</span> <label>Set people <input id="sp-pop" type="number" min="1" step="100" value="${Math.round(ctx.pop)}" /></label> <button id="sp-pop-apply" class="btn small">Apply</button><span class="spacer"></span><button id="sp-remove" class="btn small danger">Remove settlement</button>` : undefined;
  return {
    title: `<input id="sp-name" type="text" value="${esc(s.name)}" ${editing ? '' : 'readonly'} />`,
    badge: s.upgrade ? `${tierName(s)} → ${TIERS[s.upgrade.to].name}` : tierName(s),
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
  root.querySelectorAll<HTMLElement>('[data-build]').forEach((b) => b.addEventListener('click', () => host.onBuild(s.id, b.dataset.build!)));
  root.querySelectorAll<HTMLButtonElement>('[data-cancel-build]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); host.onCancelBuild(s.id); }));
  root.querySelectorAll<HTMLElement>('[data-raise]').forEach((b) => b.addEventListener('click', () => host.onRaise(s.id, b.dataset.raise!)));
  root.querySelectorAll<HTMLButtonElement>('[data-cancel-raise]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); host.onCancelRaise(b.dataset.cancelRaise!); }));
  root.querySelectorAll<HTMLElement>('[data-unit]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); host.onSelectUnit(b.dataset.unit!); }));
  root.querySelector<HTMLButtonElement>('[data-upgrade]')?.addEventListener('click', () => host.onUpgrade(s.id));
  root.querySelector<HTMLButtonElement>('[data-cancel-upgrade]')?.addEventListener('click', (e) => { e.stopPropagation(); host.onCancelUpgrade(s.id); });
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

/** The tier-upgrade card (DESIGN §3.2b rule 10, Session 15b): the running rise with Cancel, or the next step with its cost and Start. */
function upgradeCard(ctx: Ctx): string {
  const { state, s } = ctx;
  if (s.faction !== state.playerFaction) return '';
  if (s.upgrade) {
    const step = upgradeStep(s.tier);
    const months = step ? step.months : 12;
    const left = Math.max(0, Math.ceil((1 - s.upgrade.progress) * months - 1e-9));
    return `<div class="card project"><div class="ch"><span class="cn">${ICON.arrowUp} Rising to ${esc(TIERS[s.upgrade.to].name.toLowerCase())}</span><span class="cf">upgrade</span></div>
      <div class="blurb">${Math.round(100 * s.upgrade.progress)} % done, ~${left} month${left === 1 ? '' : 's'} left · the hall grows; at completion the zones, hall and granary are a ${esc(TIERS[s.upgrade.to].name.toLowerCase())}'s.</div>
      <div class="cfoot">${gauge(s.upgrade.progress, { cls: 'mid' })}<button class="btn small" data-cancel-upgrade="1" title="Cancel for a full refund">Cancel</button></div></div>`;
  }
  const check = canUpgrade(state, s);
  if (!check.step) return '';
  const step = check.step;
  const to = TIERS[tierIndex(step.to)];
  const chips = [
    `<span class="${check.lackingMoney ? 'short' : ''}" title="coins from the treasury">${ICON.coin} ${fmt(step.money)}</span>`,
    `<span class="${check.lacking && check.lacking.timber > 0 ? 'short' : ''}" title="timber from the cluster's stockpile">${ICON.timber} ${fmt(step.timber)}</span>`,
    `<span class="${check.lacking && check.lacking.stone > 0 ? 'short' : ''}" title="stone from the cluster's stockpile">${ICON.stone} ${fmt(step.stone)}</span>`,
    `<span title="months">${ICON.calendar} ${step.months} mo</span>`,
    `<span class="${check.shortPeople > 0 ? 'short' : ''}" title="the population gate">${ICON.people} ${fmt(to.popMin)}</span>`,
  ].join('');
  return `<div class="card ${check.ok ? 'built' : 'off'}"><div class="ch"><span class="cn">${ICON.arrowUp} Become a ${esc(to.name.toLowerCase())}</span><span class="cf">${step.placeholder ? 'draft — prerequisites not designed yet' : 'upgrade'}</span></div>
    <div class="cost">${chips}</div>
    <div class="blurb">A ${esc(to.name.toLowerCase())} works ${to.workRings} ring${to.workRings === 1 ? '' : 's'} and its influence reaches ${to.influenceRings}; its hall and granary grow with it. The gate is ${fmt(to.popMin)} people; the money and materials are paid now and refunded if cancelled.</div>
    <div class="cfoot">${check.ok ? `<span class="spacer"></span><button class="btn small primary" data-upgrade="1">Begin</button>` : `<span class="why">${esc(check.reason ?? '')}</span>`}</div></div>`;
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
    ${upgradeCard(ctx)}
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
  // per hex: the jobs as chips (worked ones first, unworked greyed) and how much of it is worked at all
  const byCell = new Map<number, { html: string; worked: number; full: number }[]>();
  const push = (cell: number, worked: number, full: number, html: string) => {
    const arr = byCell.get(cell) ?? [];
    arr.push({ html, worked, full });
    byCell.set(cell, arr);
  };
  for (const j of plan.jobs) {
    const now = j.fedPerYear * j.fraction;
    push(j.cell, now, j.fedPerYear, `<span class="job ${now > 0.5 ? '' : 'idle'}" title="${jobName(j.kind)}: ${fmt(j.hands)} hands feed ${fmt(j.fedPerYear)} a year at full labour${now > 0.5 ? '' : ' — nobody works it'}">${jobIcon(j.kind)} ${fmt(now)}<span class="dim">/${fmt(j.fedPerYear)}</span></span>`);
  }
  for (const g of plan.gather) {
    const now = g.perYear * g.fraction;
    push(g.cell, now, g.perYear, `<span class="job ${now > 0.5 ? '' : 'idle'}" title="${jobName(g.kind)}: ${fmt(g.hands)} hands gather ${fmt(g.perYear)} a year${now > 0.5 ? '' : ' — nobody gathers it'}">${jobIcon(g.kind)} ${fmt(now)}<span class="dim">/${fmt(g.perYear)}</span></span>`);
  }
  const w = state.map.width;
  const scored = worked.map((cell) => {
    const jobs = (byCell.get(cell) ?? []).sort((a, b) => b.worked - a.worked || b.full - a.full);
    const workedSum = jobs.reduce((t, j) => t + j.worked, 0);
    const anyWorked = jobs.some((j) => j.worked > 0.5);
    const allWorked = jobs.length > 0 && jobs.every((j) => j.worked > 0.5);
    return { cell, jobs, workedSum, anyWorked, allWorked };
  });
  // worked hexes first (most food first), then partly worked, then the hexes nobody works
  scored.sort((a, b) => Number(b.anyWorked) - Number(a.anyWorked) || Number(b.allWorked) - Number(a.allWorked) || b.workedSum - a.workedSum || a.cell - b.cell);
  const rows = scored.map(({ cell, jobs, anyWorked, allWorked }) => {
    const col = cell % w, row = Math.floor(cell / w);
    const t = TERRAIN[getTerrain(state.map, col, row)];
    const res = resourceByIndex(getResource(state.map, col, row));
    const mark = !anyWorked ? '<span class="idletag">not worked</span>' : !allWorked ? '<span class="idletag part">partly</span>' : '';
    return `<tr class="${anyWorked ? '' : 'idlerow'}"><td><span class="chip" style="background:${t.color}"></span>${esc(t.name)}${res ? ` <span class="dim">· ${esc(res.name)}</span>` : ''}</td><td class="dimrow">${t.fertility ? `fertility ${t.fertility}` : ''}${t.pasture ? ` · pasture ${t.pasture}` : ''}${t.timber ? ` · timber ${t.timber}` : ''}</td><td>${jobs.length ? jobs.map((j) => j.html).join(' &nbsp; ') : '<span class="dim">nothing to work</span>'} ${mark}</td><td class="dimrow r">(${col}, ${row})</td></tr>`;
  });
  const idle = scored.filter((x) => !x.anyWorked).length, part = scored.filter((x) => x.anyWorked && !x.allWorked).length;
  return `<table class="data hexes"><tr><th>Hex</th><th>Yields</th><th>Worked · fed or gathered a year (now / full)</th><th class="r">at</th></tr>${rows.join('')}</table>
    <p class="note">Worked hexes first, the best land at the top; a greyed figure is a job nobody works${part ? ` — ${part} hex${part === 1 ? '' : 'es'} partly worked` : ''}${idle ? `, ${idle} not worked at all` : ''}.</p>`;
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
  const isTown = plan.privateHands > 0 || TIERS[s.tier].rank >= 2;
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

type Check = ReturnType<typeof canBuild>;

function costChips(def: ReturnType<typeof buildingDef>, check: Check | null, full: boolean): string {
  const money = moneyCost(def);
  const chips: string[] = [];
  if (money > 0) chips.push(`<span class="${check?.lackingMoney ? 'short' : ''}" title="coins">${ICON.coin} ${fmt(money)}</span>`);
  for (const k of MATERIAL_IDS) {
    const v = def.cost?.[k] ?? 0;
    if (v > 0) chips.push(`<span class="${check?.lacking && check.lacking[k] > 0 ? 'short' : ''}" title="${k}">${k === 'timber' ? ICON.timber : k === 'stone' ? ICON.stone : ICON.goods} ${fmt(v)}</span>`);
  }
  if (full) {
    chips.push(`<span title="months to build">${ICON.calendar} ${def.buildMonths ?? 0} mo</span>`);
    chips.push(`<span title="builders">${ICON.hammer} ${fmt(def.buildHands ?? 0)} build</span>`);
    if (def.hands) chips.push(`<span title="hands to run it">${ICON.hand} ${fmt(def.hands)} run</span>`);
  }
  return chips.join('');
}

/** A building cube (Session 13b): icon, name, family, cost chips; the explanation lives in its tooltip. */
function cube(cls: string, def: ReturnType<typeof buildingDef>, body: string, tip: string, attrs = ''): string {
  return `<div class="cube ${cls}" data-tip="1" ${attrs}><div class="ci">${ICON[def.icon ?? 'house'] ?? ICON.house}</div><div class="cn">${esc(def.name)}</div><div class="cf">${esc(def.family)}</div>${body}<div class="tip">${tip}</div></div>`;
}

function buildingsPage(ctx: Ctx): string {
  const { state, s, plan, worked } = ctx;
  const tipH = (h: string, sub: string) => `<div class="tiph">${esc(h)}</div><div class="dim">${esc(sub)}</div>`;
  const cubes: string[] = [];
  // the running project first
  if (s.build) {
    const def = buildingDef(s.build.building);
    const left = projectText(s)!;
    cubes.push(cube('project', def, `<div class="cg">${gauge(s.build.progress, { cls: 'mid' })}</div><div class="cb"><button class="btn small" data-cancel-build="1">Cancel</button></div>`,
      tipH(def.name, 'under construction') + `<p>${esc(left)} · ${fmt(plan.constructionHands)} of ${fmt(def.buildHands ?? 0)} hands on the site${plan.constructionFraction < 0.999 ? ` <span class="warn">(building at ${Math.round(100 * plan.constructionFraction)} % speed)</span>` : ''}.</p><p>${esc(def.blurb ?? '')}</p><div class="dim">Cancel refunds everything paid.</div>`));
  }
  // standing buildings
  for (const b of plan.buildings) {
    const def = buildingDef(b.id);
    const blurb = def.blurb ?? (def.family === 'hall' ? 'Where government happens: administration quality is the hall\'s staffing; an understaffed hall lowers tax and goods.' : def.family === 'granary' ? 'Stores the harvest: fully staffed it holds 24 months and spoils 0.5 % a month; unstaffed 15 months and 1.5 %.' : '');
    cubes.push(cube('built', def, `<div class="cg">${gauge(b.fraction)}</div><div class="cs num">${fmt(b.hands)} / ${fmt(def.hands)} hands</div>`,
      tipH(def.name, def.mandatory ? 'since founding' : 'built') + `<p>${esc(blurb)}</p><div class="dim">Staffed ${Math.round(100 * b.fraction)} % — ${fmt(b.hands)} of ${fmt(def.hands)} hands; effects scale with staffing.</div>`));
  }
  // available, then unavailable
  const options = buildableFor(s.tier).filter((b) => !s.buildings.includes(b.id)).map((def) => ({ def, check: canBuild(state, s, def.id, worked) }));
  const taxPerHand = plan.taxableHands > 0 ? plan.taxPerYear / plan.taxableHands : 0;
  const avail = options.filter((o) => o.check.ok && !s.build);
  const off = options.filter((o) => !(o.check.ok && !s.build));
  const optionCube = ({ def, check }: typeof options[number], ok: boolean) => {
    const dent = plan.privateHands > 0 && def.buildHands ? ` The ${fmt(def.buildHands)} builders pay no tax while they work (−${fmt(def.buildHands * taxPerHand)} coins a year).` : '';
    const reason = s.build ? 'One project at a time — wait for the current one or cancel it.' : check.reason ?? '';
    return cube(ok ? 'avail' : 'off', def, `<div class="cc">${costChips(def, check, false)}</div>`,
      tipH(def.name, `${def.family} · from ${def.minTier ?? 'village'}`) + `<div class="cost">${costChips(def, check, true)}</div><p>${esc(def.blurb ?? '')}${esc(dent)}</p>` + (ok ? '<div class="dim">Click to start — paid now, built over the coming months.</div>' : `<div class="why">${esc(reason)}</div>`),
      ok ? `data-build="${def.id}"` : '');
  };
  for (const o of avail) cubes.push(optionCube(o, true));
  for (const o of off) cubes.push(optionCube(o, false));
  return `<div class="cubes">${cubes.join('')}</div>
    <p class="note">${plan.buildings.length} standing · ${avail.length} can be started${s.build ? ' once the current project is done' : ''} · ${off.length} not now. Hover a cube for what it does; click a green one to start it. One project at a time; the cost is paid when it starts and refunded in full if cancelled.</p>`;
}

// ---- Recruitment (Phase 2, Session 15; UI-DESIGN §5 "Recruitment cubes") ----

/** Cost chips for a unit type: coins, materials, people (the default size), months of food. */
export function unitCostChips(state: GameState, s: Settlement, def: ReturnType<typeof unitTypeDef>, check: ReturnType<typeof raiseCheck> | null, full: boolean): string {
  const chips: string[] = [];
  const money = def.cost.money ?? 0;
  if (money > 0) chips.push(`<span class="${check?.lackingMoney ? 'short' : ''}" title="coins from the treasury">${ICON.coin} ${fmt(money)}</span>`);
  for (const k of MATERIAL_IDS) {
    const v = def.cost[k] ?? 0;
    if (v > 0) chips.push(`<span class="${check?.lacking && check.lacking[k] > 0 ? 'short' : ''}" title="${k} from the cluster's stockpile (the realm's when short)">${k === 'timber' ? ICON.timber : k === 'stone' ? ICON.stone : ICON.goods} ${fmt(v)}</span>`);
  }
  const size = def.enabled ? defaultSize(state, def.id, s, null) : (typeof def.defaultSize === 'number' ? def.defaultSize : 0);
  chips.push(`<span title="people who leave (the default size; chosen when raising)">${ICON.people} ${fmt(size)}</span>`);
  if (full) {
    chips.push(`<span title="months of food carried by default">${ICON.wheat} ${defaultProvisionMonths(def.id, calendar(state.turn).month)} mo</span>`);
    chips.push(`<span title="hexes a month on open ground">${ICON.walk} ${def.movePoints} / mo</span>`);
    if (def.upkeepPerManPerMonth) chips.push(`<span title="upkeep">${ICON.coin} ${def.upkeepPerManPerMonth} / man / mo</span>`);
  }
  return chips.join('');
}

function unitCube(cls: string, def: ReturnType<typeof unitTypeDef>, body: string, tip: string, attrs = ''): string {
  return `<div class="cube ${cls}" data-tip="1" ${attrs}><div class="ci">${ICON[def.icon] ?? ICON.walk}</div><div class="cn">${esc(def.name)}</div><div class="cf">party</div>${body}<div class="tip">${tip}</div></div>`;
}

function recruitmentPage(ctx: Ctx): string {
  const { state, s, plan } = ctx;
  const tipH = (h: string, sub: string) => `<div class="tiph">${esc(h)}</div><div class="dim">${esc(sub)}</div>`;
  const month = calendar(state.turn).month;
  const here = idx(state.map, s.col, s.row);
  const units = Object.values(state.units).filter((u) => u.faction === s.faction).sort((a, b) => (a.id < b.id ? -1 : 1));
  const forming = units.filter((u) => u.home === s.id && isForming(state, u));
  const standing = units.filter((u) => unitCell(state.map, u) === here && !isForming(state, u));
  const cubes: string[] = [];
  // mustering parties first (gold, with Cancel)
  for (const u of forming) {
    const def = unitTypeDef(u.type);
    const pop = totalPopulation(u.pop);
    cubes.push(unitCube('project', def, `<div class="cs num">${fmt(pop)} people · ${u.provisionMonths} mo food</div><div class="cb"><button class="btn small" data-cancel-raise="${u.id}">Cancel</button></div>`,
      tipH(u.name, 'mustering — forms at the end of the month') + `<p>${fmt(pop)} people with ${u.provisionMonths} months of food${u.order ? `, bound for (${u.order.dest % state.map.width}, ${Math.floor(u.order.dest / state.map.width)})` : ''}.</p><div class="dim">Cancel returns everyone and everything. Click the cube to see the party.</div>`,
      `data-unit="${u.id}"`));
  }
  // the types: available (green) then unavailable (greyed)
  const taxPerHand = plan.taxableHands > 0 ? plan.taxPerYear / plan.taxableHands : 0;
  const opts = UNIT_TYPES.map((def) => {
    if (!def.enabled) return { def, ok: false, reason: `${def.name} cannot be raised yet.`, check: null as ReturnType<typeof raiseCheck> | null };
    const people = Math.min(defaultSize(state, def.id, s, null), Math.floor(ctx.pop * 0.5));
    const check = raiseCheck(state, { type: def.id, at: s.id, muster: [{ id: s.id, people: Math.max(10, people) }], provisionMonths: defaultProvisionMonths(def.id, month) });
    return { def, ok: check.ok, reason: check.reason ?? '', check };
  });
  const who = (def: ReturnType<typeof unitTypeDef>) => def.slice === 'men' ? 'Men 15–44 leave; the women, children and old stay.' : 'A proportional slice of every cohort leaves — families, not just hands. Hands leave the private economy first, then gathering, then the fields; buildings keep their staff.';
  const dent = plan.privateHands > 0 ? ` In a town the people who leave were mostly private hands: about −${fmt(taxPerHand)} coins a year in tax for each hand.` : '';
  for (const o of opts.filter((o) => o.ok)) {
    const realmNote = o.check && MATERIAL_IDS.some((k) => (o.check!.fromRealm?.[k] ?? 0) > 0) ? `<div class="dim">${MATERIAL_IDS.filter((k) => (o.check!.fromRealm?.[k] ?? 0) > 0).map((k) => `${fmt(o.check!.fromRealm![k])} ${k}`).join(', ')} will come from the realm stockpile.</div>` : '';
    cubes.push(unitCube('avail', o.def, `<div class="cc">${unitCostChips(state, s, o.def, o.check, false)}</div>`,
      tipH(o.def.name, 'can be raised') + `<div class="cost">${unitCostChips(state, s, o.def, o.check, true)}</div><p>${esc(o.def.blurb ?? '')}</p><p>${who(o.def)}${esc(dent)} The party may be gathered from this settlement, the rest of its cluster and own settlements within 3 hexes; it forms here at the end of the month.</p>${realmNote}<div class="dim">Click to choose the size, the muster, the provisions and a destination.</div>`,
      `data-raise="${o.def.id}"`));
  }
  for (const o of opts.filter((o) => !o.ok)) {
    cubes.push(unitCube('off', o.def, `<div class="cc">${unitCostChips(state, s, o.def, o.check, false)}</div>`,
      tipH(o.def.name, o.def.enabled ? 'not now' : 'not yet') + `<div class="cost">${unitCostChips(state, s, o.def, o.check, true)}</div><p>${esc(o.def.blurb ?? '')}</p><div class="why">${esc(o.reason)}</div>`));
  }
  const standingRows = standing.map((u: Unit) => `<tr><td>${ICON[unitTypeDef(u.type).icon] ?? ICON.walk} <a href="#" data-unit="${u.id}">${esc(u.name)}</a></td><td class="r">${fmt(totalPopulation(u.pop))}</td><td class="r">${fmt1(totalPopulation(u.pop) > 0 ? u.provisions / totalPopulation(u.pop) : 0)}</td><td>${esc(unitState(state, u))}</td></tr>`).join('');
  const away = units.filter((u) => u.home === s.id && unitCell(state.map, u) !== here);
  const awayRows = away.map((u: Unit) => `<tr><td>${ICON[unitTypeDef(u.type).icon] ?? ICON.walk} <a href="#" data-unit="${u.id}">${esc(u.name)}</a></td><td class="r">${fmt(totalPopulation(u.pop))}</td><td class="r">${fmt1(totalPopulation(u.pop) > 0 ? u.provisions / totalPopulation(u.pop) : 0)}</td><td>${esc(unitState(state, u))}${u.report.monthsLeft !== null && Number.isFinite(u.report.monthsLeft) && u.report.monthsLeft > 0 ? ` <span class="dim">· ${u.report.monthsLeft} mo left</span>` : ''}</td></tr>`).join('');
  return `<div class="cubes">${cubes.join('')}</div>
    <p class="note">${forming.length ? `${forming.length} part${forming.length === 1 ? 'y' : 'ies'} mustering · ` : ''}${opts.filter((o) => o.ok).length} can be raised · ${opts.filter((o) => !o.ok).length} not now. Hover a cube for the rule; click a green one to raise. People who leave take their share of the granary with them as provisions; inside the borders a party eats from the cluster it stands in, outside it forages.</p>
    ${standing.length ? `<h3>Parties here <small>standing on this hex</small></h3><table class="data"><tr><th>Party</th><th class="r">people</th><th class="r">food (mo)</th><th>state</th></tr>${standingRows}</table>` : ''}
    ${away.length ? `<h3>Raised here, now afield</h3><table class="data"><tr><th>Party</th><th class="r">people</th><th class="r">food (mo)</th><th>state</th></tr>${awayRows}</table>` : ''}`;
}
