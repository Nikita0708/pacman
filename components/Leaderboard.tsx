'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { LeaderboardEntry } from '@/app/api/leaderboard/route';
import type { EloLeaderboardEntry } from '@/types/battle';

interface Props {
  version: number;
  currentUserId: string | null;
}

type Tab = 'score' | 'elo';

const RANK_COLORS = ['text-yellow-300', 'text-slate-300', 'text-amber-600'] as const;

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? ''}
        width={22}
        height={22}
        className="rounded-full"
      />
    );
  }
  return (
    <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-slate-700 font-mono text-[10px] text-slate-400">
      {(name ?? '?')[0]?.toUpperCase()}
    </div>
  );
}

export function Leaderboard({ version, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>('score');
  const [scoreEntries, setScoreEntries] = useState<LeaderboardEntry[]>([]);
  const [eloEntries, setEloEntries] = useState<EloLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = tab === 'score' ? '/api/leaderboard' : '/api/elo-leaderboard';
    fetch(url)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        if (tab === 'score') setScoreEntries(data as LeaderboardEntry[]);
        else setEloEntries(data as EloLeaderboardEntry[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab, version]);

  const entries =
    tab === 'score'
      ? scoreEntries.map((e) => ({ ...e, value: e.highScore }))
      : eloEntries.map((e) => ({ ...e, value: e.elo }));

  return (
    <div className="rounded-2xl border border-blue-500/25 bg-slate-950/40 p-4 shadow-[0_0_30px_rgba(59,130,246,0.12)] backdrop-blur-sm">
      {/* Tabs */}
      <div className="mb-4 flex rounded-xl bg-slate-900/60 p-1">
        {(['score', 'elo'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-1.5 font-mono text-xs font-bold uppercase tracking-widest transition-all ${
              tab === t
                ? 'bg-slate-700/80 text-cyan-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'score' ? '🏅 Очки' : '⚔ ELO'}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-xl bg-slate-800/60" />
          ))}
        </div>
      )}

      {!loading && entries.length === 0 && (
        <p className="py-6 text-center font-mono text-xs text-slate-500">
          {tab === 'score' ? 'Нет очков — будь первым!' : 'Никто ещё не сыграл PvP'}
        </p>
      )}

      {!loading && entries.length > 0 && (
        <ol className="space-y-2">
          {entries.map((entry, i) => {
            const isMe = entry._id === currentUserId;
            const rankColor =
              i < RANK_COLORS.length ? RANK_COLORS[i] : 'text-slate-500';
            return (
              <li
                key={entry._id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                  isMe
                    ? 'border border-yellow-300/30 bg-yellow-300/[0.06]'
                    : 'bg-slate-900/40'
                }`}
              >
                <span className={`w-6 text-center font-mono text-xs font-bold ${rankColor}`}>
                  #{i + 1}
                </span>
                <Avatar name={entry.name} image={entry.image} />
                <span className="flex-1 truncate font-mono text-sm text-slate-200">
                  {entry.name ?? 'Anonymous'}
                  {isMe && (
                    <span className="ml-1 text-[10px] text-yellow-400">(ты)</span>
                  )}
                </span>
                <span className="font-mono text-sm font-bold text-cyan-300">
                  {entry.value.toLocaleString()}
                  {tab === 'elo' && (
                    <span className="ml-1 font-mono text-[10px] text-slate-500">ELO</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {!currentUserId && (
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-slate-600">
          Войди, чтобы сохранять результаты
        </p>
      )}
    </div>
  );
}
