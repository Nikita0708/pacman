'use client';

import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="h-9 w-24 animate-pulse rounded-xl bg-slate-700/50" />
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name ?? ''}
            width={32}
            height={32}
            className="rounded-full ring-2 ring-cyan-500/40"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 font-mono text-xs font-bold text-cyan-300 ring-2 ring-cyan-500/40">
            {(session.user.name ?? '?')[0]?.toUpperCase()}
          </div>
        )}
        <span className="hidden font-mono text-xs text-slate-300 sm:block">
          {session.user.name}
        </span>
        <button
          onClick={() => void signOut({ callbackUrl: '/' })}
          className="rounded-xl border border-slate-600/60 bg-slate-800/60 px-4 py-2 font-mono text-xs text-slate-400 transition-colors hover:text-slate-200"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/sign-in"
      className="rounded-xl border border-cyan-300/50 bg-slate-950/60 px-5 py-2 font-mono text-sm font-bold uppercase tracking-[0.15em] text-cyan-200 shadow-[0_0_16px_rgba(103,232,249,0.25)] transition-all hover:bg-cyan-300/10"
    >
      Sign in
    </Link>
  );
}
