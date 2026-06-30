/**
 * Single source of truth for every tunable game value.
 *
 * No other module may contain "magic numbers" — gameplay, rendering and UI
 * all read their constants from here. Speeds are expressed in pixels per
 * second so movement stays frame-rate independent via deltaTime.
 */
import { Direction, GhostType } from './types';
import type { GridPosition, Vector2 } from './types';

// ── Grid & canvas dimensions ────────────────────────────────────────────────
export const TILE_SIZE = 24;
export const MAZE_COLUMNS = 28;
export const MAZE_ROWS = 31;
export const CANVAS_WIDTH = TILE_SIZE * MAZE_COLUMNS; // 672
export const CANVAS_HEIGHT = TILE_SIZE * MAZE_ROWS; // 744

// ── Timing ──────────────────────────────────────────────────────────────────
export const REFERENCE_FPS = 60;
export const MILLISECONDS_PER_SECOND = 1000;
/** Largest delta we ever apply, so a paused/backgrounded tab can't "teleport". */
export const MAX_FRAME_DELTA_SECONDS = 1 / 30;

/** Converts the intuitive "pixels per frame at 60fps" into pixels per second. */
const perFrameToPerSecond = (pixelsPerFrame: number): number =>
  pixelsPerFrame * REFERENCE_FPS;

// ── Movement speeds (pixels per second) ─────────────────────────────────────
export const PACMAN_SPEED = perFrameToPerSecond(2.2);
export const GHOST_SPEED = perFrameToPerSecond(1.9);
export const FRIGHTENED_SPEED = perFrameToPerSecond(1.2);
export const EATEN_SPEED = perFrameToPerSecond(4.0);
export const GHOST_HOUSE_SPEED = perFrameToPerSecond(1.0);

// ── Lives & progression ─────────────────────────────────────────────────────
export const INITIAL_LIVES = 3;
export const MAX_LIVES = 5;
export const EXTRA_LIFE_SCORE = 10000;

// ── Power-up (frightened mode) ──────────────────────────────────────────────
export const POWER_DURATION_MS = 7000;
/** When the remaining time drops below this, ghosts start flashing white. */
export const POWER_FLASH_THRESHOLD_MS = 2000;
export const POWER_FLASH_INTERVAL_MS = 220;

// ── Ghost scatter/chase wave scheduling ─────────────────────────────────────
export const SCATTER_DURATION_MS = 7000;
export const CHASE_DURATION_MS = 20000;

// ── Scoring ─────────────────────────────────────────────────────────────────
export const PELLET_SCORE = 10;
export const POWER_PELLET_SCORE = 50;
/** Points for eating consecutive ghosts during a single power-up. */
export const GHOST_SCORE_SEQUENCE = [200, 400, 800, 1600] as const;

// ── Level progression ───────────────────────────────────────────────────────
/** Clearing this many boards triggers the WIN state; earlier boards advance. */
export const LEVELS_TO_WIN = 3;
/** Per-level speed bump and its ceiling (keeps high levels playable). */
export const LEVEL_SPEED_STEP = 0.07;
export const MAX_LEVEL_SPEED_MULTIPLIER = 1.4;

// ── Persistence ─────────────────────────────────────────────────────────────
export const HIGH_SCORE_STORAGE_KEY = 'neon-pacman-high-score';

// ── State-machine timing ────────────────────────────────────────────────────
export const READY_DURATION_MS = 2000;
export const DEATH_ANIMATION_MS = 1500;
export const LEVEL_CLEAR_DELAY_MS = 1500;
export const LEVEL_CLEAR_FLASH_INTERVAL_MS = 220;
/** How long the game freezes after Pac-Man eats a frightened ghost. */
export const GHOST_EAT_FREEZE_MS = 1000;

// ── Score popup rendering ────────────────────────────────────────────────────
export const SCORE_POPUP_DURATION_MS = 900;
export const SCORE_POPUP_FLOAT_SPEED = 36;
export const SCORE_POPUP_FONT_SIZE = 13;

// ── READY! canvas text ───────────────────────────────────────────────────────
/** Row at which the "READY!" label is drawn on the canvas during the ready state. */
export const READY_TEXT_ROW = 17;
export const READY_FONT_SIZE = 20;

// ── Pac-Man rendering & animation ───────────────────────────────────────────
export const PACMAN_RADIUS = TILE_SIZE * 0.5;
export const PACMAN_MOUTH_MAX_ANGLE = Math.PI * 0.32;
/** Mouth open/close angular speed, in radians per second. */
export const PACMAN_MOUTH_SPEED = Math.PI * 2.5;

// ── Pellet rendering & animation ────────────────────────────────────────────
export const PELLET_RADIUS = TILE_SIZE * 0.09;
export const POWER_PELLET_RADIUS = TILE_SIZE * 0.28;
export const POWER_PELLET_PULSE_SPEED = 6; // radians per second
export const POWER_PELLET_PULSE_AMOUNT = 0.18; // ± fraction of the radius

// ── Wall rendering ──────────────────────────────────────────────────────────
export const WALL_LINE_WIDTH = 2.5;
export const WALL_CORNER_RADIUS = TILE_SIZE * 0.5;
export const WALL_GLOW_BLUR = 8;

// ── Ghost rendering ─────────────────────────────────────────────────────────
export const GHOST_RADIUS = TILE_SIZE * 0.46;
export const GHOST_EYE_RADIUS = TILE_SIZE * 0.13;
export const GHOST_PUPIL_RADIUS = TILE_SIZE * 0.06;
export const GHOST_SKIRT_WAVES = 3;

