import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';

import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

/** Session-dependent: never prerendered or cached. */
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const context = await getCurrentUser();
  if (context) {
    redirect(context.isPlatformAdmin ? '/platform' : '/dashboard');
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-4 py-12">
      <div className="space-y-2">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-[var(--radius-base)] bg-[var(--color-accent)] text-sm font-bold text-[var(--color-accent-foreground)]">
            CO
          </span>
          CampusOS
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to your institution</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Use the credentials issued by your institution administrator.
        </p>
      </div>

      <div className="rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <LoginForm />
      </div>

      <p className="text-sm text-[var(--color-muted-foreground)]">
        Applying for a place?{' '}
        <Link href="/apply" className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
          Start an application
        </Link>
      </p>
    </div>
  );
}
