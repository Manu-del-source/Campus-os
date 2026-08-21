'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField, fieldClassName } from '@/components/ui/form-field';
import { createIntakeAction } from '@/server/academics/form-actions';

interface AcademicYear {
  id: string;
  code: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create intake'}
    </Button>
  );
}

export function CreateIntakeForm({ academicYears }: { academicYears: AcademicYear[] }) {
  const [state, formAction] = useActionState(createIntakeAction, null);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
        Create a new intake
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
            <input id="code" name="code" required maxLength={20} placeholder="e.g. SEP26, FEB26" className={fieldClassName} />
          </FormField>
          <FormField label="Name" htmlFor="name">
            <input id="name" name="name" required maxLength={120} placeholder="e.g. September 2026 Intake" className={fieldClassName} />
          </FormField>
          <FormField label="Status" htmlFor="status">
            <select id="status" name="status" defaultValue="PLANNED" className={fieldClassName}>
              <option value="PLANNED">Planned</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </FormField>
          <FormField label="Start date" htmlFor="startDate">
            <input id="startDate" name="startDate" type="date" required className={fieldClassName} />
          </FormField>
          <FormField label="End date" htmlFor="endDate" hint="Optional">
            <input id="endDate" name="endDate" type="date" className={fieldClassName} />
          </FormField>
          <FormField label="Application open" htmlFor="applicationOpen" hint="Optional">
            <input id="applicationOpen" name="applicationOpen" type="date" className={fieldClassName} />
          </FormField>
          <FormField label="Application close" htmlFor="applicationClose" hint="Optional">
            <input id="applicationClose" name="applicationClose" type="date" className={fieldClassName} />
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
