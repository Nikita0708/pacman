'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password');
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 bg-[radial-gradient(circle_at_50%_-10%,rgba(59,130,246,0.15),transparent_60%)] px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center font-mono text-3xl font-extrabold uppercase tracking-[0.3em] text-yellow-300 drop-shadow-[0_0_18px_rgba(253,224,71,0.55)]">
          Pac-Man
        </h1>

        <div className="rounded-2xl border border-blue-500/25 bg-slate-950/60 p-6 shadow-[0_0_40px_rgba(59,130,246,0.18)] backdrop-blur-sm">
          <h2 className="mb-6 text-center font-mono text-base font-bold uppercase tracking-[0.3em] text-slate-200">
            Sign in
          </h2>

          <button
            onClick={() => void signIn('google', { callbackUrl: '/' })}
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-600/60 bg-slate-800/50 px-4 py-3 font-mono text-sm text-slate-200 transition-colors hover:bg-slate-700/50"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="relative my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-700/60" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
              or
            </span>
            <div className="h-px flex-1 bg-slate-700/60" />
          </div>

          <form onSubmit={(e) => void handleCredentials(e)} className="space-y-4">
            {error !== null && (
              <p className="rounded-lg bg-red-500/10 p-2 text-center font-mono text-xs text-red-400">
                {error}
              </p>
            )}

            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-700/60 bg-slate-900 px-4 py-3 font-mono text-sm text-slate-200 outline-none transition-colors focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-700/60 bg-slate-900 px-4 py-3 font-mono text-sm text-slate-200 outline-none transition-colors focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl border border-cyan-300/50 bg-slate-950 px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.2em] text-cyan-200 shadow-[0_0_16px_rgba(103,232,249,0.2)] transition-all hover:bg-cyan-300/10 disabled:opacity-40"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-center font-mono text-xs text-slate-500">
            No account?{' '}
            <Link href="/sign-up" className="text-yellow-400 hover:text-yellow-300">
              Sign up
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center">
          <Link href="/" className="font-mono text-xs text-slate-600 hover:text-slate-400">
            ← Back to game
          </Link>
        </p>
      </div>
    </main>
  );
}
