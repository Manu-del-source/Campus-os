import { NextResponse } from 'next/server';

import { recordAudit } from '@/lib/audit';
import { clearSessionCookie, readSessionToken } from '@/lib/auth/cookies';
import { revokeSessionByToken } from '@/lib/auth/credentials';
import { getCurrentUser } from '@/lib/auth/session';
import { publicEnv } from '@/lib/env';

/**
 * Sign-out. Implemented as a route handler so the session cookie is cleared
 * server-side and the matching session row is revoked.
 */
export async function GET(): Promise<NextResponse> {
  const context = await getCurrentUser();
  const token = await readSessionToken();

  if (context) {
    await recordAudit(context, {
      action: 'auth.logout',
      entityType: 'User',
      entityId: context.userId,
      summary: 'User signed out',
    });
  }

  await revokeSessionByToken(token);
  await clearSessionCookie();

  const response = NextResponse.redirect(new URL('/login', publicEnv.NEXT_PUBLIC_APP_URL));
  response.cookies.set('campusos_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
