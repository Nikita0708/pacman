import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import bcrypt from 'bcryptjs';
import clientPromise, { DB_NAME } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise, { databaseName: DB_NAME }),
  session: { strategy: 'jwt' },
  pages: { signIn: '/sign-in' },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        const email =
          typeof credentials.email === 'string' ? credentials.email : null;
        const password =
          typeof credentials.password === 'string'
            ? credentials.password
            : null;
        if (!email || !password) return null;

        const client = await clientPromise;
        const db = client.db(DB_NAME);
        const user = await db.collection('users').findOne({ email });
        if (!user || typeof user['password'] !== 'string') return null;

        const valid = await bcrypt.compare(password, user['password'] as string);
        if (!valid) return null;

        return {
          id: String(user['_id']),
          name: typeof user['name'] === 'string' ? user['name'] : null,
          email: typeof user['email'] === 'string' ? user['email'] : null,
          image: typeof user['image'] === 'string' ? user['image'] : null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token['id'] = user.id;
      return token;
    },
    session({ session, token }) {
      if (typeof token['id'] === 'string') {
        session.user.id = token['id'];
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Initialise highScore for OAuth users created by the adapter.
      if (!user.email) return;
      const client = await clientPromise;
      const db = client.db(DB_NAME);
      await db
        .collection('users')
        .updateOne(
          { email: user.email, highScore: { $exists: false } },
          { $set: { highScore: 0, elo: 1000 } },
        );
    },
  },
});
