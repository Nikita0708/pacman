import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import clientPromise, { DB_NAME } from '@/lib/db';

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let score: unknown;
  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || !('score' in body)) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    score = (body as { score: unknown })['score'];
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // $max updates highScore only when the new value is greater.
    await db
      .collection('users')
      .updateOne(
        { email: session.user.email },
        { $max: { highScore: score } },
      );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
