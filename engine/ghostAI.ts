/**
 * Ghost behaviour: targeting, the scatter/chase schedule, frightened mode and
 * the house lifecycle (waiting, leaving, returning when eaten).
 *
 * Movement reuses the shared `moveEntity` stepper; the AI's only job is to pick
 * a direction at each tile. A ghost decides exactly once per tile entered
 * (tracked by `decisionTile`), choosing — among the open neighbours, never
 * reversing — the one that minimises distance to its target tile. Different
 * personalities are just different targets, so swapping in classic behaviour
 * (e.g. Inky's flank) is a one-function change.
 *
 * Per the spec's simplified scheme:
 *   Blinky (red)    → chases Pac-Man's tile.
 *   Pinky  (pink)   → aims a few tiles ahead of Pac-Man.
 *   Inky   (cyan)   → wanders randomly.
 *   Clyde  (orange) → chases only when far, else retreats to his corner.
 */
import {
  CHASE_DURATION_MS,
  CLYDE_CHASE_RADIUS_TILES,
  DIRECTION_VECTORS,
  EATEN_SPEED,
  FRIGHTENED_SPEED,
  GHOST_GATE_COLUMN,
  GHOST_HOUSE_BOB_RANGE,
  GHOST_HOUSE_CENTER,
  GHOST_HOUSE_EXIT,
  GHOST_HOUSE_SPEED,
  GHOST_SPEED,
  HOUSE_REENTER_DELAY_MS,
  MILLISECONDS_PER_SECOND,
  OPPOSITE_DIRECTION,
  PINKY_LOOKAHEAD_TILES,
  SCATTER_DURATION_MS,
  TILE_SIZE,
} from './constants';
import { canEatenGhostEnter, canGhostEnter } from './collision';
import { moveEntity } from './movement';
import { Direction, GhostMode, GhostType } from './types';
import type { GameWorld, Ghost, GridPosition, TileType } from './types';
import {
  columnToX,
  levelSpeedMultiplier,
  pixelToTile,
  rowToY,
} from '@/utils/helpers';
import { distanceSquared } from '@/utils/math';

type TileGrid = TileType[][];
type EnterPredicate = (grid: TileGrid, col: number, row: number) => boolean;

/** Classic tie-break order when several directions are equally good. */
const DIRECTION_PRIORITY: readonly Direction[] = [
  Direction.UP,
  Direction.LEFT,
  Direction.DOWN,
  Direction.RIGHT,
];

const CENTER_EPSILON = 2;

const encodeTile = (tile: GridPosition): number => tile.col * 1000 + tile.row;

const isAtTileCenter = (ghost: Ghost): boolean => {
  const tile = pixelToTile(ghost.x, ghost.y);
  return (
    Math.abs(ghost.x - columnToX(tile.col)) <= CENTER_EPSILON &&
    Math.abs(ghost.y - rowToY(tile.row)) <= CENTER_EPSILON
  );
};

/** Open directions from a tile, excluding a reversal unless it's a dead end. */
const validDirections = (
  grid: TileGrid,
  tile: GridPosition,
  current: Direction,
  canEnter: EnterPredicate,
): Direction[] => {
  const back = OPPOSITE_DIRECTION[current];
  const options: Direction[] = [];
  for (const direction of DIRECTION_PRIORITY) {
    if (direction === back) {
      continue;
    }
    const vector = DIRECTION_VECTORS[direction];
    if (canEnter(grid, tile.col + vector.x, tile.row + vector.y)) {
      options.push(direction);
    }
  }
  if (options.length === 0 && back !== Direction.NONE) {
    const vector = DIRECTION_VECTORS[back];
    if (canEnter(grid, tile.col + vector.x, tile.row + vector.y)) {
      options.push(back);
    }
  }
  return options;
};

/** Picks the option that gets closest to the target tile (greedy, like the arcade). */
const chooseToward = (
  tile: GridPosition,
  options: Direction[],
  target: GridPosition,
): Direction => {
  let best = options[0] ?? Direction.NONE;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const direction of options) {
    const vector = DIRECTION_VECTORS[direction];
    const distance = distanceSquared(
      tile.col + vector.x,
      tile.row + vector.y,
      target.col,
      target.row,
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = direction;
    }
  }
  return best;
};

const chooseRandom = (options: Direction[]): Direction => {
  const index = Math.floor(Math.random() * options.length);
  return options[index] ?? options[0] ?? Direction.NONE;
};

