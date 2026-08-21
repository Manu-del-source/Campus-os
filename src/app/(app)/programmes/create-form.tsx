'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField, fieldClassName } from '@/components/ui/form-field';
import { createProgrammeAction } from '@/server/academics/form-actions';

interface Department {
  id: string;
  code: string;
  name: string;
}

interface Level {
  id: string;
  code: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create programme'}
    </Button>
  );
}

export function CreateProgrammeForm({
  departments,
  levels,
}: {
  departments: Department[];
  levels: Level[];
}) {
  const [state, formAction] = useActionState(createProgrammeAction, null);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
        Create a new programme
      </summary>
      <div className="mt-4">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Code" htmlFor="code">
            <input id="code" name="code" required maxLength={20} className={fieldClassName} />
          </FormField>
          <FormField label="Name" htmlFor="name">
            <input id="name" name="name" required maxLength={160} className={fieldClassName} />
          </FormField>
          <FormField label="Department" htmlFor="departmentId">
            <select id="departmentId" name="departmentId" required className={fieldClassName}>
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Academic level" htmlFor="levelId" hint="Optional">
            <select id="levelId" name="levelId" className={fieldClassName}>
              <option value="">None</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Duration" htmlFor="duration">
            <input id="duration" name="duration" type="number" min={1} max={20} defaultValue={1} required className={fieldClassName} />
          </FormField>
          <FormField label="Duration unit" htmlFor="durationUnit">
            <select id="durationUnit" name="durationUnit" defaultValue="YEAR" className={fieldClassName}>
              <option value="YEAR">Year</option>
              <option value="SEMESTER">Semester</option>
              <option value="TERM">Term</option>
              <option value="MONTH">Month</option>
              <option value="WEEK">Week</option>
            </select>
          </FormField>
          <FormField label="Stages" htmlFor="stages" hint="Number of academic years/stages">
            <input id="stages" name="stages" type="number" min={1} max={20} defaultValue={1} required className={fieldClassName} />
          </FormField>
          <FormField label="Description" htmlFor="description" hint="Optional">
            <input id="description" name="description" maxLength={1000} className={fieldClassName} />
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
