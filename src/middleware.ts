import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';

/**
 * Coarse route gating.
 *
 * Middleware only checks that a session cookie is present. Every page, action
 * and route handler re-checks authentication, expiry, revocation, permissions
 * and tenant ownership on the server.
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
  '/account',
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function middleware(request: NextRequest): NextResponse {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token && isProtected(request.nextUrl.pathname)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
