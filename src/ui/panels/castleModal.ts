// The castle ledger and hover card (Session 18, DESIGN §3.5). A castle has no
// residents, so it gets a page of its own instead of the settlement tabs:
// who staffs it and at what share, what its garrison can be, the siege
// reserve, what it costs the treasury, the hexes it works, what is under it,
// and the upgrade. Display only, except the player actions it forwards.

import type { GameState } from '../../sim/state';
import { calendar } from '../../sim/state';
import { TIERS, tierIndex, childrenOf, workedCellsBySettlement, isRuin, type Settlement } from '../../sim/settlements';
import { ECONOMY } from '../../sim/economy';
import { CASTLES, castleKindOf, castleNeed, allocateService } from '../../sim/castles';
import { canUpgrade, upgradeStep } from '../../sim/upgrades';
import { garrisonOf } from '../../sim/garrison';
import { fmt, fmt1, esc, tierName, tierGlyph, gauge, stat, kv, ICON } from './format';
import type { ModalSpec } from './modal';

export interface CastleHost {
  onRename(id: string, name: string): void;
  onRemove(id: string): void;
  onUpgrade(id: string): void;
  onCancelUpgrade(id: string): void;
  onSelectUnit(unitId: string): void;
}

function reserveInfo(s: Settlement): { cap: number; months: number; fraction: number } {
  const kind = castleKindOf(s);
  const perMonth = kind.capacity * ECONOMY.foodPerPersonPerMonth; // the full garrison's monthly need
  const cap = perMonth * CASTLES.reserve.months;
  return { cap, months: perMonth > 0 ? s.food / perMonth : 0, fraction: cap > 0 ? s.food / cap : 0 };
}

function monthsToRuin(s: Settlement): number {
  return Math.max(0, CASTLES.ruin.afterMonths - (s.castle?.unstaffedMonths ?? 0));
}

