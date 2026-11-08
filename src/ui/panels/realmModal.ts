// The realm ledger (Session 13): the sum over the player's clusters —
// Overview, Clusters, People, Food, Treasury, Stockpile. Display only,
// except the Send form it forwards.

import type { GameState } from '../../sim/state';
import { calendar } from '../../sim/state';
import { TIERS } from '../../sim/settlements';
import { totalPopulation } from '../../sim/demography';
import { realmReport } from '../../sim/clusters';
import { clusterStock, realmCap } from '../../sim/materials';
import { taxRate } from '../../sim/economy';
import { fmt, fmt1, pct, signed, esc, tierBreakdown, tierLabel, PEOPLE_TIERS, tierGlyph, foodMonths, gauge, hbar, stack, stat, kv, ICON, sparkSvg } from './format';
import { stockBars, sendForm, yearFoodText } from './clusterModal';
import type { ModalSpec } from './modal';

export const REALM_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'clusters', label: 'Clusters' },
  { id: 'people', label: 'People' },
  { id: 'food', label: 'Food' },
  { id: 'treasury', label: 'Treasury' },
  { id: 'stockpile', label: 'Stockpile' },
];

type Report = ReturnType<typeof realmReport>;

/** Realm population at each past December (sum over settlements' histories, aligned on the latest). */
function realmHistory(state: GameState): number[] {
  const list = Object.values(state.settlements).filter((s) => s.faction === state.playerFaction);
  const n = Math.min(...list.map((s) => s.popHistory.length), 30);
  if (!Number.isFinite(n) || n <= 0) return [];
  const out: number[] = new Array(n).fill(0);
  for (const s of list) for (let i = 0; i < n; i++) out[i] += s.popHistory[s.popHistory.length - n + i];
  return out;
}

export function realmSpec(state: GameState, tab: string): ModalSpec {
  const r = realmReport(state);
  const f = state.factions[state.playerFaction];
  const cal = calendar(state.turn);
  const members = r.clusters.flatMap((c) => c.members.map((id) => state.settlements[id]));
  const body =
    tab === 'clusters' ? clustersPage(state, r) :
    tab === 'people' ? peoplePage(state, r) :
    tab === 'food' ? foodPage(state, r) :
    tab === 'treasury' ? treasuryPage(state, r) :
    tab === 'stockpile' ? stockpilePage(state, r) :
    overviewPage(state, r);
  return {
    title: esc(f?.name ?? 'The realm'),
    badge: 'ledger',
    stripe: f?.color ?? '#4a2f1a',
    sub: `${members.length} settlements — ${tierBreakdown(members)} · ${r.clusters.length} clusters (${r.singletons} lone village${r.singletons === 1 ? '' : 's'})`,
    right: `${cal.monthName}, year ${cal.year}`,
    tabs: REALM_TABS,
    tab,
    body,
    wide: tab === 'clusters' || tab === 'food',
  };
}

function privateHands(state: GameState, r: Report): number {
  return r.clusters.flatMap((c) => c.members).reduce((t, id) => t + state.settlements[id].report.privateHands, 0);
}

