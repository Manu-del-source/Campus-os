'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField, fieldClassName } from '@/components/ui/form-field';
import { createAcademicYearAction } from '@/server/academics/form-actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create academic year'}
    </Button>
  );
}

export function CreateAcademicYearForm() {
  const [state, formAction] = useActionState(createAcademicYearAction, null);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
        Create a new academic year
      </summary>
      <div className="mt-4">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Code" htmlFor="code">
            <input id="code" name="code" required maxLength={20} placeholder="e.g. 2026" className={fieldClassName} />
          </FormField>
          <FormField label="Name" htmlFor="name">
            <input id="name" name="name" required maxLength={120} placeholder="e.g. 2026 Academic Year" className={fieldClassName} />
          </FormField>
          <FormField label="Start date" htmlFor="startDate">
            <input id="startDate" name="startDate" type="date" required className={fieldClassName} />
          </FormField>
          <FormField label="End date" htmlFor="endDate">
            <input id="endDate" name="endDate" type="date" required className={fieldClassName} />
          </FormField>
          <FormField label="Status" htmlFor="status">
            <select id="status" name="status" defaultValue="PLANNED" className={fieldClassName}>
              <option value="PLANNED">Planned</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </FormField>
          <FormField label="Mark as current" htmlFor="isCurrent">
            <label className="flex items-center gap-2 text-sm">
              <input id="isCurrent" name="isCurrent" type="checkbox" className="h-4 w-4" />
              Set as the current academic year
            </label>
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
