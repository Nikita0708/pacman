/**
 * useGameEngine — the heart of the game.
 *
 * Holds the entire mutable world in refs and drives it from a single rAF loop,
 * so React never re-renders during play. Per the architecture, all game *logic*
 * (scoring, lives, level flow, win/lose, sounds) lives here; the grid mutation
 * it relies on stays in the collision module. The only bridge back to React is a
 * small GameSnapshot pushed via setState, and only when one of its scalar
 * fields actually changes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  DEATH_ANIMATION_MS,
  EXTRA_LIFE_SCORE,
  GHOST_EAT_FREEZE_MS,
  GHOST_SCORE_SEQUENCE,
  HIGH_SCORE_STORAGE_KEY,
  LEVEL_CLEAR_DELAY_MS,
  LEVELS_TO_WIN,
  MAX_LIVES,
  MILLISECONDS_PER_SECOND,
  PELLET_SCORE,
  POWER_DURATION_MS,
  POWER_PELLET_PULSE_SPEED,
  POWER_PELLET_SCORE,
  READY_DURATION_MS,
  SCORE_POPUP_DURATION_MS,
  SCORE_POPUP_FLOAT_SPEED,
} from '@/engine/constants';
import { canPacmanEnter, consumeAt } from '@/engine/collision';
import { advanceMouth, moveEntity } from '@/engine/movement';
import {
  endFrightened,
  enterFrightened,
  GHOST_COLLISION_DISTANCE,
  isGhostHostile,
  updateGhost,
  updateGhostSchedule,
} from '@/engine/ghostAI';
import { createRenderer } from '@/engine/renderer';
import type { Renderer } from '@/engine/renderer';
import {
  advanceLevel,
  createMenuWorld,
  createWorld,
  resetActors,
} from '@/engine/world';
import { GameState, GhostMode, SoundEffect, TileType } from '@/engine/types';
import type { Direction, GameSnapshot, GameWorld } from '@/engine/types';
import { createAudioPlayer } from '@/engine/audio';
import type { AudioPlayer } from '@/engine/audio';
import { pixelToTile } from '@/utils/helpers';
import { distanceSquared } from '@/utils/math';
import { useAnimationFrame } from './useAnimationFrame';
import { useKeyboard } from './useKeyboard';
import { useTouchInput } from './useTouchInput';

export interface GameEngine {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  snapshot: GameSnapshot;
  start: (lives?: number) => void;
  togglePause: () => void;
  restart: (lives?: number) => void;
}

/** A function that fires a sound effect — injected to keep pure logic clean. */
type SoundEmitter = (effect: SoundEffect) => void;

const TWO_PI = Math.PI * 2;

const toSnapshot = (world: GameWorld): GameSnapshot => ({
  state: world.state,
  score: world.score,
  highScore: world.highScore,
  lives: world.lives,
  level: world.level,
});

const snapshotsEqual = (a: GameSnapshot, b: GameSnapshot): boolean =>
  a.state === b.state &&
  a.score === b.score &&
  a.highScore === b.highScore &&
  a.lives === b.lives &&
  a.level === b.level;

const updateHighScore = (world: GameWorld): void => {
  if (world.score > world.highScore) {
    world.highScore = world.score;
  }
};

/** Grants the one-time bonus life once the threshold score is crossed. */
const awardExtraLife = (world: GameWorld, emit: SoundEmitter): void => {
  if (
    !world.bonusLifeGiven &&
    world.score >= EXTRA_LIFE_SCORE &&
    world.lives < MAX_LIVES
  ) {
    world.lives += 1;
    world.bonusLifeGiven = true;
    emit(SoundEffect.EXTRA_LIFE);
  }
};

/** Begins frightened mode: start the timer and scare every active ghost. */
const activatePower = (world: GameWorld): void => {
  world.powerTimer = POWER_DURATION_MS;
  world.ghostsEaten = 0;
  enterFrightened(world);
};

/** Counts down frightened mode and restores the ghosts when it ends. */
const updatePowerTimer = (world: GameWorld, deltaSeconds: number): void => {
  if (world.powerTimer <= 0) {
    return;
  }
  world.powerTimer -= deltaSeconds * MILLISECONDS_PER_SECOND;
  if (world.powerTimer <= 0) {
    world.powerTimer = 0;
    endFrightened(world);
  }
};

/** Eats the collectible under Pac-Man and applies its score/effect. */
const eatPellets = (world: GameWorld, emit: SoundEmitter): void => {
  const tile = pixelToTile(world.pacman.x, world.pacman.y);
  const eaten = consumeAt(world.grid, tile.col, tile.row);

  if (eaten === TileType.PELLET) {
    world.score += PELLET_SCORE;
    world.pelletsRemaining -= 1;
    emit(SoundEffect.CHOMP);
  } else if (eaten === TileType.POWER_PELLET) {
    world.score += POWER_PELLET_SCORE;
    world.pelletsRemaining -= 1;
    activatePower(world);
    emit(SoundEffect.POWER_PELLET);
  } else {
    return;
  }

  updateHighScore(world);
  awardExtraLife(world, emit);
  if (world.pelletsRemaining <= 0) {
    // Board cleared: start flash animation, then advance or win.
    updateHighScore(world);
    world.state = GameState.LEVEL_CLEAR;
    world.stateTimer = LEVEL_CLEAR_DELAY_MS;
  }
};

