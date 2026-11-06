// The top ledger strip (Session 13): the realm's bottom lines, always on
// screen — date, treasury, people, food, the realm stockpile — each with a
// hover tip and a click that opens the matching page of the realm ledger.
// Display only.

import type { GameState } from '../../sim/state';
import { calendar } from '../../sim/state';
import { realmReport } from '../../sim/clusters';
import { realmCap, MATERIAL_IDS } from '../../sim/materials';
import { fmt, fmt1, pct, signed, esc, ICON, gauge, popByTierText } from './format';

export interface HudHost {
  /** open the realm ledger on a page */
  onRealm(tab: string): void;
}

/** Realm population at the last two Decembers (sums over settlements' popHistory), for a yearly growth figure. */
function realmGrowth(state: GameState): number | null {
  let a = 0, b = 0, n = 0;
  for (const s of Object.values(state.settlements)) {
    if (s.faction !== state.playerFaction) continue;
    const h = s.popHistory;
    if (h.length >= 2) { a += h[h.length - 2]; b += h[h.length - 1]; n++; }
  }
  return n > 0 && a > 0 ? b / a - 1 : null;
}

export function renderHud(root: HTMLElement, state: GameState, host: HudHost): void {
  const r = realmReport(state);
  const f = state.factions[state.playerFaction];
  const cal = calendar(state.turn);
  const months = r.population > 0 ? r.food / r.population : 0;
  const growth = realmGrowth(state);
  const ly = f?.lastYear ?? null;
  const netLast = ly ? ly.tax + ly.sales - ly.spent : null;
  const netThis = f ? f.year.tax + f.year.sales - f.year.spent : 0;
  const starvedLast = r.lastYear?.hungerDeaths ?? 0;
  const starvedThis = r.year.hungerDeaths;
  const cap = realmCap();
  const stock = f?.stock ?? { timber: 0, stone: 0, goods: 0 };

  const tile = (id: string, icon: string, label: string, num: string, sub: string, tip: string, alert = false) =>
    `<div class="tile${alert ? ' alert' : ''}" data-tab="${id}" data-tip="1">${icon}<div class="tv"><div class="tl">${label}</div><div class="tn">${num}</div>${sub ? `<div class="ts">${sub}</div>` : ''}</div><div class="tip">${tip}</div></div>`;
  const tipH = (h: string) => `<div class="tiph">${h}</div>`;

  const tiles = [
    tile('treasury', ICON.coin, 'Treasury', `<b>${fmt(f?.treasury ?? 0)}</b> coins`,
      netLast !== null ? `<span class="${netLast >= 0 ? 'up' : 'down'}">${signed(netLast)}</span> last year` : `${signed(netThis)} this year`,
      tipH('The crown\'s money') + `Tax on the private hands of towns and cities, plus goods sold at Markets; it pays for buildings.<br>` +
      `This year: +${fmt(f?.year.tax ?? 0)} tax, +${fmt(f?.year.sales ?? 0)} sales, −${fmt(f?.year.spent ?? 0)} on buildings.` +
      (ly ? `<br>Last year: +${fmt(ly.tax)} tax, +${fmt(ly.sales)} sales, −${fmt(ly.spent)} spent.` : '') + `<br><span class="dim">Click for the treasury ledger.</span>`),
    tile('people', ICON.people, 'People', `<b>${fmt(r.population)}</b>`,
      growth !== null ? `<span class="${growth >= 0 ? 'up' : 'down'}">${pct(growth)}</span> last year` : `${r.clusters.length} clusters`,
      tipH('Everyone in the realm') + `${popByTierText(r.popByTier, r.clusters.flatMap((c) => c.members.map((id) => state.settlements[id])))}.` +
      (r.lastYear ? `<br>Last year: ${fmt(r.lastYear.migrantsIn)} moved inside the clusters.` : '') + `<br><span class="dim">Click for the people of the realm.</span>`),
    tile('food', ICON.wheat, 'Food', `<b>${fmt1(months)}</b> months`,
      starvedThis > 0.5 ? `<span class="down">${fmt(starvedThis)} starved</span> this year` : starvedLast > 0.5 ? `<span class="down">${fmt(starvedLast)} starved</span> last year` : r.lastYear ? `${signed(r.lastYear.produced - r.lastYear.consumed)} last year` : 'in all granaries',
      tipH('Grain in all granaries') + `${fmt(r.food)} food — one food feeds one person for a month; the harvest comes in September and October.` +
      (r.lastYear ? `<br>Last year: ${fmt(r.lastYear.produced)} grown, ${fmt(r.lastYear.consumed)} eaten, ${fmt(r.lastYear.hungerDeaths)} starved.` : '') +
      `<br>This year so far: ${fmt(r.year.produced)} grown, ${fmt(r.year.consumed)} eaten${starvedThis > 0.5 ? `, <b class="warn">${fmt(starvedThis)} starved</b>` : ''}.` + `<br><span class="dim">Click for the realm's food.</span>`,
      starvedThis > 0.5),
    // one compact tile for the realm's stockpile: three icon + number pairs, caps underneath (Session 13b)
    (() => {
      const icons: Record<string, string> = { timber: ICON.timber, stone: ICON.stone, goods: ICON.goods };
      const lost = MATERIAL_IDS.reduce((t, k) => t + (f?.year.lost[k] ?? 0), 0);
      const arrived = MATERIAL_IDS.reduce((t, k) => t + (f?.year.overflowIn[k] ?? 0), 0);
      const anyFull = MATERIAL_IDS.some((k) => Number.isFinite(cap[k]) && stock[k] >= cap[k] - 0.5);
      const num = MATERIAL_IDS.map((k) => `<span class="mat" title="${k}">${icons[k]}<b>${fmt(stock[k])}</b></span>`).join('');
      const sub = lost > 0.5 ? `<span class="down">${fmt(lost)} lost</span> this year` : arrived > 0.5 ? `+${fmt(arrived)} this year` : anyFull ? 'at the cap' : `caps ${MATERIAL_IDS.map((k) => Number.isFinite(cap[k]) ? fmt(cap[k]) : '∞').join(' / ')}`;
      const tip = tipH('The realm\'s stockpile') + `What the clusters hold above their own caps flows here; above the realm's cap it is lost. You ship it from here to any cluster.` +
        `<table class="kv">${MATERIAL_IDS.map((k) => `<tr><th>${icons[k]} ${k}</th><td>${fmt(stock[k])} <span class="dim">/ ${Number.isFinite(cap[k]) ? fmt(cap[k]) : '∞'}</span>${gauge(Number.isFinite(cap[k]) && cap[k] > 0 ? stock[k] / cap[k] : 0, { cls: stock[k] >= cap[k] - 0.5 ? 'mid' : '' })}<span class="dim">+${fmt(f?.year.overflowIn[k] ?? 0)} arrived, ${fmt(f?.year.lost[k] ?? 0)} lost this year</span></td></tr>`).join('')}</table>` +
        `<span class="dim">Click for the stockpile and shipping.</span>`;
      return tile('stockpile', '', 'Stockpile', num, sub, tip, lost > 0.5);
    })(),
  ];
  root.innerHTML = tiles.join('');
  root.querySelectorAll<HTMLElement>('.tile').forEach((t) => t.addEventListener('click', () => host.onRealm(t.dataset.tab!)));
  const date = document.getElementById('info-date');
  if (date) date.innerHTML = `<b>${esc(cal.monthName)}</b>, year ${cal.year}`;
}
