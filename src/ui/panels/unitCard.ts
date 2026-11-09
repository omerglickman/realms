// The unit card (Phase 2 session 1b; UI-DESIGN.md §5): a pinned card in the
// hover card's shape next to a selected unit — type and name, people and
// hands, provisions with a gauge, home, order and months to arrival, state,
// warnings from last month's report — and the orders: Move, Settle here /
// Settle at…, Disband, Cancel order. Display and forwarding only.

import type { GameState } from '../../sim/state';
import { canFortify, fortAt } from '../../sim/forts';
import { CASTLES } from '../../sim/castles';
import { garrisonShare } from '../../sim/garrison';
import { type Unit, unitTypeDef, isForming, unitCell, canSettle, disbandTarget, routeFor, UNITS } from '../../sim/units';
import { totalPopulation, workingHands } from '../../sim/demography';
import { makeBuildOrder, orderSummary } from '../../sim/workbands';
import { infraItem, INFRA_ITEMS } from '../../sim/infrastructure';
import { fmt, fmt1, esc, gauge, ICON } from './format';

/** The road kind the player last chose on a work-band's card (dirt / paved), kept across cards. */
export const buildPrefs: { kind: string } = { kind: 'dirt' };

export interface UnitCardHost {
  onBuildHere(id: string, item: string): void;
  onRoadTo(id: string, item: string): void;
  onBridgeAt(id: string): void;
  onKind(): void;
  onMove(id: string): void;
  onSettleAt(id: string): void;
  onSettleHere(id: string): void;
  onDisband(id: string): void;
  onFortify(id: string): void;
  onCancelOrder(id: string): void;
  onFocusSettlement(id: string): void;
}

/** One-word state of a unit for the card and the status strip. */
export function unitState(state: GameState, u: Unit): string {
  if (isForming(state, u)) return 'mustering';
  if (u.build) {
    if (u.report.blocked) return 'blocked';
    return u.work ? `building ${infraItem(u.work.item).name.toLowerCase()}` : 'to the work';
  }
  if (u.order) {
    if (u.report.blocked) return 'blocked';
    if (u.order.dest === unitCell(state.map, u)) return 'arrived';
    return u.order.then === 'settle' ? 'marching to settle' : u.order.then === 'disband' ? 'going home' : 'marching';
  }
  if (!u.report.inBorders) return 'foraging';
  return 'waiting';
}

