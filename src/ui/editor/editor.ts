// Map editor: palette, brush / fill / pick tools, undo-redo, export/import,
// autosave. All edits go through the command layer (src/sim/commands.ts).
// This file owns the editor panel DOM (#editor) and the edit-mode flag; the
// app forwards pointer and key events to it while edit mode is on.

import type { GameState } from '../../sim/state';
import type { Command, SetTerrainCommand, SetResourceCommand } from '../../sim/commands';
import { applyCommand, brushCells, floodFillCommand, isNoop, paintCommand, commandCells, setResourceCommand, resourceLayerCommand } from '../../sim/commands';
import { TERRAIN } from '../../sim/terrain';
import { RESOURCES, NO_RESOURCE, computeResourceSpawn, countResources } from '../../sim/resources';
import { seedRng } from '../../sim/rng';
import { inBounds, idx } from '../../sim/map';
import { loadMapFile, saveMapFile } from '../../sim/mapfile';
import { TIERS, canSettleAt, settlementIdAt, zoneCells, workRangeCells, workedCellsBySettlement } from '../../sim/settlements';
import { saveScenarioFile, loadScenarioFile, detectFile } from '../../sim/scenario';

export type Tool = 'brush' | 'fill' | 'pick' | 'resource' | 'settle';

/** Default starting population per tier when placing in the editor (×3 model scale; DESIGN §3.3 typical sizes). */
const DEFAULT_POP: Record<string, number> = { village: 900, town: 9000, city: 24000, metropolis: 36000 };
export const BRUSH_RADII = [0, 1, 2, 4] as const; // sizes 1, 2, 3, 5

const AUTOSAVE_KEY = 'realms.editor.autosave';
const TERRAIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'S'];

interface UndoEntry {
  undo: Command;
  redo: Command;
}

export interface EditorHost {
  getState(): GameState;
  /** Called after any command so the renderer rebuilds the affected chunks (or everything). */
  onChanged(cellsChanged: number[] | 'all'): void;
  /** The map's display name (shown in the HUD, used for export filename). */
  getMapName(): string;
  setMapName(name: string): void;
  /** Replace the whole game state (after loading a scenario). */
  setState(state: GameState): void;
  /** A settlement was placed or clicked in the editor (null = deselect). */
  onSelect(id: string | null): void;
}

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element #${id}`);
  return e as T;
}

