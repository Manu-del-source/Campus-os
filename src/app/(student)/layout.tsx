import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Student Portal' };

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Mobile-first header */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/student" className="text-lg font-semibold">
            Student Portal
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-muted-foreground)]">
              {user.firstName}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-surface)] md:hidden">
        <div className="flex items-center justify-around py-2">
          <Link href="/student" className="flex flex-col items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
            <span>🏠</span>
            <span>Home</span>
          </Link>
          <Link href="/student/results" className="flex flex-col items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
            <span>📊</span>
            <span>Results</span>
          </Link>
          <Link href="/student/attendance" className="flex flex-col items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
            <span>📋</span>
            <span>Attendance</span>
          </Link>
          <Link href="/student/finance" className="flex flex-col items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
            <span>💰</span>
            <span>Finance</span>
          </Link>
          <Link href="/student/profile" className="flex flex-col items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
            <span>👤</span>
            <span>Profile</span>
          </Link>
        </div>
      </nav>

      {/* Desktop sidebar + content */}
      <div className="mx-auto flex max-w-4xl">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] md:block">
          <nav className="sticky top-14 space-y-1 p-4">
            <Link href="/student" className="block rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]">
              Dashboard
            </Link>
            <Link href="/student/results" className="block rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]">
              My Results
            </Link>
            <Link href="/student/attendance" className="block rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]">
              My Attendance
            </Link>
            <Link href="/student/finance" className="block rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]">
              My Finance
            </Link>
            <Link href="/student/units" className="block rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]">
              My Units
            </Link>
            <Link href="/student/timetable" className="block rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]">
              Timetable
            </Link>
            <Link href="/student/profile" className="block rounded px-3 py-2 text-sm hover:bg-[var(--color-muted)]">
              Profile
            </Link>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
