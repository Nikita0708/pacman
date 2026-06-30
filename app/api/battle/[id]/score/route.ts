import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/auth';
import clientPromise, { DB_NAME } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

const ELO_WIN = 25;
const ELO_LOSE = -25;

export async function POST(request: NextRequest, ctx: Ctx): Promise<NextResponse> {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const userId = session.user.id;

  let score: unknown;
  try {
    const body: unknown = await request.json();
    score =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)['score']
        : null;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const battle = await db
      .collection('battles')
      .findOne({ _id: new ObjectId(id) });

    if (!battle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (battle['status'] === 'complete' || battle['status'] === 'cancelled') {
      return NextResponse.json({ success: true });
    }

    const isP1 = battle['player1']?.['userId'] === userId;
    const isP2 = battle['player2']?.['userId'] === userId;
    if (!isP1 && !isP2) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    const pField = isP1 ? 'player1' : 'player2';

    // Atomically mark this player done (idempotent guard via done:false filter)
    const marked = await db.collection('battles').findOneAndUpdate(
      { _id: new ObjectId(id), [`${pField}.done`]: false, status: 'active' },
      {
        $set: {
          [`${pField}.finalScore`]: score,
          [`${pField}.liveScore`]: score,
          [`${pField}.done`]: true,
        },
      },
    );

    if (!marked) {
      // Already submitted — safe to ignore
      return NextResponse.json({ success: true });
    }

    // Try to atomically transition to 'complete' if both players are now done
    const completed = await db.collection('battles').findOneAndUpdate(
      {
        _id: new ObjectId(id),
        status: 'active',
        'player1.done': true,
        'player2.done': true,
      },
      { $set: { status: 'complete', endedAt: new Date() } },
      { returnDocument: 'after' },
    );

    if (!completed) {
      // Other player not done yet
      return NextResponse.json({ success: true, waiting: true });
    }

    // Determine winner
    const p1Score =
      typeof completed['player1']['finalScore'] === 'number'
        ? completed['player1']['finalScore']
        : 0;
    const p2Score =
      typeof completed['player2']['finalScore'] === 'number'
        ? completed['player2']['finalScore']
        : 0;
    const p1Id = completed['player1']['userId'] as string;
    const p2Id = completed['player2']['userId'] as string;

    let winnerId: string;
    let p1Elo: number;
    let p2Elo: number;

    if (p1Score > p2Score) {
      winnerId = p1Id;
      p1Elo = ELO_WIN;
      p2Elo = ELO_LOSE;
    } else if (p2Score > p1Score) {
      winnerId = p2Id;
      p1Elo = ELO_LOSE;
      p2Elo = ELO_WIN;
    } else {
      winnerId = 'draw';
      p1Elo = 0;
      p2Elo = 0;
    }

    await db.collection('battles').updateOne(
      { _id: new ObjectId(id) },
      { $set: { winnerId, p1EloChange: p1Elo, p2EloChange: p2Elo } },
    );

    // Update ELO (floor at 0, fetch-then-set is safe since only one caller reaches here)
    const applyElo = async (uid: string, delta: number) => {
      if (delta === 0) return;
      const u = await db.collection('users').findOne({ _id: new ObjectId(uid) });
      const cur = typeof u?.['elo'] === 'number' ? u['elo'] : 1000;
      await db
        .collection('users')
        .updateOne({ _id: new ObjectId(uid) }, { $set: { elo: Math.max(0, cur + delta) } });
    };

    await Promise.all([applyElo(p1Id, p1Elo), applyElo(p2Id, p2Elo)]);

    return NextResponse.json({ success: true, complete: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
