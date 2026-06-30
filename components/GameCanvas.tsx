/**
 * GameCanvas — owns the <canvas> element and the React overlay drawn on top
 * of it (READY!, PAUSED, GAME OVER, …).
 *
 * The canvas is a pure drawing surface: this component only mounts it, keeps a
 * correct aspect ratio, and forwards a ref. All pixel rendering happens in the
 * engine's renderer (Step 3). State-driven *text* overlays are plain React DOM
 * — never drawn into the canvas — which keeps UI and game world separated.
 */
import type { RefObject } from 'react';
import { GameState } from '@/engine/types';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/engine/constants';

interface GameCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  state: GameState;
}

interface OverlayContent {
  title: string;
  subtitle: string;
  titleClassName: string;
}

const OVERLAY_BY_STATE: Partial<Record<GameState, OverlayContent>> = {
  [GameState.MENU]: {
    title: 'PRESS START',
    subtitle: 'Arrows / WASD · Swipe to move',
    titleClassName: 'text-yellow-300',
  },
  // READY is rendered on the canvas itself, not as a DOM overlay.
  [GameState.PAUSED]: {
    title: 'PAUSED',
    subtitle: 'P / Esc · Tap to resume',
    titleClassName: 'text-cyan-300',
  },
  [GameState.WIN]: {
    title: 'YOU WIN!',
    subtitle: 'Press Play Again to continue',
    titleClassName: 'text-green-300',
  },
  [GameState.GAME_OVER]: {
    title: 'GAME OVER',
    subtitle: 'Press Play Again to retry',
    titleClassName: 'text-red-400',
  },
};

function CanvasOverlay({ state }: { state: GameState }) {
  const content = OVERLAY_BY_STATE[state];
  if (!content) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/55 text-center backdrop-blur-[1px]">
      <h2
        className={`font-mono text-3xl font-extrabold uppercase tracking-[0.35em] sm:text-4xl ${content.titleClassName} drop-shadow-[0_0_16px_currentColor] animate-pulse`}
      >
        {content.title}
      </h2>
      {content.subtitle && (
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-300/80">
          {content.subtitle}
        </p>
      )}
    </div>
  );
}

export function GameCanvas({ canvasRef, state }: GameCanvasProps) {
  return (
    <div
      className="relative mx-auto w-full touch-none overflow-hidden rounded-2xl bg-[#0b1020] ring-2 ring-blue-500/50 shadow-[0_0_45px_rgba(59,130,246,0.35)]"
      style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="absolute inset-0 block h-full w-full"
      />
      <CanvasOverlay state={state} />
    </div>
  );
}
