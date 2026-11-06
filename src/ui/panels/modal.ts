// The modal shell (Session 13): one host element, a dim backdrop, a header
// with a colour stripe, tabs and a scrolling body. Each ledger (settlement,
// cluster, realm, settings…) builds a ModalSpec; the shell renders it and
// hands back the body for wiring. Re-rendering keeps the scroll position.

import { esc } from './format';
import { hideTooltip } from './tooltip';

export interface ModalTab { id: string; label: string }

export interface ModalSpec {
  /** header title (HTML) */
  title: string;
  /** line under the title (HTML) */
  sub?: string;
  /** small uppercase badge after the title */
  badge?: string;
  /** colour of the stripe left of the title */
  stripe?: string;
  /** right-hand header text, e.g. the date */
  right?: string;
  tabs?: ModalTab[];
  tab?: string;
  /** body HTML */
  body: string;
  /** footer HTML */
  foot?: string;
  wide?: boolean;
}

export interface ModalHost {
  onTab(id: string): void;
  onClose(): void;
}

export class ModalShell {
  private lastKey = '';
  constructor(private root: HTMLElement, private backdrop: HTMLElement) {
    backdrop.addEventListener('click', () => this.host?.onClose());
  }
  private host: ModalHost | null = null;

  get open(): boolean { return !this.root.classList.contains('hidden'); }

  /** Render `spec`; `key` identifies the page so the scroll position survives a refresh of the same page. */
  show(key: string, spec: ModalSpec, host: ModalHost): HTMLElement {
    this.host = host;
    const prevBody = this.root.querySelector<HTMLElement>('.m-body');
    const scroll = key === this.lastKey && prevBody ? prevBody.scrollTop : 0;
    this.lastKey = key;
    hideTooltip();
    this.root.classList.toggle('wide', !!spec.wide);
    this.root.innerHTML = `
      <div class="m-head">
        <div class="m-stripe" style="background:${esc(spec.stripe ?? '#4a2f1a')}"></div>
        <div>
          <div class="m-title">${spec.title}${spec.badge ? `<span class="m-badge">${esc(spec.badge)}</span>` : ''}</div>
          ${spec.sub ? `<div class="m-sub">${spec.sub}</div>` : ''}
        </div>
        <div class="m-right">${spec.right ? `<span class="m-date">${spec.right}</span>` : ''}<button class="m-close" title="Close (Esc)">×</button></div>
      </div>
      ${spec.tabs && spec.tabs.length > 1 ? `<div class="m-tabs">${spec.tabs.map((t) => `<button data-tab="${t.id}" class="${t.id === spec.tab ? 'on' : ''}">${esc(t.label)}</button>`).join('')}</div>` : ''}
      <div class="m-body">${spec.body}</div>
      ${spec.foot ? `<div class="m-foot">${spec.foot}</div>` : ''}
    `;
    this.root.classList.remove('hidden');
    this.backdrop.classList.remove('hidden');
    this.root.querySelector<HTMLButtonElement>('.m-close')!.addEventListener('click', () => host.onClose());
    this.root.querySelectorAll<HTMLButtonElement>('.m-tabs button').forEach((b) => b.addEventListener('click', () => host.onTab(b.dataset.tab!)));
    const body = this.root.querySelector<HTMLElement>('.m-body')!;
    if (scroll) body.scrollTop = scroll;
    return this.root;
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.backdrop.classList.add('hidden');
    this.root.innerHTML = '';
    this.lastKey = '';
    this.host = null;
  }
}

/** Wire the `a[data-focus]`, `a[data-cluster]`, `[data-open]` links a ledger body contains. */
export function wireLinks(root: HTMLElement, h: { onFocus?(id: string): void; onCluster?(root: string): void; onOpen?(kind: string, id: string, tab?: string): void }): void {
  root.querySelectorAll<HTMLElement>('[data-focus]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); h.onFocus?.(a.dataset.focus!); }));
  root.querySelectorAll<HTMLElement>('[data-cluster]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); h.onCluster?.(a.dataset.cluster!); }));
  root.querySelectorAll<HTMLElement>('[data-open]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); h.onOpen?.(a.dataset.open!, a.dataset.id ?? '', a.dataset.tab); }));
}
