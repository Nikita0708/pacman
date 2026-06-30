/**
 * Canvas renderer.
 *
 * Pure presentation: it reads the world and paints it, but never mutates game
 * state — game logic has zero dependency on this module (Separation of
 * Concerns). The static maze is rasterised once into an offscreen canvas at
 * device resolution and blitted each frame, while dynamic actors and pellets
 * are drawn fresh. This keeps the per-frame cost low without sacrificing
 * crispness (the maze is re-rasterised only when the display size changes).
 */
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLORS,
  DIRECTION_ANGLES,
  DIRECTION_VECTORS,
  GHOST_COLORS,
  GHOST_EYE_RADIUS,
  GHOST_PUPIL_RADIUS,
  GHOST_RADIUS,
  GHOST_SKIRT_WAVES,
  LEVEL_CLEAR_FLASH_INTERVAL_MS,
  PACMAN_RADIUS,
  PELLET_RADIUS,
  POWER_FLASH_INTERVAL_MS,
  POWER_FLASH_THRESHOLD_MS,
  POWER_PELLET_PULSE_AMOUNT,
  POWER_PELLET_RADIUS,
  READY_FONT_SIZE,
  READY_TEXT_ROW,
  SCORE_POPUP_DURATION_MS,
  SCORE_POPUP_FONT_SIZE,
  TILE_SIZE,
  WALL_GLOW_BLUR,
  WALL_LINE_WIDTH,
} from './constants';
import { isWall, tileAt } from './collision';
import { Direction, GameState, GhostMode, TileType } from './types';
import type { GameWorld, Ghost, Pacman, ScorePopup } from './types';
import { columnToX, rowToY } from '@/utils/helpers';

export interface Renderer {
  /** Draws a single frame from the current world. */
  render: (world: GameWorld) => void;
}

const TWO_PI = Math.PI * 2;

/** Rasterises the static maze (walls + ghost gate) into the offscreen layer. */
const renderMaze = (
  ctx: CanvasRenderingContext2D,
  grid: readonly (readonly TileType[])[],
  deviceWidth: number,
  deviceHeight: number,
): void => {
  ctx.setTransform(
    deviceWidth / CANVAS_WIDTH,
    0,
    0,
    deviceHeight / CANVAS_HEIGHT,
    0,
    0,
  );
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Neon outlines: stroke only the wall edges that face a corridor.
  ctx.lineWidth = WALL_LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.strokeStyle = COLORS.wallStroke;
  ctx.shadowColor = COLORS.wallGlow;
  ctx.shadowBlur = WALL_GLOW_BLUR;

  const wallPath = new Path2D();
  for (let row = 0; row < grid.length; row += 1) {
    const line = grid[row];
    if (line === undefined) {
      continue;
    }
    for (let col = 0; col < line.length; col += 1) {
      if (line[col] !== TileType.WALL) {
        continue;
      }
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      if (!isWall(grid, col, row - 1)) {
        wallPath.moveTo(x, y);
        wallPath.lineTo(x + TILE_SIZE, y);
      }
      if (!isWall(grid, col, row + 1)) {
        wallPath.moveTo(x, y + TILE_SIZE);
        wallPath.lineTo(x + TILE_SIZE, y + TILE_SIZE);
      }
      if (!isWall(grid, col - 1, row)) {
        wallPath.moveTo(x, y);
        wallPath.lineTo(x, y + TILE_SIZE);
      }
      if (!isWall(grid, col + 1, row)) {
        wallPath.moveTo(x + TILE_SIZE, y);
        wallPath.lineTo(x + TILE_SIZE, y + TILE_SIZE);
      }
    }
  }
  ctx.stroke(wallPath);

  // Ghost-house gate as a glowing pink bar.
  ctx.strokeStyle = COLORS.gate;
  ctx.shadowColor = COLORS.gate;
  ctx.shadowBlur = WALL_GLOW_BLUR;
  ctx.lineWidth = WALL_LINE_WIDTH * 1.5;
  const gatePath = new Path2D();
  for (let row = 0; row < grid.length; row += 1) {
    const line = grid[row];
    if (line === undefined) {
      continue;
    }
    for (let col = 0; col < line.length; col += 1) {
      if (line[col] !== TileType.GHOST_HOUSE) {
        continue;
      }
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE + TILE_SIZE * 0.5;
      gatePath.moveTo(x, y);
      gatePath.lineTo(x + TILE_SIZE, y);
    }
  }
  ctx.stroke(gatePath);
  ctx.shadowBlur = 0;
};