/**
 * Triggers the death animation. The actual GAME_OVER / respawn transition
 * happens in updateWorld once the animation timer expires.
 */
const loseLife = (world: GameWorld, emit: SoundEmitter): void => {
  world.lives -= 1;
  updateHighScore(world);
  emit(SoundEffect.DEATH);
  world.state = GameState.DYING;
  world.stateTimer = DEATH_ANIMATION_MS;
  world.pacman.deathProgress = 0;
};

/** Eats a frightened ghost: combo scoring, score popup, sends it home as eyes. */
const eatGhost = (
  world: GameWorld,
  ghost: GameWorld['ghosts'][number],
  emit: SoundEmitter,
): void => {
  const index = Math.min(world.ghostsEaten, GHOST_SCORE_SEQUENCE.length - 1);
  const points = GHOST_SCORE_SEQUENCE[index] ?? 0;
  world.score += points;
  world.ghostsEaten += 1;
  updateHighScore(world);
  ghost.mode = GhostMode.EATEN;
  ghost.decisionTile = -1;
  emit(SoundEffect.EAT_GHOST);
  world.scorePopups.push({
    x: ghost.x,
    y: ghost.y,
    value: points,
    timer: SCORE_POPUP_DURATION_MS,
  });
  world.ghostEatFreezeTimer = GHOST_EAT_FREEZE_MS;
};

/** Resolves Pac-Man/ghost contact: eat a scared ghost, or lose a life. */
const handleCollisions = (world: GameWorld, emit: SoundEmitter): void => {
  const threshold = GHOST_COLLISION_DISTANCE * GHOST_COLLISION_DISTANCE;
  for (const ghost of world.ghosts) {
    if (!isGhostHostile(ghost)) {
      continue;
    }
    const overlap =
      distanceSquared(world.pacman.x, world.pacman.y, ghost.x, ghost.y) <=
      threshold;
    if (!overlap) {
      continue;
    }
    if (ghost.mode === GhostMode.FRIGHTENED) {
      eatGhost(world, ghost, emit);
    } else {
      loseLife(world, emit);
      return;
    }
  }
};

/** Advances floating score labels upward and removes expired ones. */
const updateScorePopups = (world: GameWorld, deltaSeconds: number): void => {
  const { scorePopups } = world;
  for (let i = scorePopups.length - 1; i >= 0; i -= 1) {
    const popup = scorePopups[i];
    if (popup === undefined) {
      continue;
    }
    popup.timer -= deltaSeconds * MILLISECONDS_PER_SECOND;
    popup.y -= SCORE_POPUP_FLOAT_SPEED * deltaSeconds;
    if (popup.timer <= 0) {
      scorePopups.splice(i, 1);
    }
  }
};

/** Advances the world while Pac-Man is actively playing. */
const updatePlaying = (
  world: GameWorld,
  deltaSeconds: number,
  emit: SoundEmitter,
): void => {
  const moved = moveEntity(world.pacman, deltaSeconds, {
    canEnter: (col, row) => canPacmanEnter(world.grid, col, row),
  });
  advanceMouth(world.pacman, deltaSeconds, moved);

  eatPellets(world, emit);
  if (world.state !== GameState.PLAYING) {
    return; // board cleared or life lost this frame
  }

  updatePowerTimer(world, deltaSeconds);
  updateGhostSchedule(world, deltaSeconds);
  for (const ghost of world.ghosts) {
    updateGhost(ghost, world, deltaSeconds);
  }
  handleCollisions(world, emit);
  updateScorePopups(world, deltaSeconds);
};