function overviewPage(state: GameState, r: Report): string {
  const f = state.factions[state.playerFaction];
  const members = r.clusters.flatMap((c) => c.members.map((id) => state.settlements[id]));
  const months = r.population > 0 ? r.food / r.population : 0;
  const hist = realmHistory(state);
  const growth = hist.length >= 2 && hist[hist.length - 2] > 0 ? hist[hist.length - 1] / hist[hist.length - 2] - 1 : null;
  const ly = f?.lastYear ?? null;
  const stats = [
    stat(ICON.people, 'People', fmt(r.population), growth !== null ? `${pct(growth)} last year` : `${r.clusters.length} clusters`),
    stat(ICON.granary, 'Food', `${fmt1(months)} <small>months</small>`, `${fmt(r.food)} in all granaries` + (r.lastYear ? ` · ${signed(r.lastYear.produced - r.lastYear.consumed)} last year` : ''), gauge(months / 24, { marks: [3 / 24] })),
    stat(ICON.coin, 'Treasury', `${fmt(f?.treasury ?? 0)} <small>coins</small>`, ly ? `${signed(ly.tax + ly.sales - ly.spent - (ly.upkeep ?? 0))} last year · +${fmt(f?.year.tax ?? 0)} tax so far this year` : `+${fmt(f?.year.tax ?? 0)} tax this year`),
    stat(ICON.goods, 'Stockpile', `${fmt(f?.stock.timber ?? 0)} <small>timber</small>`, `${fmt(f?.stock.stone ?? 0)} stone · ${fmt(f?.stock.goods ?? 0)} goods`),
  ].join('');
  const warnings: string[] = [];
  const starvedThis = r.year.hungerDeaths, starvedLast = r.lastYear?.hungerDeaths ?? 0;
  if (starvedThis > 0.5) warnings.push(`${ICON.skull} <b>${fmt(starvedThis)} starved this year.</b> See the Food page for where.`);
  else if (starvedLast > 0.5) warnings.push(`${ICON.warn} ${fmt(starvedLast)} starved last year.`);
  const lost = f ? f.year.lost.timber + f.year.lost.stone + f.year.lost.goods : 0;
  if (lost > 0.5) warnings.push(`${ICON.warn} ${fmt(lost)} materials were lost above the realm's cap this year — ship them to a cluster or build Warehouses.`);
  const noMarket = r.clusters.filter((c) => c.members.length > 1 && !c.members.some((id) => state.settlements[id].buildings.includes('market')));
  if (noMarket.length) warnings.push(`${ICON.goods} ${noMarket.length} cluster${noMarket.length === 1 ? ' has' : 's have'} no Market: ${noMarket.map((c) => esc(state.settlements[c.root].name)).join(', ')} — their goods pile up unsold.`);
  const rows: [string, string][] = [
    ['Last year', r.lastYear ? yearFoodText(r.lastYear, r.population, false) : '<span class="dim">no year-end yet</span>'],
    ['This year', r.year.months > 0 ? yearFoodText(r.year, r.population, true) : '<span class="dim">nothing yet</span>'],
    ['Tax base', `${fmt(privateHands(state, r))} private hands in towns and cities — the artisans, labourers and traders the crown taxes at ${taxRate()} coins a head`],
  ];
  return `<div class="stats">${stats}</div>
    ${warnings.length ? `<p>${warnings.join('<br>')}</p>` : ''}
    <h3>People by tier</h3>${stack(PEOPLE_TIERS.map((i) => ({ label: tierLabel(i, members), value: r.popByTier[i], cls: `c${4 - i}` })).reverse())}
    <h3>The year</h3>${kv(rows)}`;
}

function clustersPage(state: GameState, r: Report): string {
  const rows = r.clusters.map((c) => {
    const rs = state.settlements[c.root];
    const t = c.totals;
    const months = t.monthlyNeed > 0 ? t.food / t.monthlyNeed : 0;
    const st = clusterStock(state, c.root);
    const y = t.lastYear ?? t.year;
    const starved = y.hungerDeaths;
    const hasMarket = c.members.some((id) => state.settlements[id].buildings.includes('market'));
    return `<tr><td>${tierGlyph(rs.tier)}<a href="#" data-cluster="${c.root}">${esc(rs.name)}</a></td><td class="dimrow">${c.members.length === 1 ? 'lone village' : tierBreakdown(c.members.map((id) => state.settlements[id]))}</td><td class="r">${fmt(t.population)}</td><td>${hbar(months, 24, months < 3 ? 'c5' : months < 6 ? 'c3' : 'c2')} <span class="num">${fmt1(months)}</span></td><td class="r ${y.produced >= y.consumed ? 'good' : 'warn'}">${signed(y.produced - y.consumed)}</td><td class="r">${starved > 0.5 ? `<span class="warn">${fmt(starved)}</span>` : ''}</td><td class="r">${fmt(st.timber)}</td><td class="r">${fmt(st.stone)}</td><td class="r">${fmt(st.goods)}${!hasMarket && st.goods > 0.5 ? ` <span class="warn" title="no Market: goods unsold">${ICON.warn}</span>` : ''}</td><td class="r">${fmt(y.tax)}</td></tr>`;
  }).join('');
  return `<table class="data"><tr><th>Cluster</th><th>settlements</th><th class="r">people</th><th>food (months)</th><th class="r">net food</th><th class="r">starved</th><th class="r">timber</th><th class="r">stone</th><th class="r">goods</th><th class="r">tax</th></tr>${rows}</table>
    <p class="note">Food, starved and tax are last year's (this year's where no year has ended). Click a cluster for its ledger.</p>`;
}

