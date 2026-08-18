'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { loginAction } from '@/server/auth/actions';

/**
 * Sign-in form. Native authentication verifies credentials against PostgreSQL
 * with Argon2id and sets a secure HttpOnly database-backed session cookie.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const result = await loginAction({ email, password });
        if (!result.success) {
          setError(result.error);
          return;
        }

        const destination = next && next.startsWith('/') ? next : result.redirectTo;
        router.replace(destination);
        router.refresh();
      } catch {
        setError('Sign-in is unavailable right now. Please try again shortly.');
      }
    });
  }

  function onResetPassword() {
    setError(null);
    setNotice('Password reset is managed by your institution administrator. Please contact your IT or admissions office to reset your credentials.');
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

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Signing in…' : 'Sign in'}
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
