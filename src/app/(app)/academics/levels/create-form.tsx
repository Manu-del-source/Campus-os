'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField, fieldClassName } from '@/components/ui/form-field';
import { createAcademicLevelAction } from '@/server/academics/form-actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create level'}
    </Button>
  );
}

export function CreateAcademicLevelForm() {
  const [state, formAction] = useActionState(createAcademicLevelAction, null);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
        Create a new academic level
      </summary>
      <div className="mt-4">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Code" htmlFor="code">
            <input id="code" name="code" required maxLength={20} placeholder="e.g. CERT, DIP" className={fieldClassName} />
          </FormField>
          <FormField label="Name" htmlFor="name">
            <input id="name" name="name" required maxLength={120} placeholder="e.g. Certificate, Diploma" className={fieldClassName} />
          </FormField>
          <FormField label="Rank" htmlFor="rank" hint="Ordering rank for progression (e.g. 4, 5, 6)">
            <input id="rank" name="rank" type="number" min={1} max={100} required className={fieldClassName} />
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
