/**
 * Grid-locked, frame-rate-independent movement.
 *
 * Entities glide smoothly in pixel space but are constrained to lane centres:
 * they may only turn at tile centres and stop flush against walls. The module
 * is deliberately generic — it knows nothing about Pac-Man vs ghosts. Callers
 * inject a `canEnter` predicate, so the same code drives every actor (DIP).
 *
 * All displacement is `speed * deltaSeconds`, so behaviour is identical at 60,
 * 120, 144 or 240 FPS.
 */
import {
  DIRECTION_VECTORS,
  OPPOSITE_DIRECTION,
  PACMAN_MOUTH_MAX_ANGLE,
  PACMAN_MOUTH_SPEED,
  TILE_SIZE,
} from './constants';
import { Direction } from './types';
import type { Entity, Pacman } from './types';
import { columnToX, pixelToTile, rowToY, wrapX } from '@/utils/helpers';

/** How close (in pixels) to a tile centre an entity must be to turn. */
const TURN_TOLERANCE = TILE_SIZE * 0.25;

export interface MoveContext {
  /** Returns whether the entity is allowed to enter the given cell. */
  canEnter: (col: number, row: number) => boolean;
}

/**
 * Applies a buffered turn from the input queue when it becomes legal. A 180°
 * reversal is allowed mid-lane; perpendicular turns require being at a tile
 * centre with an open cell ahead. This is what lets a player pre-press a turn
 * and have Pac-Man take it at the first opportunity.
 */
const applyQueuedTurn = (entity: Entity, context: MoveContext): void => {
  const queued = entity.nextDirection;
  if (queued === Direction.NONE || queued === entity.direction) {
    return;
  }

  if (
    entity.direction !== Direction.NONE &&
    queued === OPPOSITE_DIRECTION[entity.direction]
  ) {
    entity.direction = queued;
    entity.nextDirection = Direction.NONE;
    return;
  }

  const tile = pixelToTile(entity.x, entity.y);
  const centerX = columnToX(tile.col);
  const centerY = rowToY(tile.row);
  const atCenter =
    Math.abs(entity.x - centerX) <= TURN_TOLERANCE &&
    Math.abs(entity.y - centerY) <= TURN_TOLERANCE;
  if (!atCenter) {
    return;
  }

  const vector = DIRECTION_VECTORS[queued];
  if (context.canEnter(tile.col + vector.x, tile.row + vector.y)) {
    entity.x = centerX;
    entity.y = centerY;
    entity.direction = queued;
    entity.nextDirection = Direction.NONE;
  }
};

/**
 * Advances an entity by one frame. Returns whether it actually moved (used to
 * drive animations such as Pac-Man's mouth). The per-frame step is always
 * smaller than half a tile, so an entity can never tunnel through a wall.
 */
export const moveEntity = (
  entity: Entity,
  deltaSeconds: number,
  context: MoveContext,
): boolean => {
  applyQueuedTurn(entity, context);

  if (entity.direction === Direction.NONE) {
    return false;
  }

  const vector = DIRECTION_VECTORS[entity.direction];
  const tile = pixelToTile(entity.x, entity.y);
  const centerX = columnToX(tile.col);
  const centerY = rowToY(tile.row);
  const aheadOpen = context.canEnter(tile.col + vector.x, tile.row + vector.y);
  const step = entity.speed * deltaSeconds;

  let moved = false;

  if (vector.x !== 0) {
    entity.y = centerY; // lock to the horizontal lane
    const previous = entity.x;
    if (aheadOpen) {
      entity.x += vector.x * step;
    } else if (vector.x > 0) {
      entity.x = Math.min(entity.x + step, centerX);
    } else {
      entity.x = Math.max(entity.x - step, centerX);
    }
    moved = entity.x !== previous;
  } else {
    entity.x = centerX; // lock to the vertical lane
    const previous = entity.y;
    if (aheadOpen) {
      entity.y += vector.y * step;
    } else if (vector.y > 0) {
      entity.y = Math.min(entity.y + step, centerY);
    } else {
      entity.y = Math.max(entity.y - step, centerY);
    }
    moved = entity.y !== previous;
  }

  entity.x = wrapX(entity.x);
  return moved;
};

/**
 * Animates Pac-Man's mouth opening and closing while he is moving. Frozen when
 * stationary (e.g. pressed against a wall), matching the arcade behaviour.
 */
export const advanceMouth = (
  pacman: Pacman,
  deltaSeconds: number,
  isMoving: boolean,
): void => {
  if (!isMoving) {
    return;
  }
  const delta = PACMAN_MOUTH_SPEED * deltaSeconds;
  if (pacman.mouthClosing) {
    pacman.mouthAngle -= delta;
    if (pacman.mouthAngle <= 0) {
      pacman.mouthAngle = 0;
      pacman.mouthClosing = false;
    }
  } else {
    pacman.mouthAngle += delta;
    if (pacman.mouthAngle >= PACMAN_MOUTH_MAX_ANGLE) {
      pacman.mouthAngle = PACMAN_MOUTH_MAX_ANGLE;
      pacman.mouthClosing = true;
    }
  }
};
