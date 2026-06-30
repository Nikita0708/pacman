/**
 * GameHUD — purely presentational head-up display.
 *
 * Receives a flat slice of UI state and renders it. It owns no game logic and
 * never touches the canvas, satisfying Separation of Concerns. Re-renders only
 * when one of its scalar props actually changes.
 */
import { MAX_LIVES } from '@/engine/constants';

interface GameHUDProps {
  score: number;
  highScore: number;
  level: number;
  lives: number;
}

interface StatProps {
  label: string;
  value: string;
  valueClassName?: string;
}

function Stat({ label, value, valueClassName = 'text-yellow-300' }: StatProps) {
  return (
    <div className="flex flex-col items-start">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-blue-300/70">
        {label}
      </span>
      <span
        className={`font-mono text-lg font-bold tabular-nums tracking-wider ${valueClassName} drop-shadow-[0_0_8px_currentColor]`}
      >
        {value}
      </span>
    </div>
  );
}

function PacmanLifeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 drop-shadow-[0_0_5px_rgba(255,230,0,0.85)]"
      aria-hidden="true"
    >
      <path d="M12 12 L23 7.5 A11 11 0 1 0 23 16.5 Z" fill="#ffe600" />
    </svg>
  );
}

export function GameHUD({ score, highScore, level, lives }: GameHUDProps) {
  const visibleLives = Math.max(0, Math.min(lives, MAX_LIVES));

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-blue-500/20 bg-slate-950/50 px-4 py-3">
      <Stat label="Score" value={score.toLocaleString('en-US')} />
      <Stat
        label="High"
        value={highScore.toLocaleString('en-US')}
        valueClassName="text-cyan-300"
      />
      <Stat label="Level" value={String(level)} valueClassName="text-pink-300" />

      <div className="flex flex-col items-start">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-blue-300/70">
          Lives
        </span>
        <div className="flex h-[28px] items-center gap-1">
          {Array.from({ length: visibleLives }, (_, index) => (
            <PacmanLifeIcon key={index} />
          ))}
          {visibleLives === 0 && (
            <span className="font-mono text-sm text-red-400/80">—</span>
          )}
        </div>
      </div>
    </div>
  );
}
