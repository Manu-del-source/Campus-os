import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatDate, formatNumber } from '@/lib/utils';
import { listUsers } from '@/server/institution/users';
import { listRoles } from '@/server/institution/roles';
import { academicListQuerySchema } from '@/server/academics/schemas';
import { InviteUserForm } from './invite-form';

export const metadata: Metadata = { title: 'Users' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UsersPage({ searchParams }: PageProps) {
  const context = await requirePermission('users.read');
  const params = await searchParams;

  const parsed = academicListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
  });

  const query = parsed.success ? parsed.data : academicListQuerySchema.parse({});
  const [result, roles] = await Promise.all([
    listUsers(context, query),
    listRoles(context),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${formatNumber(result.total)} user${result.total === 1 ? '' : 's'} in this institution.`}
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">
              Search users
            </label>
            <input
              id="search"
              name="search"
              type="search"
              defaultValue={query.search ?? ''}
              placeholder="Search by name or email"
              className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
            />
          </div>
          <button
            type="submit"
            className="h-10 rounded-[var(--radius-base)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-accent-foreground)]"
          >
            Search
          </button>
        </form>

        {result.rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No users yet"
              description="Invite users to collaborate in this institution."
            />
          </div>
        ) : (
          <DataTable caption="Users">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th className="hidden md:table-cell">Roles</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">Last login</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((user) => (
                <tr key={user.id}>
                  <Td className="font-medium">
                    {user.firstName} {user.lastName}
                  </Td>
                  <Td className="text-sm">{user.email}</Td>
                  <Td className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <Badge key={role} tone="neutral">{role}</Badge>
                        ))
                      ) : (
                        <span className="text-xs text-[var(--color-muted-foreground)]">No roles</span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={user.status === 'ACTIVE' ? 'success' : user.status === 'INVITED' ? 'warning' : 'neutral'}>
                      {user.status.toLowerCase()}
                    </Badge>
                  </Td>
                  <Td className="hidden lg:table-cell text-sm text-[var(--color-muted-foreground)]">
                    {formatDate(user.lastLoginAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <InviteUserForm roles={roles.map((r) => ({ key: r.key, name: r.name }))} />
    </div>
  );
}
