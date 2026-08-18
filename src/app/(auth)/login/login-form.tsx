'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { isSupabaseConfigured } from '@/lib/env';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Sign-in form. Supabase performs the credential check and issues the session
 * cookies; the application then resolves roles, permissions and the active
 * institution on the server.
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError('Those credentials did not match an active account.');
        return;
      }
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Sign-in is unavailable right now. Please try again shortly.');
    } finally {
      setPending(false);
    }
  }

  async function onResetPassword() {
    setError(null);
    setNotice(null);
    if (!email) {
      setError('Enter your email address first, then request a reset link.');
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setNotice('If that address has an account, a reset link is on its way.');
    } catch {
      setError('Password reset is unavailable right now.');
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div
        role="status"
        className="rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm"
      >
        <p className="font-medium">Authentication is not configured on this deployment.</p>
        <p className="mt-1 text-[var(--color-muted-foreground)]">
          Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to
          enable sign-in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-[var(--radius-base)] bg-[var(--color-surface-muted)] p-3 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-[var(--radius-base)] bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-accent)]">
          {notice}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>

      <button
        type="button"
        onClick={onResetPassword}
        className="text-sm text-[var(--color-muted-foreground)] underline-offset-4 hover:underline"
      >
        Forgot your password?
      </button>
    </form>
  );
}
