import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import clientPromise, { DB_NAME } from '@/lib/db';

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const rec = body as Record<string, unknown>;
  const name = typeof rec['name'] === 'string' ? rec['name'].trim() : '';
  const email =
    typeof rec['email'] === 'string' ? rec['email'].toLowerCase().trim() : '';
  const password = typeof rec['password'] === 'string' ? rec['password'] : '';

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!email.includes('@')) {
    return NextResponse.json(
      { error: 'Valid email is required' },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters' },
      { status: 400 },
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.collection('users').insertOne({
      name,
      email,
      password: hashedPassword,
      emailVerified: null,
      image: null,
      highScore: 0,
      elo: 1000,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