// ── Neon-retro colour palette ───────────────────────────────────────────────
export const COLORS = {
  background: '#0f172a',
  wallStroke: '#3b82f6',
  wallGlow: '#60a5fa',
  wallFill: '#0b1220',
  gate: '#f9a8d4',
  pellet: '#fcd9b6',
  powerPellet: '#fde047',
  pacman: '#ffe600',
  frightened: '#2563eb',
  frightenedFlash: '#f8fafc',
  ghostEye: '#ffffff',
  ghostPupil: '#1e3a8a',
  text: '#e2e8f0',
} as const;

export const GHOST_COLORS: Readonly<Record<GhostType, string>> = {
  [GhostType.BLINKY]: '#ff5555',
  [GhostType.PINKY]: '#ff9bd2',
  [GhostType.INKY]: '#69e6ff',
  [GhostType.CLYDE]: '#ffb852',
};

// ── Direction helpers ───────────────────────────────────────────────────────
export const DIRECTION_VECTORS: Readonly<Record<Direction, Vector2>> = {
  [Direction.NONE]: { x: 0, y: 0 },
  [Direction.UP]: { x: 0, y: -1 },
  [Direction.DOWN]: { x: 0, y: 1 },
  [Direction.LEFT]: { x: -1, y: 0 },
  [Direction.RIGHT]: { x: 1, y: 0 },
};

export const OPPOSITE_DIRECTION: Readonly<Record<Direction, Direction>> = {
  [Direction.NONE]: Direction.NONE,
  [Direction.UP]: Direction.DOWN,
  [Direction.DOWN]: Direction.UP,
  [Direction.LEFT]: Direction.RIGHT,
  [Direction.RIGHT]: Direction.LEFT,
};

/** Render angle (radians) Pac-Man faces for each direction. */
export const DIRECTION_ANGLES: Readonly<Record<Direction, number>> = {
  [Direction.NONE]: 0,
  [Direction.RIGHT]: 0,
  [Direction.DOWN]: Math.PI * 0.5,
  [Direction.LEFT]: Math.PI,
  [Direction.UP]: Math.PI * 1.5,
};

// ── Keyboard bindings (Arrow keys + WASD) ───────────────────────────────────
export const KEY_DIRECTION_MAP: Readonly<Record<string, Direction>> = {
  ArrowUp: Direction.UP,
  ArrowDown: Direction.DOWN,
  ArrowLeft: Direction.LEFT,
  ArrowRight: Direction.RIGHT,
  KeyW: Direction.UP,
  KeyS: Direction.DOWN,
  KeyA: Direction.LEFT,
  KeyD: Direction.RIGHT,
};

export const PAUSE_KEYS: ReadonlySet<string> = new Set(['Escape', 'KeyP']);
export const CONFIRM_KEYS: ReadonlySet<string> = new Set(['Enter', 'Space']);

// ── Ghost house & spawn layout (grid coordinates) ───────────────────────────
export const GHOST_SPAWNS: Readonly<Record<GhostType, GridPosition>> = {
  [GhostType.BLINKY]: { col: 13, row: 11 },
  [GhostType.PINKY]: { col: 13, row: 14 },
  [GhostType.INKY]: { col: 11, row: 14 },
  [GhostType.CLYDE]: { col: 16, row: 14 },
};

/** The tile just outside the house door that ghosts steer toward when leaving. */
export const GHOST_HOUSE_EXIT: GridPosition = { col: 13, row: 11 };
export const GHOST_HOUSE_CENTER: GridPosition = { col: 13, row: 14 };
/** Column the ghosts line up with to pass through the gate. */
export const GHOST_GATE_COLUMN = 13;
/** Vertical bobbing range of a ghost waiting in the house, in pixels. */
export const GHOST_HOUSE_BOB_RANGE = TILE_SIZE * 0.3;
/** How long an eaten ghost waits in the house before leaving again. */
export const HOUSE_REENTER_DELAY_MS = 1500;

/** Delay before each ghost first leaves the house, in milliseconds. */
export const GHOST_RELEASE_DELAYS_MS: Readonly<Record<GhostType, number>> = {
  [GhostType.BLINKY]: 0,
  [GhostType.PINKY]: 2000,
  [GhostType.INKY]: 4000,
  [GhostType.CLYDE]: 6000,
};

/** Corner each ghost retreats to during scatter mode. */
export const GHOST_SCATTER_TARGETS: Readonly<Record<GhostType, GridPosition>> = {
  [GhostType.BLINKY]: { col: MAZE_COLUMNS - 3, row: 0 },
  [GhostType.PINKY]: { col: 2, row: 0 },
  [GhostType.INKY]: { col: MAZE_COLUMNS - 1, row: MAZE_ROWS - 1 },
  [GhostType.CLYDE]: { col: 0, row: MAZE_ROWS - 1 },
};

// ── Ghost AI tuning ─────────────────────────────────────────────────────────
/** Pinky/Inky aim this many tiles ahead of Pac-Man. */
export const PINKY_LOOKAHEAD_TILES = 4;
export const INKY_LOOKAHEAD_TILES = 2;
/** Clyde chases only while farther than this from Pac-Man, else scatters. */
export const CLYDE_CHASE_RADIUS_TILES = 8;
