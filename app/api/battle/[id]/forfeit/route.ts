import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/auth';
import clientPromise, { DB_NAME } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

const ELO_WIN = 25;
const ELO_LOSE = -25;

/**
 * Forfeit an active battle. Called when a player abandons mid-game (e.g. reloads
 * the page). The forfeiter loses regardless of score, but their last known
 * live score is locked in as the final score so progress isn't lost.
 *
 * The whole resolution happens in a single atomic findOneAndUpdate guarded by
 * `status: 'active'` + `done: false`, so it can't double-apply ELO and can't
 * forfeit a player who already legitimately finished.
 */
export async function POST(_request: NextRequest, ctx: Ctx): Promise<NextResponse> {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const userId = session.user.id;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const battle = await db.collection('battles').findOne({ _id: new ObjectId(id) });
    if (!battle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Nothing to forfeit unless the battle is live.
    if (battle['status'] !== 'active') {
      return NextResponse.json({ success: true });
    }

    const isP1 = battle['player1']?.['userId'] === userId;
    const isP2 = battle['player2']?.['userId'] === userId;
    if (!isP1 && !isP2) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    const pField = isP1 ? 'player1' : 'player2';
    const oppField = isP1 ? 'player2' : 'player1';
    const myEloField = isP1 ? 'p1EloChange' : 'p2EloChange';
    const oppEloField = isP1 ? 'p2EloChange' : 'p1EloChange';

    // A player who already submitted can't forfeit — they finished legitimately.
    if (battle[pField]?.['done'] === true) {
      return NextResponse.json({ success: true });
    }

    const myId = battle[pField]?.['userId'] as string;
    const oppId = battle[oppField]?.['userId'] as string;
    const lockedScore =
      typeof battle[pField]?.['liveScore'] === 'number' ? battle[pField]['liveScore'] : 0;
    const oppFinal =
      typeof battle[oppField]?.['finalScore'] === 'number'
        ? battle[oppField]['finalScore']
        : typeof battle[oppField]?.['liveScore'] === 'number'
          ? battle[oppField]['liveScore']
          : 0;

    // Single atomic resolution: lock in score, mark forfeited, complete as a loss.
    const completed = await db.collection('battles').findOneAndUpdate(
      { _id: new ObjectId(id), status: 'active', [`${pField}.done`]: false },
      {
        $set: {
          [`${pField}.finalScore`]: lockedScore,
          [`${pField}.liveScore`]: lockedScore,
          [`${pField}.done`]: true,
          [`${pField}.forfeited`]: true,
          [`${oppField}.finalScore`]: oppFinal,
          status: 'complete',
          endedAt: new Date(),
          winnerId: oppId,
          [myEloField]: ELO_LOSE,
          [oppEloField]: ELO_WIN,
        },
      },
      { returnDocument: 'after' },
    );

    if (!completed) {
      // Lost the race (already resolved by the other player) — leave as-is.
      return NextResponse.json({ success: true });
    }

    // Apply ELO (floor at 0). Only one caller reaches here, so fetch-then-set is safe.
    const applyElo = async (uid: string, delta: number) => {
      const u = await db.collection('users').findOne({ _id: new ObjectId(uid) });
      const cur = typeof u?.['elo'] === 'number' ? u['elo'] : 1000;
      await db
        .collection('users')
        .updateOne({ _id: new ObjectId(uid) }, { $set: { elo: Math.max(0, cur + delta) } });
    };

    await Promise.all([applyElo(myId, ELO_LOSE), applyElo(oppId, ELO_WIN)]);

    return NextResponse.json({ success: true, complete: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
