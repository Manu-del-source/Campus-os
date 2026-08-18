import { redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUser } from '@/lib/auth/session';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import { INSTITUTION_NAV } from '@/lib/navigation';
import { filterNavigation } from '@/lib/navigation-filter';

/** Session-dependent: never prerendered or cached. */
export const dynamic = 'force-dynamic';

/**
 * Institution application shell.
 *
 * Authentication and tenant resolution happen here, once, on the server. Pages
 * below still assert their own permissions — the layout is a convenience, not
 * the security boundary.
 */
export default async function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentUser();

  if (!context) redirect('/login');
  if (!context.institutionId || !context.institution) redirect('/platform');

  const sections = filterNavigation(INSTITUTION_NAV, context);

  return (
    <AppShell
      sections={sections}
      productArea="Institution workspace"
      tenantName={context.institution.name}
      tenantMeta={context.institution.shortName ?? context.institution.slug}
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