export class Editor {
  active = false;
  tool: Tool = 'brush';
  terrain = 1; // grassland
  resource = NO_RESOURCE; // selected resource for the resource tool (-1 = eraser)
  radiusIndex = 1; // size 2
  dirty = false;
  /** settle tool: tier index into TIERS */
  settleTier = 0;
  private settleCounter = 0;

  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];
  private stroke: Map<number, number> | null = null; // cell index -> original terrain (brush) or resource (resource tool)
  private autosaveTimer: number | undefined;

  constructor(private host: EditorHost) {
    this.buildPalette();
    this.buildResourcePalette();
    this.buildSettlePanel();
    this.wirePanel();
    this.refreshPanel();
    this.checkAutosave();
  }

  get brushRadius(): number {
    return BRUSH_RADII[this.radiusIndex];
  }

  // ---------- mode ----------

  setActive(on: boolean): void {
    this.active = on;
    el('editor').classList.toggle('hidden', !on);
    el<HTMLButtonElement>('edit-toggle').textContent = on ? 'Leave editor' : 'Edit map';
    document.body.classList.toggle('editing', on);
  }

  // ---------- pointer interaction (called by the app with map coordinates) ----------

  /** Cells the brush would touch at (col,row); for the hover preview. */
  previewCells(col: number, row: number): number[] {
    const map = this.host.getState().map;
    if (!inBounds(map, col, row)) return [];
    if (this.tool === 'brush') return brushCells(map, col, row, this.brushRadius);
    if (this.tool === 'settle') {
      // show the influence reach of the tier about to be placed
      const fake = { col, row, tier: this.settleTier } as Parameters<typeof zoneCells>[1];
      return zoneCells(map, fake, TIERS[this.settleTier].influenceRings);
    }
    return [idx(map, col, row)];
  }

  /** Found a settlement of the selected tier at (col,row) with the panel's name and population. */
  placeSettlement(col: number, row: number): void {
    const state = this.host.getState();
    const existing = settlementIdAt(state, col, row);
    if (existing) { this.host.onSelect(existing); return; }
    const check = canSettleAt(state, col, row);
    if (!check.ok) { el('editor-msg').textContent = `Cannot place here: ${check.reason}.`; return; }
    const tier = TIERS[this.settleTier];
    const popInput = el<HTMLInputElement>('settle-pop');
    const population = Math.max(1, Math.round(Number(popInput.value) || DEFAULT_POP[tier.id] || 900));
    const nameInput = el<HTMLInputElement>('settle-name');
    const name = nameInput.value.trim() || this.nextName();
    this.execute({ type: 'foundSettlement', settlement: { name, tier: this.settleTier, col, row, population } });
    const id = settlementIdAt(state, col, row)!;
    const placed = state.settlements[id];
    const wanted = workRangeCells(state.map, placed).length;
    const got = (workedCellsBySettlement(state).get(id) ?? []).length;
    const note = got < wanted ? ` ⚠ only ${got} of its ${wanted} hexes are free — the rest are worked by a higher tier (DESIGN §3.3).` : '';
    el('editor-msg').textContent = `Placed ${name} (${tier.name}, ${population.toLocaleString('en-US')} people).${note}`;
    nameInput.value = ''; // next one gets an automatic name unless typed
    this.host.onSelect(id);
  }

  private nextName(): string {
    const state = this.host.getState();
    const tier = TIERS[this.settleTier].name;
    const taken = new Set(Object.values(state.settlements).map((s) => s.name));
    let n = this.settleCounter;
    let name: string;
    do { n += 1; name = `${tier} ${n}`; } while (taken.has(name));
    this.settleCounter = n;
    return name;
  }

  removeSettlement(id: string): void {
    const state = this.host.getState();
    const s = state.settlements[id];
    if (!s) return;
    this.execute({ type: 'removeSettlement', id });
    el('editor-msg').textContent = `Removed ${s.name}.`;
    this.host.onSelect(null);
  }

  renameSettlement(id: string, name: string): void {
    this.execute({ type: 'renameSettlement', id, name });
  }

  private applyStrokeCommand(cmd: SetTerrainCommand | SetResourceCommand): void {
    const state = this.host.getState();
    const layer = cmd.type === 'setTerrain' ? state.map.terrain : state.map.resource;
    for (const c of cmd.cells) if (!this.stroke!.has(c.i)) this.stroke!.set(c.i, layer[c.i]);
    applyCommand(state, cmd);
    this.host.onChanged(cmd.cells.map((c) => c.i));
  }

  pointerDown(col: number, row: number): void {
    const state = this.host.getState();
    const map = state.map;
    if (!inBounds(map, col, row)) return;
    switch (this.tool) {
      case 'pick': {
        this.terrain = map.terrain[idx(map, col, row)];
        this.refreshPanel();
        return;
      }
      case 'fill': {
        const cmd = floodFillCommand(map, col, row, this.terrain);
        this.execute(cmd);
        return;
      }
      case 'brush':
      case 'resource': {
        this.stroke = new Map();
        this.paintAt(col, row);
        return;
      }
      case 'settle': {
        this.placeSettlement(col, row);
        return;
      }
    }
  }

  pointerMove(col: number, row: number): void {
    if (this.stroke && (this.tool === 'brush' || this.tool === 'resource')) this.paintAt(col, row);
  }

  pointerUp(): void {
    if (!this.stroke) return;
    const map = this.host.getState().map;
    if (this.stroke.size > 0) {
      const type = this.tool === 'resource' ? 'setResource' : 'setTerrain';
      const layer = this.tool === 'resource' ? map.resource : map.terrain;
      const undo: SetTerrainCommand | SetResourceCommand = { type, cells: [] };
      const redo: SetTerrainCommand | SetResourceCommand = { type, cells: [] };
      for (const [i, orig] of this.stroke) {
        undo.cells.push({ i, t: orig });
        redo.cells.push({ i, t: layer[i] });
      }
      this.pushUndo({ undo, redo });
      this.markDirty();
    }
    this.stroke = null;
  }

  private paintAt(col: number, row: number): void {
    const map = this.host.getState().map;
    if (!inBounds(map, col, row)) return;
    const cmd = this.tool === 'resource'
      ? setResourceCommand(map, [idx(map, col, row)], this.resource)
      : paintCommand(map, brushCells(map, col, row, this.brushRadius), this.terrain);
    if (isNoop(cmd)) return;
    this.applyStrokeCommand(cmd);
  }

  // ---------- resource spawning ----------

  spawnResources(mode: 'replace' | 'fill' | 'clear'): void {
    const map = this.host.getState().map;
    let layer: number[];
    if (mode === 'clear') {
      layer = new Array<number>(map.resource.length).fill(NO_RESOURCE);
    } else {
      const seed = el<HTMLInputElement>('res-seed').value.trim() || 'realms';
      const density = (Number(el<HTMLInputElement>('res-density').value) || 100) / 100;
      layer = computeResourceSpawn(map, seedRng(seed), { density, replace: mode === 'replace' });
    }
    this.execute(resourceLayerCommand(map, layer));
    el('editor-msg').textContent = mode === 'clear' ? 'Resources cleared.' : `Resources ${mode === 'fill' ? 'filled' : 'spawned'}.`;
  }

  /** Apply a command as one undo step. */
  execute(cmd: Command): void {
    if (isNoop(cmd)) return;
    const state = this.host.getState();
    const inverse = applyCommand(state, cmd);
    this.pushUndo({ undo: inverse, redo: cmd });
    this.host.onChanged(commandCells(cmd));
    this.markDirty();
  }

  private pushUndo(e: UndoEntry): void {
    this.undoStack.push(e);
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack = [];
    this.refreshPanel();
  }

  undo(): void {
    const e = this.undoStack.pop();
    if (!e) return;
    applyCommand(this.host.getState(), e.undo);
    this.redoStack.push(e);
    this.host.onChanged(commandCells(e.undo));
    this.markDirty();
    this.refreshPanel();
  }

  redo(): void {
    const e = this.redoStack.pop();
    if (!e) return;
    applyCommand(this.host.getState(), e.redo);
    this.undoStack.push(e);
    this.host.onChanged(commandCells(e.redo));
    this.markDirty();
    this.refreshPanel();
  }

  /** Forget history (after loading a different map). */
  resetHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.dirty = false;
    this.refreshPanel();
  }

  // ---------- keyboard ----------

  /** Returns true if the key was handled. */
  key(e: KeyboardEvent): boolean {
    if (!this.active) return false;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') {
      if (e.shiftKey) this.redo(); else this.undo();
      return true;
    }
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'y') { this.redo(); return true; }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const up = k.toUpperCase();
    if (up === 'B') { this.tool = 'brush'; this.refreshPanel(); return true; }
    if (up === 'F') { this.tool = 'fill'; this.refreshPanel(); return true; }
    if (up === 'I') { this.tool = 'pick'; this.refreshPanel(); return true; }
    if (up === 'X') { this.tool = 'resource'; this.resource = NO_RESOURCE; this.refreshPanel(); return true; }
    if (up === 'T') { this.tool = 'settle'; this.refreshPanel(); return true; }
    if (k === '[') { this.radiusIndex = Math.max(0, this.radiusIndex - 1); this.refreshPanel(); return true; }
    if (k === ']') { this.radiusIndex = Math.min(BRUSH_RADII.length - 1, this.radiusIndex + 1); this.refreshPanel(); return true; }
    const ti = TERRAIN_KEYS.indexOf(up);
    if (ti >= 0 && ti < TERRAIN.length) { this.terrain = ti; this.refreshPanel(); return true; }
    return false;
  }

  // ---------- export / import / autosave ----------

  exportMap(): void {
    const name = this.host.getMapName() || 'map';
    const file = saveMapFile(this.host.getState().map, name, { exportedAt: new Date().toISOString() });
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/[^\w.-]+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.dirty = false;
    this.refreshPanel();
  }

  /** Import either a map file (terrain + resources; settlements are kept) or a scenario file (whole state). */
  importMapFromText(text: string): 'map' | 'scenario' {
    const raw = JSON.parse(text);
    const kind = detectFile(raw);
    if (kind === 'scenario') {
      const { state, name } = loadScenarioFile(raw);
      this.host.setState(state);
      this.host.setMapName(name);
      this.resetHistory();
      return 'scenario';
    }
    const { map, name } = loadMapFile(raw);
    this.execute({ type: 'replaceMap', map });
    this.host.setMapName(name);
    this.resetHistory();
    return 'map';
  }

  /** Download the whole game state as a scenario file (the organic starting position — DESIGN §4.8). */
  exportScenario(): void {
    const name = this.host.getMapName() || 'scenario';
    const file = saveScenarioFile(this.host.getState(), name, { exportedAt: new Date().toISOString() });
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/[^\w.-]+/g, '_')}.scenario.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.dirty = false;
    this.refreshPanel();
  }

  /** Called by the app after turns ran: the state changed outside the command layer. */
  stateChangedExternally(): void {
    this.markDirty();
  }

  private markDirty(): void {
    this.dirty = true;
    this.refreshPanel();
    if (this.autosaveTimer !== undefined) window.clearTimeout(this.autosaveTimer);
    this.autosaveTimer = window.setTimeout(() => this.autosave(), 800);
  }

  private autosave(): void {
    try {
      const file = saveScenarioFile(this.host.getState(), this.host.getMapName(), { autosavedAt: new Date().toISOString() });
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(file));
      el('editor-autosave-status').textContent = `autosaved ${new Date().toLocaleTimeString()}`;
    } catch {
      el('editor-autosave-status').textContent = 'autosave unavailable in this browser';
    }
  }

  private checkAutosave(): void {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      const box = el('editor-restore');
      if (!raw) { box.classList.add('hidden'); return; }
      const parsed = JSON.parse(raw);
      const when = parsed?.meta?.autosavedAt ? new Date(parsed.meta.autosavedAt).toLocaleString() : 'unknown time';
      const what = detectFile(parsed) === 'scenario' ? `${parsed.meta?.settlements ?? 0} settlements, ${parsed.meta?.date ?? ''}` : 'map only';
      el('editor-restore-label').textContent = `Unsaved edits found (${parsed?.name ?? 'map'}, ${when}; ${what}).`;
      box.classList.remove('hidden');
      this.setActive(true); // the notice lives in the editor panel — make sure it can be seen
      el<HTMLButtonElement>('editor-restore-yes').onclick = () => {
        this.importMapFromText(raw);
        box.classList.add('hidden');
        this.setActive(true);
      };
      el<HTMLButtonElement>('editor-restore-no').onclick = () => {
        localStorage.removeItem(AUTOSAVE_KEY);
        box.classList.add('hidden');
      };
    } catch {
      /* ignore */
    }
  }

  clearAutosave(): void {
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
  }

  // ---------- panel DOM ----------

  private buildPalette(): void {
    const pal = el('palette');
    pal.innerHTML = '';
    TERRAIN.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.dataset.index = String(i);
      b.innerHTML = `<span class="chip" style="background:${t.color}"></span>${t.name}<kbd>${TERRAIN_KEYS[i] ?? ''}</kbd>`;
      b.addEventListener('click', () => { this.terrain = i; this.refreshPanel(); });
      pal.appendChild(b);
    });
  }

  private buildResourcePalette(): void {
    const pal = el('res-palette');
    pal.innerHTML = '';
    const mk = (label: string, index: number, color: string | null) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.dataset.index = String(index);
      b.innerHTML = `<span class="chip${color ? '' : ' none'}" style="${color ? `background:${color}` : ''}"></span>${label}`;
      b.addEventListener('click', () => { this.tool = 'resource'; this.resource = index; this.refreshPanel(); });
      pal.appendChild(b);
    };
    mk('Erase (X)', NO_RESOURCE, null);
    RESOURCES.forEach((r, i) => mk(r.name, i, r.color));
  }

  private buildSettlePanel(): void {
    const sel = el<HTMLSelectElement>('settle-tier');
    sel.innerHTML = '';
    TIERS.forEach((t, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = t.name;
      sel.appendChild(o);
    });
    sel.value = String(this.settleTier);
    const pop = el<HTMLInputElement>('settle-pop');
    pop.value = String(DEFAULT_POP[TIERS[this.settleTier].id] ?? 900);
    sel.addEventListener('change', () => {
      this.settleTier = Number(sel.value) || 0;
      pop.value = String(DEFAULT_POP[TIERS[this.settleTier].id] ?? 900);
      this.tool = 'settle';
      this.refreshPanel();
    });
    el('tool-settle').addEventListener('click', () => { this.tool = 'settle'; this.refreshPanel(); });
    pop.addEventListener('focus', () => { this.tool = 'settle'; this.refreshPanel(); });
    el('settle-name').addEventListener('focus', () => { this.tool = 'settle'; this.refreshPanel(); });
    el('editor-export-scenario').addEventListener('click', () => this.exportScenario());
  }

  private wirePanel(): void {
    el('res-spawn').addEventListener('click', () => this.spawnResources('replace'));
    el('res-fill').addEventListener('click', () => this.spawnResources('fill'));
    el('res-clear').addEventListener('click', () => this.spawnResources('clear'));
    const dens = el<HTMLInputElement>('res-density');
    const syncDens = () => { el('res-density-val').textContent = `${dens.value}%`; };
    dens.addEventListener('input', syncDens);
    syncDens();
    el('edit-toggle').addEventListener('click', () => this.setActive(!this.active));
    el('tool-brush').addEventListener('click', () => { this.tool = 'brush'; this.refreshPanel(); });
    el('tool-fill').addEventListener('click', () => { this.tool = 'fill'; this.refreshPanel(); });
    el('tool-pick').addEventListener('click', () => { this.tool = 'pick'; this.refreshPanel(); });
    document.querySelectorAll<HTMLButtonElement>('#brush-sizes button').forEach((b, i) => {
      b.addEventListener('click', () => { this.radiusIndex = i; this.refreshPanel(); });
    });
    el('editor-undo').addEventListener('click', () => this.undo());
    el('editor-redo').addEventListener('click', () => this.redo());
    el('editor-export').addEventListener('click', () => this.exportMap());
    const fileInput = el<HTMLInputElement>('editor-import-file');
    el('editor-import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      try {
        const kind = this.importMapFromText(await f.text());
        el('editor-msg').textContent = `Loaded ${kind} "${this.host.getMapName()}".`;
      } catch (err) {
        el('editor-msg').textContent = `Could not load: ${err instanceof Error ? err.message : String(err)}`;
      }
      fileInput.value = '';
    });
    const nameInput = el<HTMLInputElement>('map-name');
    nameInput.addEventListener('change', () => this.host.setMapName(nameInput.value.trim() || 'map'));
  }

  refreshPanel(): void {
    document.querySelectorAll<HTMLButtonElement>('#palette .swatch').forEach((b) => {
      b.classList.toggle('selected', Number(b.dataset.index) === this.terrain);
    });
    document.querySelectorAll<HTMLButtonElement>('#res-palette .swatch').forEach((b) => {
      b.classList.toggle('selected', this.tool === 'resource' && Number(b.dataset.index) === this.resource);
    });
    const rc = countResources(this.host.getState().map);
    const total = rc.reduce((a, b) => a + b, 0);
    el('res-count').textContent = total ? `${total} resources on the map` : 'no resources on the map';
    el('tool-brush').classList.toggle('selected', this.tool === 'brush');
    el('tool-fill').classList.toggle('selected', this.tool === 'fill');
    el('tool-pick').classList.toggle('selected', this.tool === 'pick');
    el('tool-settle').classList.toggle('selected', this.tool === 'settle');
    const sel = el<HTMLSelectElement>('settle-tier');
    if (sel.value !== String(this.settleTier)) sel.value = String(this.settleTier);
    const n = Object.keys(this.host.getState().settlements).length;
    el('settle-count').textContent = n ? `${n} settlement${n === 1 ? '' : 's'} on the map` : 'no settlements yet';
    document.querySelectorAll<HTMLButtonElement>('#brush-sizes button').forEach((b, i) => {
      b.classList.toggle('selected', i === this.radiusIndex);
    });
    el<HTMLButtonElement>('editor-undo').disabled = this.undoStack.length === 0;
    el<HTMLButtonElement>('editor-redo').disabled = this.redoStack.length === 0;
    el('editor-dirty').textContent = this.dirty ? '● unsaved edits' : '';
    const nameInput = el<HTMLInputElement>('map-name');
    if (document.activeElement !== nameInput) nameInput.value = this.host.getMapName();
  }
}
