'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BattleMode, BattleView } from '@/types/battle';

interface Props {
  onBattleStart: (
    battleId: string,
    mode: BattleMode,
    opponentName: string,
    opponentElo: number,
  ) => void;
  onClose: () => void;
}

type Phase = 'select' | 'searching' | 'found';

const MODE_LABELS: Record<BattleMode, string> = {
  1: '1 жизнь',
  2: '2 жизни',
  3: '3 жизни',
};

export function PvPModal({ onBattleStart, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('select');
  const [mode, setMode] = useState<BattleMode>(3);
  const [battleId, setBattleId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState('');
  const [opponentElo, setOpponentElo] = useState(1000);
  const [countdown, setCountdown] = useState(3);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const stopPoll = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(async () => {
    cancelledRef.current = true;
    stopPoll();
    if (battleId) {
      await fetch(`/api/battle/${battleId}`, { method: 'DELETE' }).catch(() => {});
    }
    onClose();
  }, [battleId, stopPoll, onClose]);

  const startSearch = useCallback(async () => {
    setError(null);
    setElapsed(0);
    cancelledRef.current = false;

    let res: Response;
    try {
      res = await fetch('/api/battle/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
    } catch {
      setError('Ошибка подключения. Попробуйте снова.');
      return;
    }

    if (!res.ok) {
      const d: unknown = await res.json().catch(() => ({}));
      const msg =
        typeof d === 'object' && d !== null && 'error' in d
          ? String((d as Record<string, unknown>)['error'])
          : 'Ошибка сервера';
      setError(msg);
      return;
    }

    const data: unknown = await res.json();
    if (typeof data !== 'object' || data === null) {
      setError('Ошибка сервера');
      return;
    }

    const rec = data as Record<string, unknown>;
    const bid = typeof rec['battleId'] === 'string' ? rec['battleId'] : null;
    if (!bid) { setError('Ошибка сервера'); return; }

    setBattleId(bid);

    if (rec['status'] === 'active') {
      // Joined an existing battle immediately
      const view = await fetch(`/api/battle/${bid}`).then((r) => r.json() as Promise<BattleView>);
      setOpponentName(view.opponent?.name ?? 'Противник');
      setOpponentElo(view.opponent?.elo ?? 1000);
      setPhase('found');
      return;
    }

    setPhase('searching');
  }, [mode]);

  // Poll while searching
  useEffect(() => {
    if (phase !== 'searching' || !battleId) return;

    const start = Date.now();

    pollRef.current = setInterval(async () => {
      if (cancelledRef.current) { stopPoll(); return; }

      const now = Date.now();
      const elapsedMs = now - start;
      setElapsed(Math.floor(elapsedMs / 1000));

      if (elapsedMs >= 60_000) {
        stopPoll();
        await fetch(`/api/battle/${battleId}`, { method: 'DELETE' }).catch(() => {});
        setError('Противник не найден. Попробуйте позже.');
        setPhase('select');
        setBattleId(null);
        return;
      }

      try {
        const view: BattleView = await fetch(`/api/battle/${battleId}`).then((r) => r.json());
        if (view.status === 'active' && view.opponent) {
          stopPoll();
          setOpponentName(view.opponent.name);
          setOpponentElo(view.opponent.elo);
          setPhase('found');
        }
      } catch {
        // ignore transient errors
      }
    }, 1500);

    return stopPoll;
  }, [phase, battleId, stopPoll]);

  // Countdown after opponent found
  useEffect(() => {
    if (phase !== 'found') return;

    let count = 3;
    setCountdown(count);

    const iv = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(iv);
        setCountdown(0);
        // Call outside the state updater — interval callbacks are safe side-effect sites
        if (battleId) onBattleStart(battleId, mode, opponentName, opponentElo);
      } else {
        setCountdown(count);
      }
    }, 1000);

    return () => clearInterval(iv);
  }, [phase, battleId, mode, opponentName, opponentElo, onBattleStart]);

  const progressPct = Math.min(100, (elapsed / 60) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-blue-500/30 bg-slate-900 p-6 shadow-[0_0_60px_rgba(59,130,246,0.25)]">
        <h2 className="mb-5 text-center font-mono text-lg font-extrabold uppercase tracking-[0.3em] text-cyan-300">
          ⚔ Битва
        </h2>

        {/* Mode selection */}
        {phase === 'select' && (
          <>
            <p className="mb-3 text-center font-mono text-xs uppercase tracking-widest text-slate-400">
              Выберите режим
            </p>

            {error && (
              <p className="mb-3 rounded-lg bg-red-500/10 p-2 text-center font-mono text-xs text-red-400">
                {error}
              </p>
            )}

            <div className="mb-5 flex gap-2">
              {([1, 2, 3] as BattleMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-xl border py-3 font-mono text-sm font-bold transition-all ${
                    mode === m
                      ? 'border-cyan-400/70 bg-cyan-400/15 text-cyan-200 shadow-[0_0_14px_rgba(103,232,249,0.3)]'
                      : 'border-slate-700/60 bg-slate-800/40 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>

            <button
              onClick={() => void startSearch()}
              className="mb-2 w-full rounded-xl border border-yellow-300/60 bg-slate-950 py-3 font-mono text-sm font-bold uppercase tracking-[0.2em] text-yellow-200 shadow-[0_0_16px_rgba(253,224,71,0.25)] transition-all hover:bg-yellow-300/10"
            >
              Найти противника
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-xl border border-slate-700/50 py-2 font-mono text-xs text-slate-500 transition-colors hover:text-slate-300"
            >
              Отмена
            </button>
          </>
        )}

        {/* Searching */}
        {phase === 'searching' && (
          <>
            <p className="mb-1 text-center font-mono text-sm text-slate-300">
              Поиск противника…
            </p>
            <p className="mb-4 text-center font-mono text-xs text-slate-500">
              Режим: {MODE_LABELS[mode]} · {elapsed}s / 60s
            </p>

            <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="mb-4 flex justify-center">
              <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            </div>

            <button
              onClick={() => void handleCancel()}
              className="w-full rounded-xl border border-slate-700/50 py-2 font-mono text-xs text-slate-500 transition-colors hover:text-slate-300"
            >
              Отменить
            </button>
          </>
        )}

        {/* Opponent found */}
        {phase === 'found' && (
          <>
            <p className="mb-1 text-center font-mono text-sm text-green-400">
              Противник найден!
            </p>
            <p className="mb-4 text-center font-mono text-xs text-slate-400">
              Режим: {MODE_LABELS[mode]}
            </p>

            <div className="mb-5 rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3 text-center">
              <p className="font-mono text-base font-bold text-slate-100">{opponentName}</p>
              <p className="font-mono text-xs text-cyan-400">ELO {opponentElo}</p>
            </div>

            <p className="text-center font-mono text-4xl font-extrabold text-yellow-300 drop-shadow-[0_0_16px_rgba(253,224,71,0.6)]">
              {countdown > 0 ? countdown : 'GO!'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
