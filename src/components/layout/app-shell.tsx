'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import type { NavSection } from '@/lib/navigation';
import { cn, initials } from '@/lib/utils';

interface AppShellProps {
  sections: readonly NavSection[];
  productArea: string;
  tenantName: string;
  tenantMeta?: string;
  user: { firstName: string; lastName: string; email: string; roles: readonly string[] };
  children: React.ReactNode;
}

export function AppShell({
  sections,
  productArea,
  tenantName,
  tenantMeta,
  user,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const nav = (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.label} className="space-y-1">
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-[var(--radius-base)] px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent)]'
                        : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]',
                    )}
                  >
                    <span>{item.label}</span>
                    {item.planned ? (
                      <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                        soon
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-4">
      <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-base)] bg-[var(--color-accent)] text-sm font-bold text-[var(--color-accent-foreground)]">
        CO
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{tenantName}</span>
        <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
          {tenantMeta ?? productArea}
        </span>
      </span>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex lg:h-dvh lg:flex-col lg:sticky lg:top-0">
        {brand}
        {nav}
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-[var(--radius-base)] border border-[var(--color-border)] px-3 py-1.5 text-sm lg:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileOpen((open) => !open)}
            >
              Menu
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold lg:hidden">{tenantName}</p>
              <p className="hidden text-xs uppercase tracking-wide text-[var(--color-muted-foreground)] lg:block">
                {productArea}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {user.roles.length > 0 ? user.roles.join(' · ') : user.email}
              </p>
            </div>
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-surface-muted)] text-xs font-semibold"
            >
              {initials(user.firstName, user.lastName)}
            </span>
            <Link
              href="/account/password"
              className="rounded-[var(--radius-base)] border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-muted)]"
            >
              Password
            </Link>
            <Link
              href="/logout"
              className="rounded-[var(--radius-base)] border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-muted)]"
            >
              Sign out
            </Link>
          </div>
        </header>

        {mobileOpen ? (
          <div
            id="mobile-navigation"
            className="border-b border-[var(--color-border)] bg-[var(--color-surface)] lg:hidden"
          >
            {nav}
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
