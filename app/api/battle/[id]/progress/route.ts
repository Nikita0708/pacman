import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { auth } from '@/auth';
import clientPromise, { DB_NAME } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, ctx: Ctx): Promise<NextResponse> {
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
      .findOne(
        { _id: new ObjectId(id) },
        { projection: { 'player1.userId': 1, 'player2.userId': 1 } },
      );

    if (!battle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const field =
      battle['player1']?.['userId'] === userId
        ? 'player1.liveScore'
        : battle['player2']?.['userId'] === userId
          ? 'player2.liveScore'
          : null;

    if (!field) return NextResponse.json({ error: 'Not a participant' }, { status: 403 });

    await db
      .collection('battles')
      .updateOne({ _id: new ObjectId(id) }, { $set: { [field]: score } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
