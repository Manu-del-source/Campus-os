import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { requirePermission } from '@/lib/auth/session';
import { formatNumber } from '@/lib/utils';
import { listRoles } from '@/server/institution/roles';
import { PermissionEditor } from './permission-editor';

export const metadata: Metadata = { title: 'Roles & Permissions' };

export default async function RolesPage() {
  const context = await requirePermission('roles.read');
  const roles = await listRoles(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description={`${formatNumber(roles.length)} role${roles.length === 1 ? '' : 's'} configured.`}
      />

      {roles.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No roles"
              description="Roles are created during institution setup."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader
                title={
                  <div className="flex items-center gap-2">
                    {role.name}
                    {role.isSystem ? <Badge tone="accent">system</Badge> : null}
                  </div>
                }
                description={
                  <div className="flex items-center gap-3 text-xs">
                    <span>{role.permissionCount} permission{role.permissionCount === 1 ? '' : 's'}</span>
                    <span>{role.userCount} user{role.userCount === 1 ? '' : 's'}</span>
                  </div>
                }
              />
              <CardBody>
                {role.isSystem ? (
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    System roles are seeded by CampusOS and cannot be modified. Clone this role to customise it.
                  </p>
                ) : (
                  <PermissionEditor
                    roleId={role.id}
                    roleName={role.name}
                    grantedPermissions={role.permissions.map((p) => p.key)}
                  />
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
