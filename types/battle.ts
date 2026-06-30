export type BattleMode = 1 | 2 | 3;

export interface BattlePlayerView {
  userId: string;
  name: string;
  elo: number;
  liveScore: number;
  finalScore: number | null;
  done: boolean;
}

export interface BattleView {
  battleId: string;
  status: 'waiting' | 'active' | 'complete' | 'cancelled';
  mode: BattleMode;
  me: BattlePlayerView;
  opponent: BattlePlayerView | null;
  winnerId: string | null;
  myEloChange: number;
  startedAt: string | null;
}

export interface EloLeaderboardEntry {
  _id: string;
  name: string | null;
  image: string | null;
  elo: number;
}
