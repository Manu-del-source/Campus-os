import { NextResponse } from 'next/server';

import { recordAudit } from '@/lib/audit';
import { getCurrentUser, logout } from '@/lib/auth/session';
import { publicEnv } from '@/lib/env';

/**
 * Sign-out route handler. Revokes the database session record and clears the
 * secure HttpOnly session cookie on the server.
 */
async function handleLogout(): Promise<NextResponse> {
  const context = await getCurrentUser();

  if (context) {
    await recordAudit(context, {
      action: 'auth.logout',
      entityType: 'User',
      entityId: context.userId,
      summary: 'User signed out',
    });
  }

  await logout();

  return NextResponse.redirect(new URL('/login', publicEnv.NEXT_PUBLIC_APP_URL));
}

export async function GET(): Promise<NextResponse> {
  return handleLogout();
}

export async function POST(): Promise<NextResponse> {
  return handleLogout();
}
