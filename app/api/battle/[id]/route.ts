import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/auth';
import clientPromise, { DB_NAME } from '@/lib/db';
import type { BattleView } from '@/types/battle';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const battle = await db.collection('battles').findOne({ _id: new ObjectId(id) });

    if (!battle) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const userId = session.user.id;
    const isP1 = battle['player1']?.['userId'] === userId;
    const isP2 = battle['player2']?.['userId'] === userId;

    if (!isP1 && !isP2) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    const me = isP1 ? battle['player1'] : battle['player2'];
    const opp = isP1 ? battle['player2'] : battle['player1'];
    const myEloChange = isP1
      ? (typeof battle['p1EloChange'] === 'number' ? battle['p1EloChange'] : 0)
      : (typeof battle['p2EloChange'] === 'number' ? battle['p2EloChange'] : 0);

    const view: BattleView = {
      battleId: id,
      status: battle['status'] as BattleView['status'],
      mode: battle['mode'] as BattleView['mode'],
      me: {
        userId: me?.['userId'] ?? userId,
        name: me?.['userName'] ?? 'Me',
        elo: me?.['userElo'] ?? 1000,
        liveScore: me?.['liveScore'] ?? 0,
        finalScore: me?.['finalScore'] ?? null,
        done: me?.['done'] ?? false,
      },
      opponent: opp
        ? {
            userId: opp['userId'] ?? '',
            name: opp['userName'] ?? 'Opponent',
            elo: opp['userElo'] ?? 1000,
            liveScore: opp['liveScore'] ?? 0,
            finalScore: opp['finalScore'] ?? null,
            done: opp['done'] ?? false,
          }
        : null,
      winnerId: typeof battle['winnerId'] === 'string' ? battle['winnerId'] : null,
      myEloChange,
      startedAt:
        battle['startedAt'] instanceof Date
          ? battle['startedAt'].toISOString()
          : null,
    };

    return NextResponse.json(view);
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    await db.collection('battles').updateOne(
      { _id: new ObjectId(id), 'player1.userId': session.user.id, status: 'waiting' },
      { $set: { status: 'cancelled' } },
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