function peoplePage(state: GameState, r: Report): string {
  const hist = realmHistory(state);
  const members = r.clusters.flatMap((c) => c.members.map((id) => state.settlements[id]));
  const births = members.reduce((t, s) => t + s.report.births, 0), deaths = members.reduce((t, s) => t + s.report.deaths, 0);
  const trickle = members.reduce((t, s) => t + s.report.trickleIn, 0);
  const epidemics = members.filter((s) => s.report.epidemic).length;
  const stats = [
    stat(ICON.people, 'People', fmt(r.population), hist.length >= 2 ? `${pct(hist[hist.length - 1] / hist[hist.length - 2] - 1)} last year` : ''),
    stat(ICON.arrowUp, 'Born last year', fmt(births), births || deaths ? `${fmt(deaths)} died · net ${signed(births - deaths)}` : 'no year-end yet'),
    stat(ICON.walk, 'Moved to towns', fmt(trickle), 'the yearly pull from prosperous parents'),
    stat(ICON.skull, 'Starved', fmt(r.lastYear?.hungerDeaths ?? 0), `last year${epidemics ? ` · ${epidemics} epidemic${epidemics === 1 ? '' : 's'}` : ''}`),
  ].join('');
  const bars = PEOPLE_TIERS.map((i) => `<div class="bl">${tierGlyph(i)}${tierLabel(i, members)}</div>${hbar(r.popByTier[i], r.population, `c${4 - i}`)}<div class="bv">${fmt(r.popByTier[i])} <span class="dim">(${Math.round(100 * r.popByTier[i] / Math.max(1, r.population))} %)</span></div>`).reverse().join('');
  const biggest = members.slice().sort((a, b) => totalPopulation(b.pop) - totalPopulation(a.pop)).slice(0, 12);
  const rows = biggest.map((s) => `<tr><td>${tierGlyph(s.tier)}<a href="#" data-focus="${s.id}">${esc(s.name)}</a></td><td class="r">${fmt(totalPopulation(s.pop))}</td><td class="r">${s.report.births ? fmt(s.report.births) : ''}</td><td class="r">${s.report.deaths ? fmt(s.report.deaths) : ''}</td><td class="r">${s.report.trickleIn > 0.5 ? `+${fmt(s.report.trickleIn)}` : s.report.trickleOut > 0.5 ? `−${fmt(s.report.trickleOut)}` : ''}</td><td class="r">${fmt1(foodMonths(s))}</td></tr>`).join('');
  return `<div class="stats">${stats}</div>
    <h3>Where they live</h3><div class="bars">${bars}</div>
    ${hist.length >= 1 ? `<h3>Over the years</h3>${sparkSvg(hist, r.population, 'now')}<p class="note">People in the realm at each December (as far back as every settlement remembers).</p>` : ''}
    <h3>The largest settlements <small>last year's births, deaths and the pull</small></h3>
    <table class="data"><tr><th>Settlement</th><th class="r">people</th><th class="r">born</th><th class="r">died</th><th class="r">pull</th><th class="r">food (mo)</th></tr>${rows}</table>`;
}

