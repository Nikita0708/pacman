/**
 * Pure numeric helpers with no game knowledge. Kept dependency-free so they
 * are trivially testable and reusable.
 */

/** Constrains `value` to the inclusive `[min, max]` range. */
export const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

/** Linear interpolation between `start` and `end` by factor `t` (0..1). */
export const lerp = (start: number, end: number, t: number): number =>
  start + (end - start) * t;

/** Squared Euclidean distance — avoids a sqrt when only comparing magnitudes. */
export const distanceSquared = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

/** Euclidean distance between two points. */
export const distance = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number => Math.sqrt(distanceSquared(ax, ay, bx, by));

/** Manhattan (grid) distance between two points. */
export const manhattanDistance = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number => Math.abs(ax - bx) + Math.abs(ay - by);
