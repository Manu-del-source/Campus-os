'use client';

import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { changePasswordAction } from '@/server/auth/actions';

export function ChangePasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const formData = new FormData(event.currentTarget);
      const result = await changePasswordAction(formData);
      if (!result.ok) {
        setError(result.error ?? 'Unable to change password.');
        return;
      }
      setNotice(result.notice ?? 'Your password has been updated.');
      event.currentTarget.reset();
    } catch {
      setError('Unable to change password right now.');
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
        <label htmlFor="currentPassword" className="text-sm font-medium">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
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
          className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm" className="text-sm font-medium">
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}