function foodPage(state: GameState, r: Report): string {
  const y = r.lastYear ?? r.year;
  const partial = !r.lastYear;
  const rows = r.clusters.map((c) => {
    const t = c.totals;
    const ly = t.lastYear ?? t.year;
    const months = t.monthlyNeed > 0 ? t.food / t.monthlyNeed : 0;
    return `<tr><td>${tierGlyph(state.settlements[c.root].tier)}<a href="#" data-cluster="${c.root}">${esc(state.settlements[c.root].name)}</a></td><td class="r">${fmt(t.population)}</td><td class="r">${fmt(ly.produced)}</td><td class="r">${fmt(ly.consumed)}</td><td class="r ${ly.produced >= ly.consumed ? 'good' : 'warn'}">${signed(ly.produced - ly.consumed)}</td><td class="r">${ly.titheIn > 0.5 ? fmt(ly.titheIn) : ''}</td><td class="r">${ly.received > 0.5 ? fmt(ly.received) : ''}</td><td class="r">${ly.hungerDeaths > 0.5 ? `<span class="warn">${fmt(ly.hungerDeaths)}</span>` : ''}</td><td class="r">${ly.migrantsIn > 0.5 ? fmt(ly.migrantsIn) : ''}</td><td class="r">${fmt1(months)}</td></tr>`;
  }).join('');
  const hungry = r.clusters.flatMap((c) => c.members.map((id) => state.settlements[id])).filter((s) => (s.lastYear?.hungerDeaths ?? 0) > 0.5 || s.report.hungerDeaths > 0.5).sort((a, b) => (b.lastYear?.hungerDeaths ?? 0) - (a.lastYear?.hungerDeaths ?? 0)).slice(0, 10);
  return `<h3>${partial ? 'This year so far' : 'Last year'}</h3>${stack([{ label: 'eaten', value: y.consumed, cls: 'c2' }, { label: 'tithed to parents', value: y.titheIn, cls: 'c3' }, { label: 'surplus moved up', value: y.received, cls: 'c1' }])}
    <p class="note">Grown ${fmt(y.produced)}, eaten ${fmt(y.consumed)}: <b class="${y.produced >= y.consumed ? 'good' : 'warn'}">${signed(y.produced - y.consumed)}</b>${y.hungerDeaths > 0.5 ? ` · <b class="warn">${fmt(y.hungerDeaths)} starved</b>` : ''}. Tithe and surplus move inside clusters only; the realm as a whole cannot move grain yet (roads come with Phase 2).</p>
    <h3>By cluster</h3>
    <table class="data"><tr><th>Cluster</th><th class="r">people</th><th class="r">grown</th><th class="r">eaten</th><th class="r">net</th><th class="r">tithe</th><th class="r">surplus</th><th class="r">starved</th><th class="r">fled</th><th class="r">months now</th></tr>${rows}</table>
    ${hungry.length ? `<h3>Where people go hungry</h3><table class="data"><tr><th>Settlement</th><th class="r">starved last year</th><th class="r">last month</th><th class="r">food (mo)</th></tr>${hungry.map((s) => `<tr><td>${tierGlyph(s.tier)}<a href="#" data-focus="${s.id}">${esc(s.name)}</a></td><td class="r warn">${fmt(s.lastYear?.hungerDeaths ?? 0)}</td><td class="r warn">${s.report.hungerDeaths > 0.5 ? fmt(s.report.hungerDeaths) : ''}</td><td class="r">${fmt1(foodMonths(s))}</td></tr>`).join('')}</table>` : '<p class="good">Nobody starved last year.</p>'}`;
}

