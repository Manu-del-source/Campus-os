'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { updateRolePermissionsAction } from '@/server/institution/form-actions';
import { ALL_PERMISSIONS } from '@/lib/auth/permissions';

interface PermissionEditorProps {
  roleId: string;
  roleName: string;
  grantedPermissions: string[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Saving…' : 'Save permissions'}
    </Button>
  );
}

// Group permissions by module
function groupByModule(permissions: readonly string[]) {
  const groups: Record<string, string[]> = {};
  for (const perm of permissions) {
    const [module] = perm.split('.');
    const key = module === 'platform' ? 'platform' : module;
    if (!groups[key]) groups[key] = [];
    groups[key].push(perm);
  }
  return groups;
}

const MODULE_LABELS: Record<string, string> = {
  institution: 'Institution',
  settings: 'Settings',
  users: 'Users',
  roles: 'Roles',
  audit: 'Audit',
  campuses: 'Campuses',
  departments: 'Departments',
  programmes: 'Programmes',
  units: 'Units',
  academics: 'Academics',
  students: 'Students',
  admissions: 'Admissions',
  staff: 'Staff',
  timetable: 'Timetable',
  attendance: 'Attendance',
  marks: 'Marks',
  results: 'Results',
  finance: 'Finance',
  documents: 'Documents',
  notifications: 'Notifications',
  reports: 'Reports',
  platform: 'Platform',
};

export function PermissionEditor({ roleId, roleName, grantedPermissions }: PermissionEditorProps) {
  const [state, formAction] = useActionState(updateRolePermissionsAction, null);
  const grouped = groupByModule(ALL_PERMISSIONS);
  const grantedSet = new Set(grantedPermissions);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="roleId" value={roleId} />

      {Object.entries(grouped).map(([module, perms]) => (
        <fieldset key={module} className="space-y-2">
          <legend className="text-sm font-semibold">{MODULE_LABELS[module] ?? module}</legend>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {perms.map((perm) => (
              <label key={perm} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="permissions"
                  value={perm}
                  defaultChecked={grantedSet.has(perm)}
                  className="h-4 w-4"
                />
                <span className="text-[var(--color-muted-foreground)]">{perm}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {state && !state.ok ? (
        <p className="text-sm text-[var(--color-danger)]">{state.message}</p>
      ) : null}
      {state && state.ok ? (
        <p className="text-sm text-[var(--color-success)]">{state.message}</p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
