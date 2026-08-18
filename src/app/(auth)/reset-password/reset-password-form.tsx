'use client';

import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { resetPasswordAction } from '@/server/auth/actions';

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tokenValue, setTokenValue] = useState(token);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const formData = new FormData();
      formData.set('token', tokenValue);
      formData.set('password', password);
      formData.set('confirm', confirm);
      const result = await resetPasswordAction(formData);
      if (!result.ok) {
        setError(result.error ?? 'Unable to reset the password.');
        return;
      }
      setNotice(result.notice ?? 'Your password has been updated.');
    } catch {
      setError('Unable to reset the password right now.');
    } finally {
      setPending(false);
    }
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
        <label htmlFor="token" className="text-sm font-medium">
          Reset token
        </label>
        <input
          id="token"
          name="token"
          type="text"
          required
          value={tokenValue}
          onChange={(event) => setTokenValue(event.target.value)}
          className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirm" className="text-sm font-medium">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}