function treasuryPage(state: GameState, r: Report): string {
  const f = state.factions[state.playerFaction];
  if (!f) return '<p class="note">No faction.</p>';
  const y = f.year, ly = f.lastYear;
  const up = (k: typeof y) => k.upkeep ?? 0;
  const net = (k: typeof y) => k.tax + k.sales - k.spent - up(k);
  const stats = [
    stat(ICON.coin, 'Treasury', `${fmt(f.treasury)} <small>coins</small>`, 'the realm\'s money; clusters hold grain and materials, never coin'),
    stat(ICON.scroll, 'Tax base', fmt(privateHands(state, r)), `private hands × ${taxRate()} coins a year × administration`),
    stat(ICON.goods, 'Sales', `${fmt(y.sales)} <small>this year</small>`, ly ? `${fmt(ly.sales)} last year · only Markets sell goods` : 'only Markets sell goods'),
    stat(ICON.hammer, 'Spent', `${fmt(y.spent)} <small>this year</small>`, ly ? `${fmt(ly.spent)} last year, on buildings and castles` : 'on buildings and castles'),
  ].join('');
  const ledger = `<table class="data"><tr><th></th><th class="r">tax</th><th class="r">sales</th><th class="r">spent</th><th class="r" title="castle wages and upkeep">castles</th><th class="r">net</th></tr>
    <tr><td>This year <span class="dim">(${y.months} month${y.months === 1 ? '' : 's'})</span></td><td class="r">+${fmt(y.tax)}</td><td class="r">+${fmt(y.sales)}</td><td class="r">−${fmt(y.spent)}</td><td class="r">${up(y) > 0.5 ? `−${fmt(up(y))}` : ''}</td><td class="r ${net(y) >= 0 ? 'good' : 'warn'}">${signed(net(y))}</td></tr>
    ${ly ? `<tr><td>Last year</td><td class="r">+${fmt(ly.tax)}</td><td class="r">+${fmt(ly.sales)}</td><td class="r">−${fmt(ly.spent)}</td><td class="r">${up(ly) > 0.5 ? `−${fmt(up(ly))}` : ''}</td><td class="r ${net(ly) >= 0 ? 'good' : 'warn'}">${signed(net(ly))}</td></tr>` : ''}</table>`;
  const byCluster = r.clusters.filter((c) => (c.totals.lastYear?.tax ?? c.totals.year.tax) > 0.5).map((c) => {
    const t = c.totals.lastYear ?? c.totals.year;
    const ph = c.members.reduce((a, id) => a + state.settlements[id].report.privateHands, 0);
    const taxLost = t.taxLost;
    return `<tr><td>${tierGlyph(state.settlements[c.root].tier)}<a href="#" data-cluster="${c.root}">${esc(state.settlements[c.root].name)}</a></td><td class="r">${fmt(ph)}</td><td class="r">${fmt(t.tax)}</td><td class="r dimrow">${taxLost > 0.5 ? `−${fmt(taxLost)}` : ''}</td><td class="r">${t.sold > 0.5 ? fmt(t.sold) : ''}</td></tr>`;
  }).join('');
  return `<div class="stats">${stats}</div>
    <h3>The ledger</h3>${ledger}
    <h3>Who pays <small>last year, by cluster</small></h3>
    ${byCluster ? `<table class="data"><tr><th>Cluster</th><th class="r">private hands</th><th class="r">tax</th><th class="r">forgone to building</th><th class="r">sales</th></tr>${byCluster}</table>` : '<p class="note">No tax yet.</p>'}
    <p class="note">The private economy (DESIGN §4.2b): in a town, city or metropolis every hand not in a building or a field is a private hand that pays tax and makes goods on its own. Construction gangs, gatherers, levies and settlers are drawn from them, and the tax they stop paying is the cost.</p>`;
}

function stockpilePage(state: GameState, r: Report): string {
  const f = state.factions[state.playerFaction];
  if (!f) return '';
  const cap = realmCap();
  const y = f.year, ly = f.lastYear;
  const roots = r.clusters.map((c) => ({ root: c.root, label: `${state.settlements[c.root].name}${c.members.length > 1 ? ' cluster' : ''}` }));
  const rows = r.clusters.map((c) => {
    const st = clusterStock(state, c.root);
    const hasMarket = c.members.some((id) => state.settlements[id].buildings.includes('market'));
    const warehouses = c.members.filter((id) => state.settlements[id].buildings.includes('warehouse')).length;
    return `<tr><td>${tierGlyph(state.settlements[c.root].tier)}<a href="#" data-cluster="${c.root}">${esc(state.settlements[c.root].name)}</a></td><td class="r">${fmt(st.timber)}</td><td class="r">${fmt(st.stone)}</td><td class="r">${fmt(st.goods)}</td><td class="dimrow">${hasMarket ? 'Market' : ''}${hasMarket && warehouses ? ' · ' : ''}${warehouses ? `${warehouses} Warehouse${warehouses === 1 ? '' : 's'}` : ''}</td></tr>`;
  }).join('');
  return `<h3>The realm's stockpile</h3>${stockBars(f.stock, cap)}
    <p class="note">What the clusters hold above their caps flows here each month; above the realm's cap it is lost. This year: +${fmt(y.overflowIn.timber)} / +${fmt(y.overflowIn.stone)} / +${fmt(y.overflowIn.goods)} arrived, <span class="${y.lost.timber + y.lost.stone + y.lost.goods > 0.5 ? 'warn' : ''}">${fmt(y.lost.timber)} / ${fmt(y.lost.stone)} / ${fmt(y.lost.goods)} lost</span>${ly ? ` · last year ${fmt(ly.lost.timber + ly.lost.stone + ly.lost.goods)} lost` : ''}. Goods here are sold by nobody — ship them to a cluster with a Market.</p>
    <h3>Ship to a cluster</h3>${sendForm(state, roots)}
    <h3>What the clusters hold</h3>
    <table class="data"><tr><th>Cluster</th><th class="r">timber</th><th class="r">stone</th><th class="r">goods</th><th>sells / stores</th></tr>${rows}</table>`;
}
