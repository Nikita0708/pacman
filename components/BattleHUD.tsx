'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BattleMode, BattleView } from '@/types/battle';

export interface BattleResult {
  won: boolean | null;
  myScore: number;
  opponentScore: number;
  opponentName: string;
  eloChange: number;
}

interface Props {
  battleId: string;
  mode: BattleMode;
  myScore: number;
  myName: string;
  myElo: number;
  opponentName: string;
  opponentElo: number;
  gameDone: boolean;
  onBattleComplete: (result: BattleResult) => void;
}

const MODE_LABEL: Record<BattleMode, string> = { 1: '1 жизнь', 2: '2 жизни', 3: '3 жизни' };

export function BattleHUD({
  battleId,
  mode,
  myScore,
  myName,
  myElo,
  opponentName,
  opponentElo,
  gameDone,
  onBattleComplete,
}: Props) {
  const [oppScore, setOppScore] = useState(0);
  const [oppDone, setOppDone] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const completedRef = useRef(false);

  const handleView = useCallback(
    (view: BattleView) => {
      if (view.opponent) {
        setOppScore(view.opponent.liveScore);
        setOppDone(view.opponent.done);
      }

      if (view.status === 'complete' && !completedRef.current) {
        completedRef.current = true;
        const me = view.me;
        const opp = view.opponent;
        const myFinal = me.finalScore ?? myScore;
        const oppFinal = opp?.finalScore ?? 0;
        const won =
          view.winnerId === 'draw'
            ? null
            : view.winnerId === me.userId;
        onBattleComplete({
          won,
          myScore: myFinal,
          opponentScore: oppFinal,
          opponentName: opp?.name ?? opponentName,
          eloChange: view.myEloChange,
        });
      }
    },
    [myScore, opponentName, onBattleComplete],
  );

  useEffect(() => {
    if (completedRef.current) return;
    const iv = setInterval(async () => {
      try {
        const view: BattleView = await fetch(`/api/battle/${battleId}`).then((r) => r.json());
        handleView(view);
      } catch {
        // ignore transient errors
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [battleId, handleView]);

  useEffect(() => {
    if (gameDone) setWaiting(true);
  }, [gameDone]);

  const leading = myScore > oppScore;
  const tied = myScore === oppScore;

  return (
    <>
      {/* Top banner */}
      <div className="mb-3 rounded-xl border border-blue-500/25 bg-slate-950/70 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          {/* Me */}
          <div className="flex flex-col items-start">
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Ты
            </span>
            <span className="font-mono text-xs text-slate-300">{myName}</span>
            <span className="font-mono text-[10px] text-cyan-500">ELO {myElo}</span>
          </div>

          {/* Scores */}
          <div className="flex items-center gap-3">
            <span
              className={`font-mono text-xl font-extrabold ${
                leading ? 'text-green-300' : tied ? 'text-slate-300' : 'text-slate-400'
              }`}
            >
              {myScore.toLocaleString()}
            </span>
            <span className="font-mono text-xs text-slate-600">vs</span>
            <span
              className={`font-mono text-xl font-extrabold ${
                !leading && !tied ? 'text-red-400' : 'text-slate-400'
              }`}
            >
              {oppScore.toLocaleString()}
            </span>
          </div>

          {/* Opponent */}
          <div className="flex flex-col items-end">
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
              {oppDone ? '✓ done' : 'играет'}
            </span>
            <span className="font-mono text-xs text-slate-300">{opponentName}</span>
            <span className="font-mono text-[10px] text-cyan-500">ELO {opponentElo}</span>
          </div>
        </div>

        <div className="mt-1 text-center font-mono text-[10px] uppercase tracking-widest text-slate-600">
          Режим: {MODE_LABEL[mode]}
        </div>
      </div>

      {/* Waiting overlay */}
      {waiting && (
        <div className="mb-3 rounded-xl border border-yellow-400/30 bg-yellow-400/8 px-4 py-3 text-center">
          <span className="font-mono text-xs text-yellow-300">
            Ждём результат противника…
          </span>
        </div>
      )}
    </>
  );
}