/** Shared stepper: decide once per tile, then advance with the wall-aware mover. */
const navigate = (
  ghost: Ghost,
  grid: TileGrid,
  deltaSeconds: number,
  canEnter: EnterPredicate,
  pick: (tile: GridPosition, options: Direction[]) => Direction,
): void => {
  const tile = pixelToTile(ghost.x, ghost.y);
  const encoded = encodeTile(tile);
  if (ghost.decisionTile !== encoded) {
    ghost.decisionTile = encoded;
    const options = validDirections(grid, tile, ghost.direction, canEnter);
    if (options.length > 0) {
      ghost.nextDirection = pick(tile, options);
    }
  }
  moveEntity(ghost, deltaSeconds, {
    canEnter: (col, row) => canEnter(grid, col, row),
  });
};

/** Resolves the chase target for a ghost; `null` means "wander randomly". */
const chaseTarget = (ghost: Ghost, world: GameWorld): GridPosition | null => {
  const pacTile = pixelToTile(world.pacman.x, world.pacman.y);
  switch (ghost.id) {
    case GhostType.BLINKY:
      return pacTile;
    case GhostType.PINKY: {
      const vector = DIRECTION_VECTORS[world.pacman.direction];
      return {
        col: pacTile.col + vector.x * PINKY_LOOKAHEAD_TILES,
        row: pacTile.row + vector.y * PINKY_LOOKAHEAD_TILES,
      };
    }
    case GhostType.INKY:
      // Spec: the cyan ghost moves randomly. (Swap to a flank target here for
      // the classic Inky behaviour.)
      return null;
    case GhostType.CLYDE: {
      const ghostTile = pixelToTile(ghost.x, ghost.y);
      const tilesAway = Math.hypot(
        ghostTile.col - pacTile.col,
        ghostTile.row - pacTile.row,
      );
      return tilesAway > CLYDE_CHASE_RADIUS_TILES ? pacTile : ghost.scatterTarget;
    }
    default:
      return null;
  }
};

const reverse = (ghost: Ghost): void => {
  ghost.direction = OPPOSITE_DIRECTION[ghost.direction];
  ghost.nextDirection = Direction.NONE;
  ghost.decisionTile = -1;
};

/** Moves one coordinate toward a target, returning whether it arrived. */
const approach = (
  current: number,
  target: number,
  step: number,
): { value: number; arrived: boolean } => {
  const difference = target - current;
  if (Math.abs(difference) <= step) {
    return { value: target, arrived: true };
  }
  return { value: current + Math.sign(difference) * step, arrived: false };
};

/** Idle vertical bob while a ghost waits inside the house. */
const bobInHouse = (ghost: Ghost, deltaSeconds: number): void => {
  ghost.speed = GHOST_HOUSE_SPEED;
  const anchorY = rowToY(GHOST_HOUSE_CENTER.row);
  const step = ghost.speed * deltaSeconds;
  if (ghost.direction !== Direction.UP && ghost.direction !== Direction.DOWN) {
    ghost.direction = Direction.UP;
  }
  ghost.y += (ghost.direction === Direction.UP ? -1 : 1) * step;
  if (ghost.y < anchorY - GHOST_HOUSE_BOB_RANGE) {
    ghost.y = anchorY - GHOST_HOUSE_BOB_RANGE;
    ghost.direction = Direction.DOWN;
  } else if (ghost.y > anchorY + GHOST_HOUSE_BOB_RANGE) {
    ghost.y = anchorY + GHOST_HOUSE_BOB_RANGE;
    ghost.direction = Direction.UP;
  }
};

/** Steers a waiting ghost up through the gate and out into the maze. */
const leaveHouse = (ghost: Ghost, world: GameWorld, deltaSeconds: number): void => {
  ghost.speed = GHOST_HOUSE_SPEED;
  const step = ghost.speed * deltaSeconds;
  const gateX = columnToX(GHOST_GATE_COLUMN);
  const exitY = rowToY(GHOST_HOUSE_EXIT.row);

  if (Math.abs(ghost.x - gateX) > CENTER_EPSILON) {
    ghost.x = approach(ghost.x, gateX, step).value;
    return;
  }
  ghost.x = gateX;
  const climb = approach(ghost.y, exitY, step);
  ghost.y = climb.value;
  if (climb.arrived) {
    ghost.mode = world.globalMode;
    ghost.direction = Direction.LEFT;
    ghost.nextDirection = Direction.NONE;
    ghost.decisionTile = -1;
  }
};

/** Steers an eaten ghost (now eyes) down through the gate back into the house. */
const enterHouse = (ghost: Ghost, deltaSeconds: number): void => {
  ghost.speed = EATEN_SPEED;
  const step = ghost.speed * deltaSeconds;
  const centerX = columnToX(GHOST_HOUSE_CENTER.col);
  const homeY = rowToY(GHOST_HOUSE_CENTER.row);

  if (Math.abs(ghost.x - centerX) > CENTER_EPSILON) {
    ghost.x = approach(ghost.x, centerX, step).value;
    return;
  }
  ghost.x = centerX;
  const descend = approach(ghost.y, homeY, step);
  ghost.y = descend.value;
  if (descend.arrived) {
    ghost.mode = GhostMode.IN_HOUSE;
    ghost.releaseTimer = HOUSE_REENTER_DELAY_MS;
    ghost.direction = Direction.UP;
  }
};

