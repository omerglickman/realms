// Command layer (ROADMAP B.3 rule 3). Every change to the game state is a
// plain-data command applied through `applyCommand`, which returns the inverse
// command so the UI can undo. The AI will issue the same commands as the player.
//
// Phase 0: map-editing commands only.

import type { GameState } from './state';
import type { MapData } from './map';
import { inBounds, idx, neighborsOffset, cloneMap } from './map';
import { axialRange, offsetToAxial, axialToOffset } from './hex';

export interface CellEdit {
  /** flat index = row * width + col */
  i: number;
  /** terrain index to set */
  t: number;
}

export interface SetTerrainCommand {
  type: 'setTerrain';
  cells: CellEdit[];
}

export interface SetResourceCommand {
  type: 'setResource';
  /** t = resource index, -1 = none */
  cells: CellEdit[];
}

export interface ReplaceMapCommand {
  type: 'replaceMap';
  map: MapData;
}

export type Command = SetTerrainCommand | SetResourceCommand | ReplaceMapCommand;

/** Apply a command, mutating the state, and return the inverse command. */
export function applyCommand(state: GameState, cmd: Command): Command {
  switch (cmd.type) {
    case 'setTerrain': {
      const map = state.map;
      const inverse: CellEdit[] = [];
      for (const c of cmd.cells) {
        if (c.i < 0 || c.i >= map.terrain.length) continue;
        const prev = map.terrain[c.i];
        if (prev === c.t) continue;
        inverse.push({ i: c.i, t: prev });
        map.terrain[c.i] = c.t;
      }
      return { type: 'setTerrain', cells: inverse };
    }
    case 'setResource': {
      const map = state.map;
      const inverse: CellEdit[] = [];
      for (const c of cmd.cells) {
        if (c.i < 0 || c.i >= map.resource.length) continue;
        const prev = map.resource[c.i];
        if (prev === c.t) continue;
        inverse.push({ i: c.i, t: prev });
        map.resource[c.i] = c.t;
      }
      return { type: 'setResource', cells: inverse };
    }
    case 'replaceMap': {
      const prev = state.map;
      state.map = cloneMap(cmd.map);
      return { type: 'replaceMap', map: prev };
    }
  }
}

/** Does this command change anything? (used to skip empty undo entries) */
export function isNoop(cmd: Command): boolean {
  return (cmd.type === 'setTerrain' || cmd.type === 'setResource') && cmd.cells.length === 0;
}

/** Cells touched by a command (for renderer invalidation); 'all' for whole-map commands. */
export function commandCells(cmd: Command): number[] | 'all' {
  return cmd.type === 'replaceMap' ? 'all' : cmd.cells.map((c) => c.i);
}

export function setResourceCommand(map: MapData, cells: Iterable<number>, resource: number): SetResourceCommand {
  const edits: CellEdit[] = [];
  for (const i of cells) if (map.resource[i] !== resource) edits.push({ i, t: resource });
  return { type: 'setResource', cells: edits };
}

/** Replace the whole resource layer (from a spawn) as one undoable command. */
export function resourceLayerCommand(map: MapData, layer: number[]): SetResourceCommand {
  const edits: CellEdit[] = [];
  for (let i = 0; i < layer.length; i++) if (map.resource[i] !== layer[i]) edits.push({ i, t: layer[i] });
  return { type: 'setResource', cells: edits };
}

// ---- helpers that build commands (pure; they don't touch the state) ----

/** Cells of a round brush of the given radius centred on (col, row), clipped to the map. */
export function brushCells(map: MapData, col: number, row: number, radius: number): number[] {
  const out: number[] = [];
  const centre = offsetToAxial(col, row);
  for (const h of axialRange(centre, radius)) {
    const o = axialToOffset(h.q, h.r);
    if (inBounds(map, o.col, o.row)) out.push(idx(map, o.col, o.row));
  }
  return out;
}

export function paintCommand(map: MapData, cells: Iterable<number>, terrain: number): SetTerrainCommand {
  const edits: CellEdit[] = [];
  for (const i of cells) if (map.terrain[i] !== terrain) edits.push({ i, t: terrain });
  return { type: 'setTerrain', cells: edits };
}

/** Flood fill: all hexes connected to (col,row) with the same terrain get `terrain`. */
export function floodFillCommand(map: MapData, col: number, row: number, terrain: number, limit = 200_000): SetTerrainCommand {
  if (!inBounds(map, col, row)) return { type: 'setTerrain', cells: [] };
  const start = idx(map, col, row);
  const from = map.terrain[start];
  if (from === terrain) return { type: 'setTerrain', cells: [] };
  const seen = new Uint8Array(map.terrain.length);
  const stack = [start];
  seen[start] = 1;
  const cells: CellEdit[] = [];
  while (stack.length && cells.length < limit) {
    const i = stack.pop()!;
    cells.push({ i, t: terrain });
    const c = i % map.width, r = Math.floor(i / map.width);
    for (const n of neighborsOffset(map, c, r)) {
      const j = idx(map, n.col, n.row);
      if (!seen[j] && map.terrain[j] === from) {
        seen[j] = 1;
        stack.push(j);
      }
    }
  }
  return { type: 'setTerrain', cells };
}
