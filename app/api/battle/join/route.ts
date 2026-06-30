import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import clientPromise, { DB_NAME } from '@/lib/db';
import type { BattleMode } from '@/types/battle';

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let mode: unknown;
  try {
    const body: unknown = await request.json();
    mode =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)['mode']
        : null;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (mode !== 1 && mode !== 2 && mode !== 3) {
    return NextResponse.json({ error: 'Invalid mode (must be 1, 2, or 3)' }, { status: 400 });
  }

  const battleMode = mode as BattleMode;
  const userId = session.user.id;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const userDoc = await db.collection('users').findOne({ email: session.user.email });
    const userName =
      typeof userDoc?.['name'] === 'string'
        ? userDoc['name']
        : (session.user.name ?? 'Anonymous');
    const userElo = typeof userDoc?.['elo'] === 'number' ? userDoc['elo'] : 1000;

    const player = { userId, userName, userElo, liveScore: 0, finalScore: null, done: false };

    // Look for an open battle with the same mode (not our own, not expired)
    const cutoff = new Date(Date.now() - 60_000);
    const existing = await db.collection('battles').findOne({
      mode: battleMode,
      status: 'waiting',
      createdAt: { $gt: cutoff },
      'player1.userId': { $ne: userId },
    });

    if (existing) {
      await db.collection('battles').updateOne(
        { _id: existing['_id'] },
        { $set: { player2: player, status: 'active', startedAt: new Date() } },
      );
      return NextResponse.json({
        battleId: String(existing['_id']),
        status: 'active',
        role: 'player2',
      });
    }

    // Create a new waiting battle
    const result = await db.collection('battles').insertOne({
      mode: battleMode,
      status: 'waiting',
      player1: player,
      player2: null,
      winnerId: null,
      p1EloChange: 0,
      p2EloChange: 0,
      createdAt: new Date(),
      startedAt: null,
      endedAt: null,
    });

    return NextResponse.json({
      battleId: String(result.insertedId),
      status: 'waiting',
      role: 'player1',
    });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
