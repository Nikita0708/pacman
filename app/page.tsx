'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { GameCanvas } from '@/components/GameCanvas';
import { GameControls } from '@/components/GameControls';
import { GameHUD } from '@/components/GameHUD';
import { Leaderboard } from '@/components/Leaderboard';
import { AuthButton } from '@/components/AuthButton';
import { PvPModal } from '@/components/PvPModal';
import { BattleHUD } from '@/components/BattleHUD';
import type { BattleResult } from '@/components/BattleHUD';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameState } from '@/engine/types';
import type { BattleMode } from '@/types/battle';

// ── Battle state ───────────────────────────────────────────────────────────────

interface ActiveBattle {
  battleId: string;
  mode: BattleMode;
  opponentName: string;
  opponentElo: number;
}

type AppPhase =
  | 'normal'          // regular play, no PvP
  | 'pvp_modal'       // mode selection / matchmaking dialog
  | 'battle_active'   // battle in progress
  | 'battle_result';  // showing W/L/D result

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { canvasRef, snapshot, start, togglePause, restart } = useGameEngine();
  const { data: session } = useSession();

  const [phase, setPhase] = useState<AppPhase>('normal');
  const [activeBattle, setActiveBattle] = useState<ActiveBattle | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [leaderboardVersion, setLeaderboardVersion] = useState(0);

  const scoreRef = useRef(0);
  const battleSubmittedRef = useRef(false);
  const regularSubmittedRef = useRef(false);

  // Keep scoreRef in sync without adding snapshot to heavy deps
  useEffect(() => {
    scoreRef.current = snapshot.score;
  }, [snapshot.score]);

  // ── Regular leaderboard submission ──────────────────────────────────────────
  useEffect(() => {
    if (snapshot.state === GameState.PLAYING) {
      regularSubmittedRef.current = false;
    }
    const ended =
      snapshot.state === GameState.WIN || snapshot.state === GameState.GAME_OVER;
    if (ended && !regularSubmittedRef.current && session?.user && snapshot.score > 0 && phase === 'normal') {
      regularSubmittedRef.current = true;
      fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: snapshot.score }),
      })
        .then(() => setLeaderboardVersion((v) => v + 1))
        .catch(() => {});
    }
  }, [snapshot.state, snapshot.score, session, phase]);

  // ── Battle final score submission ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'battle_active' || !activeBattle) return;
    const ended =
      snapshot.state === GameState.WIN || snapshot.state === GameState.GAME_OVER;
    if (!ended || battleSubmittedRef.current) return;
    battleSubmittedRef.current = true;
    fetch(`/api/battle/${activeBattle.battleId}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: snapshot.score }),
    }).catch(() => {});
  }, [snapshot.state, phase, activeBattle]);

  // ── Live score push every 3s during battle ──────────────────────────────────
  useEffect(() => {
    if (phase !== 'battle_active' || !activeBattle) return;
    const iv = setInterval(() => {
      fetch(`/api/battle/${activeBattle.battleId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: scoreRef.current }),
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(iv);
  }, [phase, activeBattle]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleBattleStart = (
    battleId: string,
    mode: BattleMode,
    opponentName: string,
    opponentElo: number,
  ) => {
    battleSubmittedRef.current = false;
    setActiveBattle({ battleId, mode, opponentName, opponentElo });
    setPhase('battle_active');
    start(mode);
  };

  const handleBattleComplete = (result: BattleResult) => {
    setBattleResult(result);
    setPhase('battle_result');
    setLeaderboardVersion((v) => v + 1);
  };

  const closeBattleResult = () => {
    setActiveBattle(null);
    setBattleResult(null);
    setPhase('normal');
  };

  const gameDone =
    snapshot.state === GameState.WIN || snapshot.state === GameState.GAME_OVER;

  const myName = session?.user?.name ?? 'Ты';
  // ELO from session is not available directly; pass 0 to BattleHUD — it's cosmetic only
  const myElo = 0;

  return (
    <main className="min-h-screen bg-slate-900 bg-[radial-gradient(circle_at_50%_-10%,rgba(59,130,246,0.18),transparent_60%)] px-4 py-6">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5">

        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-3xl font-extrabold uppercase tracking-[0.35em] text-yellow-300 drop-shadow-[0_0_18px_rgba(253,224,71,0.55)] sm:text-4xl">
              Pac-Man
            </h1>
            <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-blue-300/60">
              Neon Retro Edition
            </p>
          </div>

          <div className="flex items-center gap-3">
            {session?.user && phase === 'normal' && (
              <button
                onClick={() => setPhase('pvp_modal')}
                className="rounded-xl border border-red-400/50 bg-slate-950/60 px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.15em] text-red-300 shadow-[0_0_12px_rgba(248,113,113,0.2)] transition-all hover:bg-red-400/10"
              >
                ⚔ Битва
              </button>
            )}
            <AuthButton />
          </div>
        </header>

        {/* Content */}
        <div className="flex flex-col items-start gap-5 lg:flex-row lg:justify-center">

          {/* Game panel */}
          <section className="mx-auto flex w-full max-w-[640px] flex-col gap-4 rounded-2xl border border-blue-500/25 bg-slate-950/40 p-4 shadow-[0_0_40px_rgba(59,130,246,0.18)] backdrop-blur-sm sm:p-6 lg:mx-0">

            {/* Battle HUD (replaces regular header when in battle) */}
            {phase === 'battle_active' && activeBattle ? (
              <BattleHUD
                battleId={activeBattle.battleId}
                mode={activeBattle.mode}
                myScore={snapshot.score}
                myName={myName}
                myElo={myElo}
                opponentName={activeBattle.opponentName}
                opponentElo={activeBattle.opponentElo}
                gameDone={gameDone}
                onBattleComplete={handleBattleComplete}
              />
            ) : (
              <GameHUD
                score={snapshot.score}
                highScore={snapshot.highScore}
                level={snapshot.level}
                lives={snapshot.lives}
              />
            )}

            <GameCanvas canvasRef={canvasRef} state={snapshot.state} />

            <GameControls
              state={snapshot.state}
              onStart={start}
              onTogglePause={togglePause}
              onRestart={restart}
            />
            <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">
              Move: Arrows / WASD · Pause: P / Esc
            </p>
          </section>

          {/* Leaderboard panel */}
          <aside className="w-full lg:w-[280px] lg:shrink-0 lg:pt-1">
            <Leaderboard
              version={leaderboardVersion}
              currentUserId={session?.user?.id ?? null}
            />
          </aside>
        </div>
      </div>

      {/* PvP matchmaking modal */}
      {phase === 'pvp_modal' && (
        <PvPModal
          onBattleStart={handleBattleStart}
          onClose={() => setPhase('normal')}
        />
      )}

      {/* Battle result modal */}
      {phase === 'battle_result' && battleResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-blue-500/30 bg-slate-900 p-6 shadow-[0_0_60px_rgba(59,130,246,0.3)]">
            <h2 className="mb-2 text-center font-mono text-2xl font-extrabold uppercase tracking-[0.3em]">
              {battleResult.won === null ? (
                <span className="text-slate-300">Ничья</span>
              ) : battleResult.won ? (
                <span className="text-green-300 drop-shadow-[0_0_16px_rgba(134,239,172,0.6)]">
                  Победа!
                </span>
              ) : (
                <span className="text-red-400">Поражение</span>
              )}
            </h2>

            <p className="mb-5 text-center font-mono text-xs uppercase tracking-widest text-slate-500">
              ⚔ Результат битвы
            </p>

            <div className="mb-5 space-y-2">
              <div className="flex justify-between rounded-xl bg-slate-800/60 px-4 py-2">
                <span className="font-mono text-xs text-slate-400">Твои очки</span>
                <span className="font-mono text-sm font-bold text-cyan-300">
                  {battleResult.myScore.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between rounded-xl bg-slate-800/60 px-4 py-2">
                <span className="font-mono text-xs text-slate-400">
                  {battleResult.opponentName}
                </span>
                <span className="font-mono text-sm font-bold text-slate-300">
                  {battleResult.opponentScore.toLocaleString()}
                </span>
              </div>
            </div>

            <div
              className={`mb-5 flex items-center justify-center gap-2 rounded-xl border py-3 ${
                battleResult.eloChange > 0
                  ? 'border-green-400/30 bg-green-400/8 text-green-300'
                  : battleResult.eloChange < 0
                    ? 'border-red-400/30 bg-red-400/8 text-red-400'
                    : 'border-slate-700/50 text-slate-400'
              }`}
            >
              <span className="font-mono text-sm">ELO</span>
              <span className="font-mono text-xl font-extrabold">
                {battleResult.eloChange > 0
                  ? `+${battleResult.eloChange}`
                  : battleResult.eloChange === 0
                    ? '±0'
                    : battleResult.eloChange}
              </span>
            </div>

            <button
              onClick={closeBattleResult}
              className="w-full rounded-xl border border-cyan-300/50 bg-slate-950 py-3 font-mono text-sm font-bold uppercase tracking-[0.2em] text-cyan-200 shadow-[0_0_16px_rgba(103,232,249,0.2)] transition-all hover:bg-cyan-300/10"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