export function renderUnitCard(root: HTMLElement, state: GameState, u: Unit, host: UnitCardHost): void {
  const def = unitTypeDef(u.type);
  const pop = totalPopulation(u.pop);
  const hands = workingHands(u.pop);
  const months = pop > 0 ? u.provisions / pop : 0;
  const home = state.settlements[u.home];
  const forming = isForming(state, u);
  const here = unitCell(state.map, u);
  const w = state.map.width;
  const row = (k: string, v: string) => `<div class="pop-row"><span>${k}</span><span class="num">${v}</span></div>`;
  const rows: string[] = [];
  rows.push(row('People', `${fmt(pop)} <span class="dim">· ${fmt(hands)} hands</span>`));
  rows.push(row('Food', `${fmt1(months)} months <span class="dim">of ${u.provisionMonths}</span>`));
  rows.push(gauge(UNITS.provisions.maxMonths > 0 ? months / UNITS.provisions.maxMonths : 0, { marks: [u.provisionMonths / UNITS.provisions.maxMonths], title: `${fmt(u.provisions)} food carried; the mark is the months the party keeps topped up to inside the borders` }));
  rows.push(row('Home', home ? `<a href="#" data-home="${home.id}">${esc(home.name)}</a>` : '<span class="dim">gone</span>'));
  if (u.order) {
    const dest = u.order.dest;
    const dcol = dest % w, drow = Math.floor(dest / w);
    const route = dest === here ? null : routeFor(state, u, dest);
    const left = dest === here ? 0 : route && Number.isFinite(route.months) ? route.months : null;
    const what = u.order.then === 'settle' ? 'to found a village' : u.order.then === 'disband' ? `to disband into ${esc(state.settlements[u.order.to ?? '']?.name ?? 'a settlement')}` : '';
    rows.push(row('Bound for', `(${dcol}, ${drow}) ${what ? `<span class="dim">${what}</span>` : ''}`));
    rows.push(row('Arrives', left === null ? '<span class="warn">no way there</span>' : left === 0 ? 'there now' : `in ${left} month${left === 1 ? '' : 's'}${forming ? ' <span class="dim">after forming</span>' : ''}`));
  }
  if (u.build) {
    const sum = orderSummary(state, u, u.build);
    const it = infraItem(u.build.item);
    const mats = (['timber', 'stone'] as const).filter((k) => sum.materials[k] > 0.5).map((k) => `${fmt(sum.materials[k])} ${k}`).join(', ');
    rows.push(row('Building', `${esc(it.name.toLowerCase())}${u.build.route.length > 1 ? ` <span class="dim">along ${u.build.route.length} hexes</span>` : ''}`));
    rows.push(row('Still to do', `${sum.steps.length} job${sum.steps.length === 1 ? '' : 's'}${sum.bridges ? ` <span class="dim">· ${sum.bridges} bridge${sum.bridges === 1 ? '' : 's'}</span>` : ''} <span class="dim">· ≈ ${fmt1(sum.months)} month${sum.months >= 0.95 && sum.months < 1.05 ? '' : 's'}${mats ? ` · ${mats}` : ''}</span>`));
  }
  if (u.work && !u.build) {
    const wi = infraItem(u.work.item);
    rows.push(row('Unfinished', `${esc(wi.name.toLowerCase())} <span class="dim">(${u.work.cell % w}, ${Math.floor(u.work.cell / w)})</span> <b>${Math.round(u.work.progress * 100)} %</b> <span class="dim">· an order for the same work resumes it</span>`));
  }
  if (u.work && u.build) {
    const wi = infraItem(u.work.item);
    rows.push(row('At work on', `${esc(wi.name.toLowerCase())} <span class="dim">(${u.work.cell % w}, ${Math.floor(u.work.cell / w)})</span> <b>${Math.round(u.work.progress * 100)} %</b>`));
  }
  rows.push(row('State', unitState(state, u) + (u.report.inBorders ? '' : ' <span class="dim">· outside the borders</span>')));
  const r = u.report;
  const warn: string[] = [];
  if (forming) warn.push(`${ICON.hand} forms at the end of this month; cancel it from ${esc(home?.name ?? 'the home settlement')}'s Recruitment page`);
  if (r.blocked) warn.push(`${ICON.warn} ${esc(r.blocked)}`);
  if (r.shortfall > 0) warn.push(`${ICON.skull} <b>starving in the field</b>: ${fmt(r.hungerDeaths)} died last month`);
  else if (!r.inBorders && !forming) warn.push(`${ICON.deer} foraged ${fmt(r.foraged)} last month against ${fmt(r.consumed)} eaten`);
  if (!forming && months < 1 && !r.inBorders) warn.push(`${ICON.warn} the bags are nearly empty`);
  // orders
  const settleCheck = def.canSettle ? canSettle(state, u) : null;
  const disband = disbandTarget(state, u);
  const btns: string[] = [];
  const kind = INFRA_ITEMS.some((i) => i.id === buildPrefs.kind && i.kind === 'road') ? buildPrefs.kind : 'dirt';
  const hereOrder = def.canBuild ? makeBuildOrder(state, u, kind, null) : null;
  if (!forming && def.canBuild) {
    const opts = INFRA_ITEMS.filter((i) => i.kind === 'road').map((i) => `<option value="${i.id}" ${i.id === kind ? 'selected' : ''}>${esc(i.name)}</option>`).join('');
    const ki = infraItem(kind);
    const costText = Object.entries(ki.cost).map(([k, v]) => `${v} ${k}`).join(' + ');
    btns.push(`<select class="buildkind" data-act="kind" title="${esc(ki.blurb ?? '')} ${ki.months} months and ${costText} a hex for a band of ${300}.">${opts}</select>`);
    btns.push(`<button class="btn small primary" data-act="buildHere" ${hereOrder?.order ? `title="Build the ${esc(ki.name.toLowerCase())} on this hex"` : `disabled title="${esc(hereOrder?.reason ?? '')}"`}>Build here</button>`);
    btns.push(`<button class="btn small" data-act="roadTo" title="Click a hex: the band lays the ${esc(ki.name.toLowerCase())} all the way, with bridges where it must">Road to…</button>`);
    btns.push(`<button class="btn small" data-act="bridgeAt" title="Click a river hex beside the band: a bridge">Bridge at…</button>`);
  }
  if (!forming && def.canBuild) {
    // castles: built where the band stands (a ruin is rebuilt at half price; a fort under it saves a quarter of the time)
    for (const ci of INFRA_ITEMS.filter((i) => i.kind === 'castle')) {
      const mk = makeBuildOrder(state, u, ci.id, null);
      let tip = mk.reason ?? '';
      if (mk.order) {
        const sm = orderSummary(state, u, mk.order);
        const mats = (['timber', 'stone'] as const).filter((k) => sm.materials[k] > 0.5).map((k) => `${fmt(sm.materials[k])} ${k}`).join(' + ');
        tip = `≈ ${fmt1(sm.months)} months · ${fmt(sm.money)} coins${mats ? ` + ${mats}` : ''}`;
      }
      btns.push(`<button class="btn small" data-act="castle" data-item="${ci.id}" ${mk.order ? '' : 'disabled '}title="${esc(tip)}">${ICON.castle1 ?? ICON.hammer} ${esc(ci.name.replace(/^Build /i, ''))}</button>`);
    }
  }
  if (!forming) {
    btns.push(`<button class="btn small" data-act="move" title="Walk to a hex you click on the map">${ICON.walk} Move</button>`);
    if (def.canSettle) {
      btns.push(`<button class="btn small" data-act="settleAt" title="Walk to a hex and found a village there">${ICON.village} Settle at…</button>`);
      btns.push(`<button class="btn small primary" data-act="settleHere" ${settleCheck?.ok ? '' : `disabled title="${esc(settleCheck?.reason ?? '')}"`}>Settle here</button>`);
    }
    if (def.canFortify) {
      const fc = canFortify(state, u);
      btns.push(`<button class="btn small" data-act="fortify" ${fc.ok ? `title="Raise a fort on this hex: ${CASTLES.fort.fortifyTimber} timber, holds ${CASTLES.fort.capacity} men, the border grows one ring; it falls into disuse ${CASTLES.fort.decayMonths} months after the last unit leaves"` : `disabled title="${esc(fc.reason ?? '')}"`}>${ICON.castle1 ?? ICON.hammer} Fortify</button>`);
    }
    btns.push(`<button class="btn small ${disband.ok ? '' : ''}" data-act="disband" ${disband.ok ? `title="Rejoin ${esc(disband.target!.name)}${disband.distance ? ` (${disband.distance} hex${disband.distance === 1 ? '' : 'es'} away — walks there)` : ''}"` : `disabled title="${esc(disband.reason ?? '')}"`}>Disband</button>`);
    if (u.order) btns.push(`<button class="btn small danger" data-act="cancel" title="Stay where it stands">Cancel order</button>`);
  }
  root.innerHTML = `
    <div class="pop-head"><span class="pop-ico">${ICON[def.icon] ?? ICON.walk}</span><span class="pop-name">${esc(u.name)}</span><span class="pop-tier">${esc(def.name)}</span></div>
    ${rows.join('')}
    ${warn.length ? `<div class="warnline">${warn.join('<br>')}</div>` : ''}
    ${btns.length ? `<div class="pop-actions">${btns.join('')}</div>` : ''}
    ${settleCheck && !settleCheck.ok && !forming ? `<div class="pop-hint">${esc(settleCheck.reason ?? '')}</div>` : ''}
  `;
  root.querySelector<HTMLSelectElement>('[data-act=kind]')?.addEventListener('change', (e) => { buildPrefs.kind = (e.target as HTMLSelectElement).value; host.onKind(); });
  root.querySelector('[data-act=buildHere]')?.addEventListener('click', () => host.onBuildHere(u.id, kind));
  root.querySelectorAll<HTMLElement>('[data-act=castle]').forEach((b) => b.addEventListener('click', () => host.onBuildHere(u.id, b.dataset.item!)));
  root.querySelector('[data-act=roadTo]')?.addEventListener('click', () => host.onRoadTo(u.id, kind));
  root.querySelector('[data-act=bridgeAt]')?.addEventListener('click', () => host.onBridgeAt(u.id));
  root.querySelector('[data-act=move]')?.addEventListener('click', () => host.onMove(u.id));
  root.querySelector('[data-act=settleAt]')?.addEventListener('click', () => host.onSettleAt(u.id));
  root.querySelector('[data-act=settleHere]')?.addEventListener('click', () => host.onSettleHere(u.id));
  root.querySelector('[data-act=fortify]')?.addEventListener('click', () => host.onFortify(u.id));
  root.querySelector('[data-act=disband]')?.addEventListener('click', () => host.onDisband(u.id));
  root.querySelector('[data-act=cancel]')?.addEventListener('click', () => host.onCancelOrder(u.id));
  root.querySelector<HTMLElement>('[data-home]')?.addEventListener('click', (e) => { e.preventDefault(); host.onFocusSettlement(u.home); });
}