/** Draws every remaining normal pellet as one cheap, glow-free fill. */
const drawPellets = (
  ctx: CanvasRenderingContext2D,
  grid: readonly (readonly TileType[])[],
): void => {
  ctx.fillStyle = COLORS.pellet;
  ctx.beginPath();
  for (let row = 0; row < grid.length; row += 1) {
    const line = grid[row];
    if (line === undefined) {
      continue;
    }
    for (let col = 0; col < line.length; col += 1) {
      if (line[col] !== TileType.PELLET) {
        continue;
      }
      const cx = columnToX(col);
      const cy = rowToY(row);
      ctx.moveTo(cx + PELLET_RADIUS, cy);
      ctx.arc(cx, cy, PELLET_RADIUS, 0, TWO_PI);
    }
  }
  ctx.fill();
};

/** Draws the pulsing power pellets with a soft glow. */
const drawPowerPellets = (
  ctx: CanvasRenderingContext2D,
  grid: readonly (readonly TileType[])[],
  pulsePhase: number,
): void => {
  const radius =
    POWER_PELLET_RADIUS * (1 + Math.sin(pulsePhase) * POWER_PELLET_PULSE_AMOUNT);
  ctx.fillStyle = COLORS.powerPellet;
  ctx.shadowColor = COLORS.powerPellet;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  for (let row = 0; row < grid.length; row += 1) {
    const line = grid[row];
    if (line === undefined) {
      continue;
    }
    for (let col = 0; col < line.length; col += 1) {
      if (line[col] !== TileType.POWER_PELLET) {
        continue;
      }
      const cx = columnToX(col);
      const cy = rowToY(row);
      ctx.moveTo(cx + radius, cy);
      ctx.arc(cx, cy, radius, 0, TWO_PI);
    }
  }
  ctx.fill();
  ctx.shadowBlur = 0;
};

/** Draws Pac-Man as an animated wedge facing his current direction. */
const drawPacman = (ctx: CanvasRenderingContext2D, pacman: Pacman): void => {
  if (pacman.deathProgress > 0) {
    if (pacman.deathProgress >= 1) {
      return;
    }
    // Classic death: open wedge sweeps from a full circle to nothing.
    // arc(angle, 2π-angle) with moveTo(center) traces a pie shrinking from east.
    const deathAngle = pacman.deathProgress * Math.PI;
    ctx.fillStyle = COLORS.pacman;
    ctx.shadowColor = COLORS.pacman;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(pacman.x, pacman.y);
    ctx.arc(pacman.x, pacman.y, PACMAN_RADIUS, deathAngle, TWO_PI - deathAngle);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    return;
  }
  if (!pacman.alive) {
    return;
  }
  const base = DIRECTION_ANGLES[pacman.direction];
  const mouth = pacman.mouthAngle;
  ctx.fillStyle = COLORS.pacman;
  ctx.shadowColor = COLORS.pacman;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(pacman.x, pacman.y);
  ctx.arc(pacman.x, pacman.y, PACMAN_RADIUS, base + mouth, base + TWO_PI - mouth);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
};