/** Advances a single ghost by one frame according to its current mode. */
export const updateGhost = (
  ghost: Ghost,
  world: GameWorld,
  deltaSeconds: number,
): void => {
  const normalSpeed = GHOST_SPEED * levelSpeedMultiplier(world.level);

  switch (ghost.mode) {
    case GhostMode.IN_HOUSE: {
      bobInHouse(ghost, deltaSeconds);
      ghost.releaseTimer -= deltaSeconds * MILLISECONDS_PER_SECOND;
      if (ghost.releaseTimer <= 0) {
        ghost.mode = GhostMode.LEAVING_HOUSE;
      }
      return;
    }
    case GhostMode.LEAVING_HOUSE:
      leaveHouse(ghost, world, deltaSeconds);
      return;
    case GhostMode.ENTERING_HOUSE:
      enterHouse(ghost, deltaSeconds);
      return;
    case GhostMode.EATEN: {
      const tile = pixelToTile(ghost.x, ghost.y);
      if (
        tile.col === GHOST_HOUSE_EXIT.col &&
        tile.row === GHOST_HOUSE_EXIT.row &&
        isAtTileCenter(ghost)
      ) {
        ghost.mode = GhostMode.ENTERING_HOUSE;
        return;
      }
      ghost.speed = EATEN_SPEED;
      navigate(ghost, world.grid, deltaSeconds, canEatenGhostEnter, (tile2, options) =>
        chooseToward(tile2, options, GHOST_HOUSE_EXIT),
      );
      return;
    }
    case GhostMode.FRIGHTENED:
      ghost.speed = FRIGHTENED_SPEED;
      navigate(ghost, world.grid, deltaSeconds, canGhostEnter, (_, options) =>
        chooseRandom(options),
      );
      return;
    case GhostMode.SCATTER:
      ghost.speed = normalSpeed;
      navigate(ghost, world.grid, deltaSeconds, canGhostEnter, (tile, options) =>
        chooseToward(tile, options, ghost.scatterTarget),
      );
      return;
    case GhostMode.CHASE: {
      ghost.speed = normalSpeed;
      const target = chaseTarget(ghost, world);
      navigate(ghost, world.grid, deltaSeconds, canGhostEnter, (tile, options) =>
        target === null
          ? chooseRandom(options)
          : chooseToward(tile, options, target),
      );
      return;
    }
    default:
      return;
  }
};

/** Advances the scatter/chase schedule, reversing active ghosts on a switch. */
export const updateGhostSchedule = (
  world: GameWorld,
  deltaSeconds: number,
): void => {
  // The schedule pauses while ghosts are frightened, matching the arcade.
  if (world.powerTimer > 0) {
    return;
  }
  world.modeTimer -= deltaSeconds * MILLISECONDS_PER_SECOND;
  if (world.modeTimer > 0) {
    return;
  }
  world.globalMode =
    world.globalMode === GhostMode.SCATTER ? GhostMode.CHASE : GhostMode.SCATTER;
  world.modeTimer =
    world.globalMode === GhostMode.SCATTER
      ? SCATTER_DURATION_MS
      : CHASE_DURATION_MS;
  for (const ghost of world.ghosts) {
    if (ghost.mode === GhostMode.SCATTER || ghost.mode === GhostMode.CHASE) {
      ghost.mode = world.globalMode;
      reverse(ghost);
    }
  }
};

/** Puts every active ghost into frightened mode and flips it around. */
export const enterFrightened = (world: GameWorld): void => {
  for (const ghost of world.ghosts) {
    if (ghost.mode === GhostMode.SCATTER || ghost.mode === GhostMode.CHASE) {
      ghost.mode = GhostMode.FRIGHTENED;
      reverse(ghost);
    }
  }
};

/** Restores frightened ghosts to the current global mode when the power ends. */
export const endFrightened = (world: GameWorld): void => {
  for (const ghost of world.ghosts) {
    if (ghost.mode === GhostMode.FRIGHTENED) {
      ghost.mode = world.globalMode;
      ghost.decisionTile = -1;
    }
  }
};

/** Whether a ghost is currently out in the maze and able to touch Pac-Man. */
export const isGhostHostile = (ghost: Ghost): boolean =>
  ghost.mode === GhostMode.SCATTER ||
  ghost.mode === GhostMode.CHASE ||
  ghost.mode === GhostMode.FRIGHTENED;

/** Pixel radius within which Pac-Man and a ghost are considered to collide. */
export const GHOST_COLLISION_DISTANCE = TILE_SIZE * 0.5;
