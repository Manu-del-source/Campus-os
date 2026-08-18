'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { recordAudit } from '@/lib/audit';
import {
  AUTH_GENERIC_FAILURE,
  AuthenticationFailedError,
  authenticateWithPassword,
  consumePasswordResetToken,
  createSession,
  findLoginUser,
  issuePasswordResetToken,
  revokeAllSessions,
  revokeSessionByToken,
  setUserPassword,
} from '@/lib/auth/credentials';
import { clearSessionCookie, readSessionToken, writeSessionCookie } from '@/lib/auth/cookies';
import { consumeRateLimit } from '@/lib/auth/rate-limit';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

const LOGIN_LIMIT = 8;
const RESET_LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

export interface AuthActionResult {
  ok: boolean;
  error?: string;
  notice?: string;
}

async function clientKey(prefix: string, extra: string): Promise<string> {
  try {
    const list = await headers();
    const ip = list.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    return `${prefix}:${ip}:${extra.toLowerCase()}`;
  } catch {
    return `${prefix}:local:${extra.toLowerCase()}`;
  }
}

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const institutionSlug = String(formData.get('institutionSlug') ?? '').trim() || null;

  if (!email || !password) {
    return { ok: false, error: AUTH_GENERIC_FAILURE };
  }

  const limit = consumeRateLimit(await clientKey('login', email), LOGIN_LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return { ok: false, error: 'Too many sign-in attempts. Please wait and try again.' };
  }

  try {
    const user = await authenticateWithPassword(email, password, institutionSlug);
    const { token } = await createSession(user.id);
    await writeSessionCookie(token);

    await recordAudit(
      {
        userId: user.id,
        email: user.email,
        firstName: '',
        lastName: '',
        isPlatformAdmin: user.isPlatformAdmin,
        institutionId: user.institutionId,
        institution: null,
        roleKeys: [],
        permissions: new Set(),
      },
      {
        action: 'auth.login',
        entityType: 'User',
        entityId: user.id,
        summary: 'User signed in',
      },
    );

    redirect(user.isPlatformAdmin ? '/platform' : '/dashboard');
  } catch (error) {
    if (error instanceof AuthenticationFailedError) {
      return { ok: false, error: AUTH_GENERIC_FAILURE };
    }
    throw error;
  }
}

export async function requestPasswordResetAction(formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) {
    return { ok: false, error: 'Enter your email address first, then request a reset link.' };
  }

  const limit = consumeRateLimit(await clientKey('reset', email), RESET_LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return { ok: false, error: 'Too many reset requests. Please wait and try again.' };
  }

  const user = await findLoginUser(email);
  if (user && user.status === 'ACTIVE') {
    const token = await issuePasswordResetToken(user.id);
    await recordAudit(null, {
      action: 'auth.password_reset_requested',
      entityType: 'User',
      entityId: user.id,
      institutionId: user.institutionId,
      summary: 'Password reset requested',
    });

    // Development: surface the token so local testing works without an email provider.
    // Never treat this as a production delivery channel.
    if (process.env.NODE_ENV !== 'production') {
      return {
        ok: true,
        notice: `If that address has an account, a reset link is on its way. Development token: ${token}`,
      };
    }
  }

  return { ok: true, notice: 'If that address has an account, a reset link is on its way.' };
}

export async function resetPasswordAction(formData: FormData): Promise<AuthActionResult> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 10) {
    return { ok: false, error: 'Choose a password of at least 10 characters.' };
  }
  if (password !== confirm) {
    return { ok: false, error: 'The two passwords do not match.' };
  }

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    return { ok: false, error: 'This reset link is invalid or has expired.' };
  }

  await setUserPassword(userId, password);
  await revokeAllSessions(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { institutionId: true },
  });

  await recordAudit(null, {
    action: 'auth.password_reset_completed',
    entityType: 'User',
    entityId: userId,
    institutionId: user?.institutionId ?? null,
    summary: 'Password reset completed',
  });

  return { ok: true, notice: 'Your password has been updated. You can sign in now.' };
}

export async function changePasswordAction(formData: FormData): Promise<AuthActionResult> {
  const context = await getCurrentUser();
  if (!context) return { ok: false, error: 'Authentication required.' };

  const current = String(formData.get('currentPassword') ?? '');
  const next = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (next.length < 10) {
    return { ok: false, error: 'Choose a password of at least 10 characters.' };
  }
  if (next !== confirm) {
    return { ok: false, error: 'The two passwords do not match.' };
  }

  try {
    await authenticateWithPassword(context.email, current);
  } catch {
    return { ok: false, error: 'Current password is incorrect.' };
  }

  await setUserPassword(context.userId, next);
  const token = await readSessionToken();
  await revokeAllSessions(context.userId);
  const created = await createSession(context.userId);
  await writeSessionCookie(created.token);
  // Keep the caller signed in on the new session; previous sessions (including
  // the one we just revoked, which may be `token`) are dead.
  void token;

  await recordAudit(context, {
    action: 'auth.password_changed',
    entityType: 'User',
    entityId: context.userId,
    summary: 'Password changed',
  });

  return { ok: true, notice: 'Your password has been updated.' };
}

export async function signOutAction(): Promise<void> {
  const context = await getCurrentUser();
  const token = await readSessionToken();
  await revokeSessionByToken(token);
  await clearSessionCookie();

  if (context) {
    await recordAudit(context, {
      action: 'auth.logout',
      entityType: 'User',
      entityId: context.userId,
      summary: 'User signed out',
    });
  }

  redirect('/login');
}
