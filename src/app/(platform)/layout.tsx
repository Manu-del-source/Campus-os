import { redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUser } from '@/lib/auth/session';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import { PLATFORM_NAV } from '@/lib/navigation';
import { filterNavigation } from '@/lib/navigation-filter';

/** Session-dependent: never prerendered or cached. */
export const dynamic = 'force-dynamic';

/**
 * Platform administration shell. Institution users can never reach this area:
 * the check is `isPlatformAdmin`, resolved from the database, not from a claim
 * the client can influence.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentUser();

  if (!context) redirect('/login');
  if (!context.isPlatformAdmin) redirect('/dashboard');

  return (
    <AppShell
      sections={filterNavigation(PLATFORM_NAV, context)}
      productArea="Platform administration"
      tenantName="CampusOS Platform"
      tenantMeta="All institutions"
      user={{
        firstName: context.firstName,
        lastName: context.lastName,
        email: context.email,
        roles: context.roleKeys.map((role) => ROLE_LABELS[role]),
      }}
    >
      {children}
    </AppShell>
  );
}
