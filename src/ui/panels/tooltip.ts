// One shared tooltip element (Session 13b). Any element with a direct child
// `.tip` (hidden by CSS) shows that child's HTML in #tooltip while hovered —
// positioned below the element, or above when there is no room, and clamped
// to the window. Used by the ledger-strip tiles and the building cubes; being
// outside the strip it is never clipped by an overflow.

let host: HTMLElement | null = null;
let current: HTMLElement | null = null;

function place(target: HTMLElement): void {
  if (!host) return;
  const r = target.getBoundingClientRect();
  const w = host.offsetWidth, h = host.offsetHeight;
  let left = r.left;
  if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;
  left = Math.max(8, left);
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 8) top = r.top - 6 - h;
  host.style.left = `${left}px`;
  host.style.top = `${Math.max(4, top)}px`;
}

export function installTooltips(root: HTMLElement): void {
  host = root;
  document.addEventListener('mouseover', (e) => {
    const t = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]');
    if (!t || (t === current && t.isConnected)) return;
    const tip = t.querySelector<HTMLElement>(':scope > .tip');
    if (!tip) return;
    current = t;
    host!.innerHTML = tip.innerHTML;
    host!.classList.remove('hidden');
    place(t);
  });
  document.addEventListener('mouseout', (e) => {
    if (!current) return;
    const to = e.relatedTarget as Node | null;
    if (current.isConnected && to && current.contains(to)) return;
    hideTooltip();
  });
  document.addEventListener('mousedown', () => hideTooltip());
}

export function hideTooltip(): void {
  current = null;
  host?.classList.add('hidden');
}
