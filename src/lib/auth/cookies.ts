import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from '@/lib/auth/constants';

export { SESSION_COOKIE_NAME, SESSION_TTL_MS };

export function sessionCookieOptions(maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function writeSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(Math.floor(SESSION_TTL_MS / 1000)));
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, '', { ...sessionCookieOptions(0), maxAge: 0 });
}
