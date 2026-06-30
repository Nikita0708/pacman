/**
 * Core domain types and enums.
 *
 * This module is pure data: it has no runtime dependencies and never imports
 * from the rendering, hooks or React layers. Everything else in the engine
 * depends on it, never the other way around (Dependency Inversion).
 */

/** Cardinal movement directions, plus an explicit "not moving" value. */
export enum Direction {
  NONE = 'NONE',
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

/** High-level finite state machine for the whole game. */
export enum GameState {
  MENU = 'MENU',
  READY = 'READY',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  DYING = 'DYING',
  LEVEL_CLEAR = 'LEVEL_CLEAR',
  WIN = 'WIN',
  GAME_OVER = 'GAME_OVER',
}

/** The four ghosts. Used as a stable identity/key throughout the engine. */
export enum GhostType {
  BLINKY = 'BLINKY',
  PINKY = 'PINKY',
  INKY = 'INKY',
  CLYDE = 'CLYDE',
}

/** Behavioural mode of a ghost. Drives both AI targeting and rendering. */
export enum GhostMode {
  IN_HOUSE = 'IN_HOUSE',
  LEAVING_HOUSE = 'LEAVING_HOUSE',
  ENTERING_HOUSE = 'ENTERING_HOUSE',
  SCATTER = 'SCATTER',
  CHASE = 'CHASE',
  FRIGHTENED = 'FRIGHTENED',
  EATEN = 'EATEN',
}

/** Tile kinds stored in the maze matrix. Values match the map legend. */
export enum TileType {
  EMPTY = 0,
  WALL = 1,
  PELLET = 2,
  POWER_PELLET = 3,
  GHOST_HOUSE = 4,
  PACMAN_SPAWN = 5,
  TUNNEL = 6,
}

/** Identifiers for every sound effect the audio layer can play. */
export enum SoundEffect {
  GAME_START = 'GAME_START',
  CHOMP = 'CHOMP',
  POWER_PELLET = 'POWER_PELLET',
  EAT_GHOST = 'EAT_GHOST',
  DEATH = 'DEATH',
  EXTRA_LIFE = 'EXTRA_LIFE',
  VICTORY = 'VICTORY',
}

/** A point in pixel space. */
export interface Vector2 {
  x: number;
  y: number;
}

/** A discrete cell in the maze matrix (column = x axis, row = y axis). */
export interface GridPosition {
  col: number;
  row: number;
}

/** Base shape shared by every moving actor in the game. */
export interface Entity {
  x: number;
  y: number;
  direction: Direction;
  /** Buffered direction from the input queue, applied at the next junction. */
  nextDirection: Direction;
  /** Movement speed in pixels per second (used with deltaTime). */
  speed: number;
}

/** The player character. */
export interface Pacman extends Entity {
  readonly spawn: Vector2;
  /** Current half-angle of the mouth opening, in radians. */
  mouthAngle: number;
  /** Animation direction of the mouth (true = closing, false = opening). */
  mouthClosing: boolean;
  alive: boolean;
  /** 0 while alive; advances 0→1 during the death animation. */
  deathProgress: number;
}

/** A floating score label shown briefly on the canvas after eating a ghost. */
export interface ScorePopup {
  x: number;
  y: number;
  value: number;
  /** Milliseconds remaining before the popup disappears. */
  timer: number;
}

/** A single enemy ghost. */
export interface Ghost extends Entity {
  readonly id: GhostType;
  readonly color: string;
  readonly spawn: Vector2;
  readonly scatterTarget: GridPosition;
  /** Delay before this ghost first leaves the house, in milliseconds. */
  readonly releaseDelayMs: number;
  mode: GhostMode;
  /** Countdown until the ghost is released from the house, in milliseconds. */
  releaseTimer: number;
  /**
   * Encoded tile (col, row) of the last AI decision, so a ghost chooses its
   * direction exactly once per tile entered rather than every frame.
   */
  decisionTile: number;
}

/** A normal collectible dot. */
export interface Pellet {
  readonly col: number;
  readonly row: number;
}

/** An energizer that triggers frightened mode when eaten. */
export interface PowerPellet extends Pellet {}

/** Parsed, ready-to-use representation of a level layout. */
export interface MazeData {
  readonly grid: TileType[][];
  readonly columns: number;
  readonly rows: number;
  readonly pelletCount: number;
  readonly pacmanSpawn: GridPosition;
  readonly tunnelRows: readonly number[];
}

/** Immutable slice of state mirrored into React for the HUD/UI layer. */
export interface GameSnapshot {
  state: GameState;
  score: number;
  highScore: number;
  lives: number;
  level: number;
}

/**
 * The complete mutable game world. Held in a ref and updated in place every
 * frame so React never re-renders during the game loop. The UI only ever sees
 * the derived GameSnapshot above.
 */
export interface GameWorld {
  grid: TileType[][];
  pacman: Pacman;
  ghosts: Ghost[];
  pelletsRemaining: number;
  score: number;
  lives: number;
  level: number;
  highScore: number;
  state: GameState;
  /** Current global ghost mode (only SCATTER or CHASE) driven by modeTimer. */
  globalMode: GhostMode;
  /** Countdown until the next scatter/chase switch, in milliseconds. */
  modeTimer: number;
  /** Remaining frightened time in milliseconds (0 when inactive). */
  powerTimer: number;
  /** Generic countdown for the current state (e.g. READY), in milliseconds. */
  stateTimer: number;
  /** Phase accumulator driving the power-pellet pulse animation. */
  powerPulsePhase: number;
  /** Ghosts eaten during the current power-up, for combo scoring. */
  ghostsEaten: number;
  /** Whether the one-time extra-life bonus has already been granted. */
  bonusLifeGiven: boolean;
  /** Floating score labels shown on canvas after eating ghosts. */
  scorePopups: ScorePopup[];
  /**
   * Remaining milliseconds of the post–ghost-eat freeze. While > 0 the world
   * simulation is halted so the score popup is fully visible.
   */
  ghostEatFreezeTimer: number;
}