/** Draws floating "+score" labels that rise and fade after eating a ghost. */
const drawScorePopups = (
  ctx: CanvasRenderingContext2D,
  popups: readonly ScorePopup[],
): void => {
  if (popups.length === 0) {
    return;
  }
  ctx.font = `bold ${SCORE_POPUP_FONT_SIZE}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const popup of popups) {
    const alpha = Math.max(0, popup.timer / SCORE_POPUP_DURATION_MS);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.frightenedFlash;
    ctx.shadowColor = COLORS.pacman;
    ctx.shadowBlur = 8;
    ctx.fillText(`+${String(popup.value)}`, popup.x, popup.y);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
};

/** Draws a single ghost: rounded body, wavy skirt and direction-aware eyes. */
const drawGhost = (
  ctx: CanvasRenderingContext2D,
  ghost: Ghost,
  frightenedFlash: boolean,
): void => {
  const isFrightened = ghost.mode === GhostMode.FRIGHTENED;
  const isEaten =
    ghost.mode === GhostMode.EATEN || ghost.mode === GhostMode.ENTERING_HOUSE;
  const bodyColor = isFrightened
    ? frightenedFlash
      ? COLORS.frightenedFlash
      : COLORS.frightened
    : GHOST_COLORS[ghost.id];

  if (!isEaten) {
    ctx.fillStyle = bodyColor;
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(ghost.x, ghost.y, GHOST_RADIUS, Math.PI, 0);
    const skirtY = ghost.y + GHOST_RADIUS;
    const waveWidth = (GHOST_RADIUS * 2) / GHOST_SKIRT_WAVES;
    ctx.lineTo(ghost.x + GHOST_RADIUS, skirtY);
    for (let wave = 0; wave < GHOST_SKIRT_WAVES; wave += 1) {
      const startX = ghost.x + GHOST_RADIUS - wave * waveWidth;
      const midX = startX - waveWidth * 0.5;
      const endX = startX - waveWidth;
      ctx.quadraticCurveTo(midX, skirtY - waveWidth * 0.5, endX, skirtY);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Eyes (always drawn — they are all that remains of an eaten ghost). The
  // pupils glance toward the direction of travel; a frightened ghost stares
  // blankly ahead.
  const look = isFrightened
    ? DIRECTION_VECTORS[Direction.NONE]
    : DIRECTION_VECTORS[ghost.direction];
  const eyeOffsetX = GHOST_RADIUS * 0.32;
  const eyeY = ghost.y - GHOST_RADIUS * 0.1;
  const pupilShift = GHOST_EYE_RADIUS * 0.45;
  for (const sign of [-1, 1]) {
    const eyeX = ghost.x + sign * eyeOffsetX;
    ctx.fillStyle = COLORS.ghostEye;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, GHOST_EYE_RADIUS, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = COLORS.ghostPupil;
    ctx.beginPath();
    ctx.arc(
      eyeX + look.x * pupilShift,
      eyeY + look.y * pupilShift,
      GHOST_PUPIL_RADIUS,
      0,
      TWO_PI,
    );
    ctx.fill();
  }
};

/**
 * Creates a renderer bound to a canvas. Manages its own offscreen maze cache
 * and device-pixel-ratio scaling, so callers just call `render(world)`.
 */
export const createRenderer = (canvas: HTMLCanvasElement): Renderer => {
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('2D canvas context is not available.');
  }

  const mazeLayer = document.createElement('canvas');
  const mazeCtx = mazeLayer.getContext('2d');
  if (mazeCtx === null) {
    throw new Error('2D canvas context is not available.');
  }

  let deviceWidth = 0;
  let deviceHeight = 0;
  let cachedGrid: readonly (readonly TileType[])[] | null = null;

  const ensureSurface = (grid: readonly (readonly TileType[])[]): void => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width * dpr));
    const nextHeight = Math.max(1, Math.round(rect.height * dpr));

    if (nextWidth !== deviceWidth || nextHeight !== deviceHeight) {
      deviceWidth = nextWidth;
      deviceHeight = nextHeight;
      canvas.width = deviceWidth;
      canvas.height = deviceHeight;
      mazeLayer.width = deviceWidth;
      mazeLayer.height = deviceHeight;
      cachedGrid = null; // size changed → maze must be re-rasterised
    }

    if (grid !== cachedGrid) {
      renderMaze(mazeCtx, grid, deviceWidth, deviceHeight);
      cachedGrid = grid;
    }
  };

  const render = (world: GameWorld): void => {
    ensureSurface(world.grid);

    // Blit the cached maze 1:1 at device resolution.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, deviceWidth, deviceHeight);
    ctx.drawImage(mazeLayer, 0, 0);

    // Dynamic content is drawn in world units, scaled to the device.
    ctx.setTransform(
      deviceWidth / CANVAS_WIDTH,
      0,
      0,
      deviceHeight / CANVAS_HEIGHT,
      0,
      0,
    );
    drawPellets(ctx, world.grid);
    drawPowerPellets(ctx, world.grid, world.powerPulsePhase);

    // "READY!" drawn directly on the canvas during the count-down, so it looks
    // like text painted on the maze rather than a UI overlay.
    if (world.state === GameState.READY) {
      const cx = CANVAS_WIDTH / 2;
      const cy = rowToY(READY_TEXT_ROW);
      ctx.font = `bold ${READY_FONT_SIZE}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.pacman;
      ctx.shadowColor = COLORS.pacman;
      ctx.shadowBlur = 18;
      ctx.fillText('READY!', cx, cy);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    // Flash frightened ghosts white during the final seconds of the power-up.
    const flashing =
      world.powerTimer > 0 &&
      world.powerTimer <= POWER_FLASH_THRESHOLD_MS &&
      Math.floor(world.powerTimer / POWER_FLASH_INTERVAL_MS) % 2 === 0;

    // During the death animation ghosts freeze in place but stay hidden.
    if (world.state !== GameState.DYING) {
      for (const ghost of world.ghosts) {
        drawGhost(ctx, ghost, flashing);
      }
    }
    drawPacman(ctx, world.pacman);
    drawScorePopups(ctx, world.scorePopups);

    // Level-clear: flash the maze blue/white before advancing to the next level.
    if (world.state === GameState.LEVEL_CLEAR) {
      const flashOn =
        Math.floor(world.stateTimer / LEVEL_CLEAR_FLASH_INTERVAL_MS) % 2 === 0;
      ctx.fillStyle = flashOn
        ? 'rgba(255,255,255,0.45)'
        : 'rgba(59,130,246,0.22)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  };

  return { render };
};

/** Re-exported for tooling/tests that want the raw tile lookup. */
export { tileAt };
