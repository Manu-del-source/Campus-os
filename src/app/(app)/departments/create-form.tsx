'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField, fieldClassName } from '@/components/ui/form-field';
import { createDepartmentAction } from '@/server/academics/form-actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create department'}
    </Button>
  );
}

export function CreateDepartmentForm() {
  const [state, formAction] = useActionState(createDepartmentAction, null);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
        Create a new department
      </summary>
      <div className="mt-4">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Code" htmlFor="code">
            <input id="code" name="code" required maxLength={20} className={fieldClassName} />
          </FormField>
          <FormField label="Name" htmlFor="name">
            <input id="name" name="name" required maxLength={120} className={fieldClassName} />
          </FormField>
          <FormField label="Description" htmlFor="description" hint="Optional">
            <input id="description" name="description" maxLength={500} className={fieldClassName} />
          </FormField>
          {state ? (
            <p className="sm:col-span-2 text-sm text-[var(--color-danger)]">{state.message}</p>
          ) : null}
          <div className="sm:col-span-2">
            <SubmitButton />
          </div>
        </form>
      </div>
    </details>
  );
}
