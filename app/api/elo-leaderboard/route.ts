import { NextResponse } from 'next/server';
import clientPromise, { DB_NAME } from '@/lib/db';
import type { EloLeaderboardEntry } from '@/types/battle';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const docs = await db
      .collection('users')
      .find(
        { elo: { $exists: true } },
        { projection: { _id: 1, name: 1, image: 1, elo: 1 } },
      )
      .sort({ elo: -1 })
      .limit(10)
      .toArray();

    const entries: EloLeaderboardEntry[] = docs.map((d) => ({
      _id: String(d['_id']),
      name: typeof d['name'] === 'string' ? d['name'] : null,
      image: typeof d['image'] === 'string' ? d['image'] : null,
      elo: typeof d['elo'] === 'number' ? d['elo'] : 1000,
    }));

    return NextResponse.json(entries);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
