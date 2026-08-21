'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField, fieldClassName } from '@/components/ui/form-field';
import { createCohortAction } from '@/server/academics/form-actions';

interface Programme {
  id: string;
  code: string;
  name: string;
}

interface Intake {
  id: string;
  code: string;
  name: string;
}

interface AcademicYear {
  id: string;
  code: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create cohort'}
    </Button>
  );
}

export function CreateCohortForm({
  programmes,
  intakes,
  academicYears,
}: {
  programmes: Programme[];
  intakes: Intake[];
  academicYears: AcademicYear[];
}) {
  const [state, formAction] = useActionState(createCohortAction, null);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
        Create a new cohort
      </summary>
      <div className="mt-4">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Code" htmlFor="code">
            <input id="code" name="code" required maxLength={30} placeholder="e.g. ICT-DIP-SEP26" className={fieldClassName} />
          </FormField>
          <FormField label="Name" htmlFor="name">
            <input id="name" name="name" required maxLength={120} placeholder="e.g. ICT Diploma September 2026" className={fieldClassName} />
          </FormField>
          <FormField label="Programme" htmlFor="programmeId">
            <select id="programmeId" name="programmeId" required className={fieldClassName}>
              <option value="">Select programme</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Intake" htmlFor="intakeId">
            <select id="intakeId" name="intakeId" required className={fieldClassName}>
              <option value="">Select intake</option>
              {intakes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} — {i.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Academic year" htmlFor="academicYearId" hint="Optional">
            <select id="academicYearId" name="academicYearId" className={fieldClassName}>
              <option value="">None</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.code} — {y.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Current stage" htmlFor="currentStage" hint="Year/stage within the programme">
            <input id="currentStage" name="currentStage" type="number" min={1} max={20} defaultValue={1} required className={fieldClassName} />
          </FormField>
          <FormField label="Start date" htmlFor="startDate" hint="Optional">
            <input id="startDate" name="startDate" type="date" className={fieldClassName} />
          </FormField>
          <FormField label="Expected end date" htmlFor="expectedEndDate" hint="Optional">
            <input id="expectedEndDate" name="expectedEndDate" type="date" className={fieldClassName} />
          </FormField>
          <FormField label="Status" htmlFor="status">
            <select id="status" name="status" defaultValue="PLANNED" className={fieldClassName}>
              <option value="PLANNED">Planned</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
              <option value="ARCHIVED">Archived</option>
            </select>
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
