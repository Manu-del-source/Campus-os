import { NextResponse, type NextRequest } from 'next/server';

/**
 * Coarse route gating middleware.
 *
 * Checks for the presence of the CampusOS session cookie and bounces unauthenticated
 * traffic away from protected application paths. This is a lightweight fast-path check:
 * full database-backed session validation and role/permission enforcement happen on the
 * server inside page layouts, route handlers, and server actions.
 */
const SESSION_COOKIE_NAME = 'campusos_session';

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

export function middleware(request: NextRequest): NextResponse {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken && isProtected(request.nextUrl.pathname)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
