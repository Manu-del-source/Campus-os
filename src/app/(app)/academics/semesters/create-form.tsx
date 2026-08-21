'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField, fieldClassName } from '@/components/ui/form-field';
import { createSemesterAction } from '@/server/academics/form-actions';

interface AcademicYear {
  id: string;
  code: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create semester'}
    </Button>
  );
}

export function CreateSemesterForm({ academicYears }: { academicYears: AcademicYear[] }) {
  const [state, formAction] = useActionState(createSemesterAction, null);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
        Create a new semester
      </summary>
      <div className="mt-4">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Academic year" htmlFor="academicYearId">
            <select id="academicYearId" name="academicYearId" required className={fieldClassName}>
              <option value="">Select academic year</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.code} — {y.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Code" htmlFor="code">
            <input id="code" name="code" required maxLength={20} placeholder="e.g. S1, S2" className={fieldClassName} />
          </FormField>
          <FormField label="Name" htmlFor="name">
            <input id="name" name="name" required maxLength={120} placeholder="e.g. Semester 1" className={fieldClassName} />
          </FormField>
          <FormField label="Sequence" htmlFor="sequence" hint="Position within the academic year (1, 2, ...)">
            <input id="sequence" name="sequence" type="number" min={1} max={10} required className={fieldClassName} />
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
              Set as the current semester
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
