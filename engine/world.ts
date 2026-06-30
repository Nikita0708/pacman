/**
 * World and entity factories.
 *
 * Owns the construction and resetting of the mutable GameWorld and its actors.
 * Centralising this keeps the game-loop hook lean and makes "new game / next
 * level / respawn" each a single, well-defined operation.
 */
import {
  GHOST_COLORS,
  GHOST_RELEASE_DELAYS_MS,
  GHOST_SCATTER_TARGETS,
  GHOST_SPAWNS,
  GHOST_SPEED,
  INITIAL_LIVES,
  PACMAN_MOUTH_MAX_ANGLE,
  PACMAN_SPEED,
  READY_DURATION_MS,
  SCATTER_DURATION_MS,
} from './constants';
import { createGrid, MAZE } from './map';
import { Direction, GameState, GhostMode, GhostType } from './types';
import type { GameWorld, Ghost, Pacman } from './types';
import { levelSpeedMultiplier, tileToPixel } from '@/utils/helpers';

/** Builds Pac-Man at his spawn tile, facing nowhere (ready to be steered). */
export const createPacman = (): Pacman => {
  const spawn = tileToPixel(MAZE.pacmanSpawn);
  return {
    x: spawn.x,
    y: spawn.y,
    direction: Direction.NONE,
    nextDirection: Direction.NONE,
    speed: PACMAN_SPEED,
    spawn: { ...spawn },
    mouthAngle: PACMAN_MOUTH_MAX_ANGLE * 0.5,
    mouthClosing: false,
    alive: true,
    deathProgress: 0,
  };
};

/** Builds a single ghost at its spawn tile with its personality data. */
const createGhost = (
  id: GhostType,
  mode: GhostMode,
  direction: Direction,
): Ghost => {
  const spawn = tileToPixel(GHOST_SPAWNS[id]);
  return {
    x: spawn.x,
    y: spawn.y,
    direction,
    nextDirection: Direction.NONE,
    speed: GHOST_SPEED,
    id,
    color: GHOST_COLORS[id],
    spawn: { ...spawn },
    scatterTarget: GHOST_SCATTER_TARGETS[id],
    releaseDelayMs: GHOST_RELEASE_DELAYS_MS[id],
    mode,
    releaseTimer: GHOST_RELEASE_DELAYS_MS[id],
    decisionTile: -1,
  };
};

/**
 * Builds the four ghosts. Blinky starts outside the house already hunting; the
 * others wait inside and are released on their staggered timers.
 */
export const createGhosts = (): Ghost[] => [
  createGhost(GhostType.BLINKY, GhostMode.SCATTER, Direction.LEFT),
  createGhost(GhostType.PINKY, GhostMode.IN_HOUSE, Direction.UP),
  createGhost(GhostType.INKY, GhostMode.IN_HOUSE, Direction.UP),
  createGhost(GhostType.CLYDE, GhostMode.IN_HOUSE, Direction.UP),
];

/** Creates a fresh world for a new game. */
export const createWorld = (
  level: number,
  highScore: number,
  initialLives: number = INITIAL_LIVES,
): GameWorld => {
  const world: GameWorld = {
    grid: createGrid(),
    pacman: createPacman(),
    ghosts: createGhosts(),
    pelletsRemaining: MAZE.pelletCount,
    score: 0,
    lives: initialLives,
    level,
    highScore,
    state: GameState.READY,
    globalMode: GhostMode.SCATTER,
    modeTimer: SCATTER_DURATION_MS,
    powerTimer: 0,
    stateTimer: READY_DURATION_MS,
    powerPulsePhase: 0,
    ghostsEaten: 0,
    bonusLifeGiven: false,
    scorePopups: [],
    ghostEatFreezeTimer: 0,
  };
  world.pacman.speed = PACMAN_SPEED * levelSpeedMultiplier(level);
  return world;
};

/** Creates the initial world shown on first load (the title/menu screen). */
export const createMenuWorld = (highScore: number): GameWorld => {
  const world = createWorld(1, highScore);
  world.state = GameState.MENU;
  return world;
};

/**
 * Resets every actor to its spawn for the current level, keeping score, lives
 * and remaining pellets. Used after a death and at the start of a new level.
 */
export const resetActors = (world: GameWorld): void => {
  const { pacman } = world;
  pacman.x = pacman.spawn.x;
  pacman.y = pacman.spawn.y;
  pacman.direction = Direction.NONE;
  pacman.nextDirection = Direction.NONE;
  pacman.mouthAngle = PACMAN_MOUTH_MAX_ANGLE * 0.5;
  pacman.mouthClosing = false;
  pacman.alive = true;
  pacman.deathProgress = 0;
  pacman.speed = PACMAN_SPEED * levelSpeedMultiplier(world.level);
  world.ghosts = createGhosts();
  world.globalMode = GhostMode.SCATTER;
  world.modeTimer = SCATTER_DURATION_MS;
  world.powerTimer = 0;
  world.ghostsEaten = 0;
  world.scorePopups = [];
  world.ghostEatFreezeTimer = 0;
};

/** Advances to the next level: a fresh board, faster actors, score retained. */
export const advanceLevel = (world: GameWorld): void => {
  world.level += 1;
  world.grid = createGrid();
  world.pelletsRemaining = MAZE.pelletCount;
  resetActors(world);
};
