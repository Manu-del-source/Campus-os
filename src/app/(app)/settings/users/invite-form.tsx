'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField, fieldClassName } from '@/components/ui/form-field';
import { inviteUserAction } from '@/server/institution/form-actions';

interface Role {
  key: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Inviting…' : 'Invite user'}
    </Button>
  );
}

export function InviteUserForm({ roles }: { roles: Role[] }) {
  const [state, formAction] = useActionState(inviteUserAction, null);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
        Invite a new user
      </summary>
      <div className="mt-4">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email" htmlFor="email">
            <input id="email" name="email" type="email" required maxLength={160} className={fieldClassName} />
          </FormField>
          <FormField label="First name" htmlFor="firstName">
            <input id="firstName" name="firstName" required maxLength={80} className={fieldClassName} />
          </FormField>
          <FormField label="Last name" htmlFor="lastName">
            <input id="lastName" name="lastName" required maxLength={80} className={fieldClassName} />
          </FormField>
          <FormField label="Role" htmlFor="roleKey">
            <select id="roleKey" name="roleKey" required className={fieldClassName}>
              <option value="">Select role</option>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Password" htmlFor="password" hint="Leave blank to send an invite email later">
            <input id="password" name="password" type="password" minLength={8} maxLength={128} className={fieldClassName} />
          </FormField>
          {state && !state.ok ? (
            <p className="sm:col-span-2 text-sm text-[var(--color-danger)]">{state.message}</p>
          ) : null}
          {state && state.ok ? (
            <p className="sm:col-span-2 text-sm text-[var(--color-success)]">{state.message}</p>
          ) : null}
          <div className="sm:col-span-2">
            <SubmitButton />
          </div>
        </form>
      </div>
    </details>
  );
}
