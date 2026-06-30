/**
 * Collision and tile-query module.
 *
 * The single place that answers "what is at this cell?" and "may this actor
 * enter that cell?". Keeping every collision rule here (walls now; pellets and
 * ghosts in later steps) honours the spec's requirement for a dedicated
 * collision module and keeps movement/AI agnostic of tile semantics.
 */
import { TileType } from './types';
import type { GridPosition } from './types';

type ReadonlyGrid = readonly (readonly TileType[])[];

/**
 * Returns the tile at a cell. Out-of-bounds rows are walls; out-of-bounds
 * columns are treated as empty so actors can slide off a tunnel mouth before
 * being wrapped to the opposite side.
 */
export const tileAt = (
  grid: ReadonlyGrid,
  col: number,
  row: number,
): TileType => {
  if (row < 0 || row >= grid.length) {
    return TileType.WALL;
  }
  const line = grid[row];
  if (line === undefined) {
    return TileType.WALL;
  }
  if (col < 0 || col >= line.length) {
    return TileType.EMPTY;
  }
  return line[col] ?? TileType.WALL;
};

/** Whether a cell is a solid maze wall. */
export const isWall = (grid: ReadonlyGrid, col: number, row: number): boolean =>
  tileAt(grid, col, row) === TileType.WALL;

/** Whether Pac-Man may occupy a cell (walls and the ghost gate block him). */
export const canPacmanEnter = (
  grid: ReadonlyGrid,
  col: number,
  row: number,
): boolean => {
  const tile = tileAt(grid, col, row);
  return tile !== TileType.WALL && tile !== TileType.GHOST_HOUSE;
};

/** Whether an active ghost may enter a cell (walls and the house gate block). */
export const canGhostEnter = (
  grid: ReadonlyGrid,
  col: number,
  row: number,
): boolean => {
  const tile = tileAt(grid, col, row);
  return tile !== TileType.WALL && tile !== TileType.GHOST_HOUSE;
};

/** Whether an eaten ghost (returning as eyes) may enter a cell — gate allowed. */
export const canEatenGhostEnter = (
  grid: ReadonlyGrid,
  col: number,
  row: number,
): boolean => tileAt(grid, col, row) !== TileType.WALL;

/** Whether a cell currently holds a normal pellet. */
export const isPellet = (
  grid: ReadonlyGrid,
  position: GridPosition,
): boolean => tileAt(grid, position.col, position.row) === TileType.PELLET;

/** Whether a cell currently holds a power pellet. */
export const isPowerPellet = (
  grid: ReadonlyGrid,
  position: GridPosition,
): boolean =>
  tileAt(grid, position.col, position.row) === TileType.POWER_PELLET;

/**
 * Eats whatever collectible sits at a cell, clearing it from the (mutable)
 * grid, and returns the tile that was there. Non-collectible tiles are left
 * untouched. The caller decides scoring — this module only owns the grid.
 */
export const consumeAt = (
  grid: TileType[][],
  col: number,
  row: number,
): TileType => {
  if (row < 0 || row >= grid.length) {
    return TileType.WALL;
  }
  const line = grid[row];
  if (line === undefined || col < 0 || col >= line.length) {
    return TileType.EMPTY;
  }
  const tile = line[col] ?? TileType.EMPTY;
  if (tile === TileType.PELLET || tile === TileType.POWER_PELLET) {
    line[col] = TileType.EMPTY;
  }
  return tile;
};