export function castleSpec(state: GameState, s: Settlement, editing: boolean): ModalSpec {
  const c = s.castle!;
  const kind = castleKindOf(s);
  const parent = s.parent ? state.settlements[s.parent] : null;
  const cal = calendar(state.turn);
  const worked = workedCellsBySettlement(state).get(s.id) ?? [];
  const svc = allocateService(state, workedCellsBySettlement(state));
  const info = svc.byCastle.get(s.id);
  const need = castleNeed(state, s, worked);
  const res = reserveInfo(s);
  const fed = (c.staffing ?? 0);
  const ruin = isRuin(s);
  const children = childrenOf(state, s.id);
  const subBits = [
    parent ? `under <a href="#" data-focus="${parent.id}">${esc(parent.name)}</a> (${tierName(parent).toLowerCase()})` : '<span class="dim">stands alone</span>',
    `hex (${s.col}, ${s.row})`,
  ];

  let body: string;
  if (ruin) {
    body = `<p class="warn">${ICON.warn} <b>${esc(s.name)} lies in ruins.</b> Nobody was left to serve it for ${CASTLES.ruin.afterMonths} months: it has no influence and no garrison. A work-band standing here can raise it again for ${Math.round(100 * CASTLES.ruin.rebuildCostShare)} % of the price (unit card → Build castle).</p>`;
  } else {
    const stats = [
      stat(ICON.hand, 'Staffing', `${Math.round(100 * fed)} <small>%</small>`, `${fmt(c.gotHands)} of ${fmt(c.needHands || need.total)} hands in service`, gauge(fed, { title: 'hands in service ÷ hands it needs' })),
      stat(ICON.castle1 ?? ICON.people, 'Garrison room', `${fmt(c.garrisonCapacity)}`, `${fmt(garrisonOf(state, s).inside)} inside · of ${fmt(kind.capacity)} at full staffing`),
      stat(ICON.granary, 'Siege reserve', `${fmt1(res.months)} <small>of ${CASTLES.reserve.months} months</small>`, `${fmt(s.food)} food · fed by its own hexes, then its subordinates' surplus`, gauge(res.fraction, { title: 'food in the reserve ÷ the reserve for a full garrison' })),
      stat(ICON.coin, 'Cost', `${fmt((c.wages + c.upkeep) * 12)} <small>coins / yr</small>`, `wages ${fmt(c.wages * 12)} (${fmt(c.gotHands)} hands × ${CASTLES.service.wagePerHandPerMonth}/mo) + upkeep ${fmt(kind.upkeepPerYear)}`),
    ].join('');
    const served = (info?.from ?? []).slice().sort((a, b) => b.hands - a.hands).map((f) => {
      const o = state.settlements[f.id];
      return o ? `${tierGlyph(o.tier)}<a href="#" data-focus="${o.id}">${esc(o.name)}</a> <span class="dim num">${fmt(f.hands)} hands</span>` : '';
    }).filter(Boolean).join(' · ');
    const rows: [string, string][] = [
      ['Served by', served || '<span class="warn">nobody — no settlement of yours within its influence rings</span>'],
      ['Worked hexes', worked.length ? `${worked.length} (${need.jobs.length ? need.jobs.map((j) => j.kind).join(', ') : 'no food'}) · ${fmt(need.hexHands)} hands · ${fmt(kind.staffHands)} more run the walls` : '<span class="dim">none — a small castle works no land</span>'],
      ['Garrison', garrisonOf(state, s).rows.length
        ? garrisonOf(state, s).rows.map((r) => `<a href="#" data-unit="${r.unit.id}">${esc(r.unit.name)}</a> <span class="dim num">${fmt(r.inside)} inside${r.inside < r.people - 0.5 ? ` of ${fmt(r.people)} (the rest camp outside)` : ''}</span>`).join(' · ')
        : '<span class="dim">empty — a levy standing here becomes the garrison and eats from the reserve</span>'],
      ['Under it', children.length ? children.map((k) => `${tierGlyph(k.tier)}<a href="#" data-focus="${k.id}">${esc(k.name)}</a>`).join(', ') : '<span class="dim">nothing yet</span>'],
      ['Influence', `${TIERS[s.tier].influenceRings} rings`],
      ['Founded', `${calendar(s.foundedTurn).monthName}, year ${calendar(s.foundedTurn).year}`],
    ];
    const warnings: string[] = [];
    if (c.unstaffedMonths > 0) warnings.push(`${ICON.warn} <b>Nobody has served this castle for ${c.unstaffedMonths} month${c.unstaffedMonths === 1 ? '' : 's'}</b> — it falls into ruin in ${monthsToRuin(s)}.`);
    else if (fed < 0.999) warnings.push(`${ICON.hand} <b>Short of hands:</b> the villages in reach can lend ${fmt(c.gotHands)} of the ${fmt(c.needHands)} it needs (no settlement gives more than a third of its hands).`);
    body = `<div class="stats">${stats}</div>${warnings.length ? `<p class="warn">${warnings.join('<br>')}</p>` : ''}${upgradeCard(state, s)}${kv(rows)}`;
  }
  const foot = editing ? `<span class="dim">Editor:</span> <span class="spacer"></span><button id="sp-remove" class="btn small danger">Remove castle</button>` : undefined;
  return {
    title: `<input id="sp-name" type="text" value="${esc(s.name)}" ${editing ? '' : 'readonly'} />`,
    badge: ruin ? `${tierName(s)} (ruin)` : s.upgrade ? `${tierName(s)} → ${TIERS[s.upgrade.to].name}` : tierName(s),
    stripe: state.factions[s.faction ?? '']?.color ?? '#4a2f1a',
    sub: subBits.join(' · '),
    right: `${cal.monthName}, year ${cal.year}`,
    body,
    foot,
  };
}

