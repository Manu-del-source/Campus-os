import Link from 'next/link';

import { ButtonLink } from '@/components/ui/button';

const links = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-[var(--radius-base)] bg-[var(--color-accent)] text-sm font-bold text-[var(--color-accent-foreground)]">
              CO
            </span>
            CampusOS
          </Link>

          <nav aria-label="Marketing" className="hidden gap-6 text-sm sm:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ButtonLink href="/apply" variant="ghost" size="sm">
              Apply
            </ButtonLink>
            <ButtonLink href="/login" size="sm">
              Sign in
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-[var(--color-muted-foreground)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} CampusOS</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-4">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-[var(--color-foreground)]">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
