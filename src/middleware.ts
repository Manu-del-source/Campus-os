import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Session refresh + coarse route gating.
 *
 * The middleware keeps Supabase auth cookies fresh and bounces obviously
 * unauthenticated traffic away from private areas. It is a convenience layer
 * only: every page, action and route handler re-checks authentication,
 * permissions and tenant ownership on the server.
 */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/students',
  '/staff-directory',
  '/admissions',
  '/academics',
  '/departments',
  '/programmes',
  '/units',
  '/cohorts',
  '/timetable',
  '/attendance',
  '/examinations',
  '/results',
  '/finance',
  '/documents',
  '/notifications',
  '/reports',
  '/settings',
  '/platform',
  '/student',
  '/staff',
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase configured there is no session to refresh; page-level
  // guards still apply.
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(request.nextUrl.pathname)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
