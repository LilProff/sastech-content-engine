'use client';

import { useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { setAuthToken } from '@/lib/supabaseClient';

export function LoginGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const reduceMotion = useReducedMotion();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (res.ok && data.token) {
        setAuthToken(data.token);
        onUnlocked();
        return;
      }

      setError(data.error || 'Wrong password.');
      setPassword('');
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`w-full max-w-sm rounded-2xl border border-border bg-surface p-8 ${shaking ? 'animate-shake' : ''}`}
      >
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-accent font-semibold text-accent-foreground">
          C
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Career OS</h1>
        <p className="mb-6 mt-1 text-sm leading-relaxed text-muted">
          Enter your password to continue.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label
              htmlFor="password"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
              placeholder="••••••••"
            />
          </div>

          <motion.button
            type="submit"
            disabled={loading || !password}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            className="flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity disabled:opacity-40"
          >
            {loading ? 'Checking…' : 'Unlock'}
          </motion.button>

          <p
            role="alert"
            aria-live="polite"
            className={`mt-3 text-xs leading-relaxed text-danger ${error ? '' : 'invisible'}`}
          >
            {error || ' '}
          </p>
        </form>
      </motion.div>
    </div>
  );
}