/** Single per-frame world update, dispatched on the current game state. */
const updateWorld = (
  world: GameWorld,
  deltaSeconds: number,
  emit: SoundEmitter,
): void => {
  world.powerPulsePhase =
    (world.powerPulsePhase + POWER_PELLET_PULSE_SPEED * deltaSeconds) % TWO_PI;

  switch (world.state) {
    case GameState.READY: {
      world.stateTimer -= deltaSeconds * MILLISECONDS_PER_SECOND;
      if (world.stateTimer <= 0) {
        world.state = GameState.PLAYING;
      }
      break;
    }
    case GameState.PLAYING: {
      if (world.ghostEatFreezeTimer > 0) {
        // Classic freeze: halt the world so the score popup is fully visible.
        world.ghostEatFreezeTimer -= deltaSeconds * MILLISECONDS_PER_SECOND;
        if (world.ghostEatFreezeTimer < 0) {
          world.ghostEatFreezeTimer = 0;
        }
      } else {
        updatePlaying(world, deltaSeconds, emit);
      }
      break;
    }
    case GameState.DYING: {
      world.stateTimer -= deltaSeconds * MILLISECONDS_PER_SECOND;
      world.pacman.deathProgress = Math.max(
        0,
        1 - world.stateTimer / DEATH_ANIMATION_MS,
      );
      if (world.stateTimer <= 0) {
        if (world.lives <= 0) {
          world.state = GameState.GAME_OVER;
        } else {
          resetActors(world);
          world.state = GameState.READY;
          world.stateTimer = READY_DURATION_MS;
        }
      }
      break;
    }
    case GameState.LEVEL_CLEAR: {
      world.stateTimer -= deltaSeconds * MILLISECONDS_PER_SECOND;
      if (world.stateTimer <= 0) {
        if (world.level >= LEVELS_TO_WIN) {
          world.state = GameState.WIN;
          emit(SoundEffect.VICTORY);
        } else {
          advanceLevel(world);
          world.state = GameState.READY;
          world.stateTimer = READY_DURATION_MS;
        }
      }
      break;
    }
    default:
      // MENU, PAUSED, WIN, GAME_OVER: render only, no simulation.
      break;
  }
};

export function useGameEngine(): GameEngine {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const worldRef = useRef<GameWorld>(createMenuWorld(0));
  const audioRef = useRef<AudioPlayer | null>(null);

  const [snapshot, setSnapshot] = useState<GameSnapshot>(() =>
    toSnapshot(worldRef.current),
  );
  const snapshotRef = useRef<GameSnapshot>(snapshot);

  const syncSnapshot = useCallback((): void => {
    const next = toSnapshot(worldRef.current);
    if (!snapshotsEqual(snapshotRef.current, next)) {
      snapshotRef.current = next;
      setSnapshot(next);
    }
  }, []);

  // Stable audio emitter — created once, never re-allocated.
  const emit = useCallback((effect: SoundEffect): void => {
    audioRef.current?.play(effect);
  }, []);

  // Load any persisted high score once, on mount.
  useEffect(() => {
    const stored = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
    const value = stored === null ? 0 : Number.parseInt(stored, 10);
    if (Number.isFinite(value) && value > 0) {
      worldRef.current.highScore = value;
      syncSnapshot();
    }
  }, [syncSnapshot]);

  // Persist the high score whenever it improves.
  useEffect(() => {
    window.localStorage.setItem(
      HIGH_SCORE_STORAGE_KEY,
      String(snapshot.highScore),
    );
  }, [snapshot.highScore]);

  // Bind the renderer once the canvas is mounted.
  useEffect(() => {
    if (canvasRef.current === null) {
      return;
    }
    rendererRef.current = createRenderer(canvasRef.current);
    return () => {
      rendererRef.current = null;
    };
  }, []);

  // Create and dispose the audio player with the component lifecycle.
  useEffect(() => {
    audioRef.current = createAudioPlayer();
    return () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  // The single game loop: update → render → (maybe) sync UI.
  useAnimationFrame(
    useCallback(
      (deltaSeconds: number): void => {
        const world = worldRef.current;
        updateWorld(world, deltaSeconds, emit);
        rendererRef.current?.render(world);
        syncSnapshot();
      },
      [syncSnapshot, emit],
    ),
  );

  const start = useCallback((lives?: number): void => {
    worldRef.current = createWorld(1, snapshotRef.current.highScore, lives);
    emit(SoundEffect.GAME_START);
    syncSnapshot();
  }, [syncSnapshot, emit]);

  const restart = useCallback((lives?: number): void => {
    worldRef.current = createWorld(1, snapshotRef.current.highScore, lives);
    emit(SoundEffect.GAME_START);
    syncSnapshot();
  }, [syncSnapshot, emit]);

  const togglePause = useCallback((): void => {
    const world = worldRef.current;
    if (world.state === GameState.PLAYING) {
      world.state = GameState.PAUSED;
    } else if (world.state === GameState.PAUSED) {
      world.state = GameState.PLAYING;
    }
    syncSnapshot();
  }, [syncSnapshot]);

  const handleDirection = useCallback((direction: Direction): void => {
    worldRef.current.pacman.nextDirection = direction;
  }, []);

  const handleConfirm = useCallback((): void => {
    const state = worldRef.current.state;
    if (
      state === GameState.MENU ||
      state === GameState.WIN ||
      state === GameState.GAME_OVER
    ) {
      start();
    } else {
      togglePause();
    }
  }, [start, togglePause]);

  useKeyboard({
    onDirection: handleDirection,
    onTogglePause: togglePause,
    onConfirm: handleConfirm,
  });

  useTouchInput(canvasRef, {
    onDirection: handleDirection,
    onTogglePause: togglePause,
    onConfirm: handleConfirm,
  });

  return { canvasRef, snapshot, start, togglePause, restart };
}
