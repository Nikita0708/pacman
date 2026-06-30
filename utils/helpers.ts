/**
 * Coordinate helpers that bridge the discrete tile grid and continuous pixel
 * space. Centralised here so movement, rendering and AI all agree on exactly
 * how a tile maps to a pixel (DRY).
 */
import {
  LEVEL_SPEED_STEP,
  MAX_LEVEL_SPEED_MULTIPLIER,
  MAZE_COLUMNS,
  TILE_SIZE,
} from '@/engine/constants';
import type { GridPosition, Vector2 } from '@/engine/types';

/** Total maze width in pixels. */
export const MAZE_PIXEL_WIDTH = MAZE_COLUMNS * TILE_SIZE;

/** Pixel x of the centre of a column. */
export const columnToX = (col: number): number =>
  col * TILE_SIZE + TILE_SIZE * 0.5;

/** Pixel y of the centre of a row. */
export const rowToY = (row: number): number =>
  row * TILE_SIZE + TILE_SIZE * 0.5;

/** Centre pixel of a grid cell. */
export const tileToPixel = (position: GridPosition): Vector2 => ({
  x: columnToX(position.col),
  y: rowToY(position.row),
});

/** Column containing pixel x. */
export const xToColumn = (x: number): number => Math.floor(x / TILE_SIZE);

/** Row containing pixel y. */
export const yToRow = (y: number): number => Math.floor(y / TILE_SIZE);

/** Grid cell containing a pixel point. */
export const pixelToTile = (x: number, y: number): GridPosition => ({
  col: xToColumn(x),
  row: yToRow(y),
});

/** Wraps a pixel x around the horizontal tunnel boundaries. */
export const wrapX = (x: number): number => {
  if (x < 0) {
    return x + MAZE_PIXEL_WIDTH;
  }
  if (x >= MAZE_PIXEL_WIDTH) {
    return x - MAZE_PIXEL_WIDTH;
  }
  return x;
};

/** Speed scaling for a level, capped so high levels stay controllable. */
export const levelSpeedMultiplier = (level: number): number =>
  Math.min(1 + (level - 1) * LEVEL_SPEED_STEP, MAX_LEVEL_SPEED_MULTIPLIER);
