/**
 * GameControls — the Start / Pause / Restart button bar.
 *
 * A controlled, presentational component: it derives its labels and disabled
 * states purely from the current GameState and forwards intent through
 * callbacks. It holds no state of its own.
 */
import type { ReactNode } from 'react';
import { GameState } from '@/engine/types';

interface GameControlsProps {
  state: GameState;
  onStart: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
}

type NeonVariant = 'yellow' | 'cyan' | 'pink';

interface NeonButtonProps {
  children: ReactNode;
  onClick: () => void;
  variant: NeonVariant;
  disabled?: boolean;
}

const VARIANT_CLASSES: Readonly<Record<NeonVariant, string>> = {
  yellow:
    'border-yellow-300/60 text-yellow-200 hover:bg-yellow-300/10 shadow-[0_0_18px_rgba(253,224,71,0.35)]',
  cyan: 'border-cyan-300/60 text-cyan-200 hover:bg-cyan-300/10 shadow-[0_0_18px_rgba(103,232,249,0.35)]',
  pink: 'border-pink-300/60 text-pink-200 hover:bg-pink-300/10 shadow-[0_0_18px_rgba(244,114,182,0.35)]',
};

function NeonButton({
  children,
  onClick,
  variant,
  disabled = false,
}: NeonButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-w-[7rem] rounded-xl border bg-slate-950/60 px-5 py-2.5 font-mono text-sm font-bold uppercase tracking-[0.2em] transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-25 disabled:shadow-none ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </button>
  );
}

export function GameControls({
  state,
  onStart,
  onTogglePause,
  onRestart,
}: GameControlsProps) {
  const isFinished = state === GameState.WIN || state === GameState.GAME_OVER;
  const isIdle = state === GameState.MENU;
  const isActive = state === GameState.PLAYING || state === GameState.PAUSED;

  const startLabel = isFinished ? 'Play Again' : 'Start';

  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-3">
      <NeonButton
        variant="yellow"
        onClick={onStart}
        disabled={!isIdle && !isFinished}
      >
        {startLabel}
      </NeonButton>

      <NeonButton variant="cyan" onClick={onTogglePause} disabled={!isActive}>
        {state === GameState.PAUSED ? 'Resume' : 'Pause'}
      </NeonButton>

      <NeonButton variant="pink" onClick={onRestart} disabled={isIdle}>
        Restart
      </NeonButton>
    </div>
  );
}
