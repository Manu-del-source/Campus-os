import { NextResponse } from 'next/server';

import { recordAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth/session';
import { publicEnv } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Sign-out. Implemented as a route handler so the session cookies are cleared
 * server-side; the browser never manages authorization state itself.
 */
export async function GET(): Promise<NextResponse> {
  const context = await getCurrentUser();
  const supabase = await createSupabaseServerClient();

  if (context) {
    await recordAudit(context, {
      action: 'auth.logout',
      entityType: 'User',
      entityId: context.userId,
      summary: 'User signed out',
    });
  }

  await supabase?.auth.signOut();

  return NextResponse.redirect(new URL('/login', publicEnv.NEXT_PUBLIC_APP_URL));
}
