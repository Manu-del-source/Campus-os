import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { publicEnv } from '@/lib/env';

/**
 * Browser Supabase client — anon key only. It is used for the auth handshake
 * (sign in, sign out, password reset); all data access goes through server
 * code so authorization is never decided in the browser.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return createBrowserClient(url, anonKey);
}
