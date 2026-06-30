import { NextResponse } from 'next/server';
import clientPromise, { DB_NAME } from '@/lib/db';

export const dynamic = 'force-dynamic';

export interface LeaderboardEntry {
  _id: string;
  name: string | null;
  image: string | null;
  highScore: number;
}

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
        { highScore: { $gt: 0 } },
        { projection: { _id: 1, name: 1, image: 1, highScore: 1 } },
      )
      .sort({ highScore: -1 })
      .limit(10)
      .toArray();

    const entries: LeaderboardEntry[] = docs.map((d) => ({
      _id: String(d['_id']),
      name: typeof d['name'] === 'string' ? d['name'] : null,
      image: typeof d['image'] === 'string' ? d['image'] : null,
      highScore: typeof d['highScore'] === 'number' ? d['highScore'] : 0,
    }));

    return NextResponse.json(entries);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