function upgradeCard(state: GameState, s: Settlement): string {
  if (s.faction !== state.playerFaction) return '';
  if (s.upgrade) {
    const step = upgradeStep(s.tier);
    const months = step ? step.months : 12;
    const left = Math.max(0, Math.ceil((1 - s.upgrade.progress) * months - 1e-9));
    return `<div class="card project"><div class="ch"><span class="cn">${ICON.arrowUp} Being raised to a ${esc(TIERS[s.upgrade.to].name.toLowerCase())}</span><span class="cf">upgrade in place</span></div>
      <div class="blurb">${Math.round(100 * s.upgrade.progress)} % done, ~${left}+ months left at full speed · built by the spare hands of the settlements in reach; a work-band standing here adds its own (${step?.hands ?? 0} hands give full speed).</div>
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
    `<span title="months at full speed">${ICON.calendar} ${step.months} mo</span>`,
    `<span title="spare hands in reach for full speed">${ICON.hand} ${fmt(step.hands ?? 0)}</span>`,
  ].join('');
  return `<div class="card ${check.ok ? 'built' : 'off'}"><div class="ch"><span class="cn">${ICON.arrowUp} Raise to a ${esc(to.name.toLowerCase())}</span><span class="cf">draft prices (the next kind's minus this one's)</span></div>
    <div class="cost">${chips}</div>
    <div class="blurb">A ${esc(to.name.toLowerCase())} has ${to.influenceRings} rings of influence${(to.workHexes ?? 0) > 0 ? ` and works ${to.workHexes} hex${to.workHexes === 1 ? '' : 'es'}` : ''}. The money and materials are paid now and refunded if cancelled.</div>
    <div class="cfoot">${check.ok ? `<span class="spacer"></span><button class="btn small primary" data-upgrade="1">Begin</button>` : `<span class="why">${esc(check.reason ?? '')}</span>`}</div></div>`;
}

export function wireCastle(root: HTMLElement, s: Settlement, host: CastleHost, editing: boolean): void {
  const name = root.querySelector<HTMLInputElement>('#sp-name');
  if (name && editing) name.addEventListener('change', () => { const v = name.value.trim(); if (v && v !== s.name) host.onRename(s.id, v); });
  root.querySelector<HTMLButtonElement>('#sp-remove')?.addEventListener('click', () => host.onRemove(s.id));
  root.querySelectorAll<HTMLElement>('[data-unit]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); host.onSelectUnit(b.dataset.unit!); }));
  root.querySelector<HTMLButtonElement>('[data-upgrade]')?.addEventListener('click', () => host.onUpgrade(s.id));
  root.querySelector<HTMLButtonElement>('[data-cancel-upgrade]')?.addEventListener('click', (e) => { e.stopPropagation(); host.onCancelUpgrade(s.id); });
}

/** The hover card of a castle. */
export function renderCastleHover(root: HTMLElement, state: GameState, s: Settlement): void {
  const c = s.castle!;
  const ruin = isRuin(s);
  const parent = s.parent ? state.settlements[s.parent] : null;
  const res = reserveInfo(s);
  const row = (k: string, v: string) => `<div class="pop-row"><span>${k}</span><span class="num">${v}</span></div>`;
  root.innerHTML = `
    <div class="pop-head"><span class="pop-name">${esc(s.name)}</span><span class="pop-tier">${tierName(s)}${ruin ? ' (ruin)' : ''}</span></div>
    ${ruin ? '<div class="warnline">⚠ in ruins — a work-band can rebuild it</div>' : `
    ${row('Staffing', `${Math.round(100 * c.staffing)} % <span class="dim">(${fmt(c.gotHands)} of ${fmt(c.needHands)} hands)</span>`)}
    ${gauge(c.staffing, { title: 'hands in service ÷ hands it needs' })}
    ${row('Garrison room', `${fmt(c.garrisonCapacity)} <span class="dim">of ${fmt(castleKindOf(s).capacity)}</span>`)}
    ${row('Reserve', `${fmt1(res.months)} months <span class="dim">of ${CASTLES.reserve.months}</span>`)}
    ${row('Cost', `${fmt((c.wages + c.upkeep) * 12)} coins/yr`)}
    ${row(parent ? 'Under' : 'Parent', parent ? `${esc(parent.name)} <span class="dim">(${tierName(parent)})</span>` : '<span class="dim">none</span>')}
    ${s.upgrade ? row('Rising to', `${esc(TIERS[s.upgrade.to].name.toLowerCase())} <span class="dim">(${Math.round(100 * s.upgrade.progress)} %)</span>`) : ''}
    ${c.unstaffedMonths > 0 ? `<div class="warnline">⚠ unserved ${c.unstaffedMonths} mo — ruin in ${monthsToRuin(s)}</div>` : c.staffing < 0.999 ? '<div class="warnline">⚠ short of hands</div>' : ''}`}
    <div class="pop-hint">click to open the ledger</div>
  `;
}

