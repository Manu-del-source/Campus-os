import type { Metadata } from 'next';
import Link from 'next/link';

import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = { title: 'Reset password' };

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-4 py-12">
      <div className="space-y-2">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-[var(--radius-base)] bg-[var(--color-accent)] text-sm font-bold text-[var(--color-accent-foreground)]">
            CO
          </span>
          CampusOS
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Use the reset token from your email. Institution accounts are issued by administrators —
          there is no public self-registration.
        </p>
      </div>

      <div className="rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <ResetPasswordForm token={token ?? ''} />
      </div>
    </div>
  );
}
