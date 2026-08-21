'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField, fieldClassName } from '@/components/ui/form-field';
import { createUnitAction } from '@/server/academics/form-actions';

interface Programme {
  id: string;
  code: string;
  name: string;
}

interface Level {
  id: string;
  code: string;
  name: string;
}

interface Semester {
  id: string;
  code: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create unit'}
    </Button>
  );
}

export function CreateUnitForm({
  programmes,
  levels,
  semesters,
}: {
  programmes: Programme[];
  levels: Level[];
  semesters: Semester[];
}) {
  const [state, formAction] = useActionState(createUnitAction, null);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
        Create a new unit
      </summary>
      <div className="mt-4">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Code" htmlFor="code">
            <input id="code" name="code" required maxLength={20} placeholder="e.g. CS101" className={fieldClassName} />
          </FormField>
          <FormField label="Name" htmlFor="name">
            <input id="name" name="name" required maxLength={160} placeholder="e.g. Introduction to Computing" className={fieldClassName} />
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
          <FormField label="Type" htmlFor="type">
            <select id="type" name="type" defaultValue="CORE" className={fieldClassName}>
              <option value="CORE">Core</option>
              <option value="ELECTIVE">Elective</option>
              <option value="COMMON">Common</option>
              <option value="INDUSTRIAL_ATTACHMENT">Industrial Attachment</option>
              <option value="PROJECT">Project</option>
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
          <FormField label="Semester" htmlFor="semesterId" hint="Optional">
            <select id="semesterId" name="semesterId" className={fieldClassName}>
              <option value="">None</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Credit hours" htmlFor="creditHours" hint="Optional">
            <input id="creditHours" name="creditHours" type="number" min={0} max={20} className={fieldClassName} />
          </FormField>
          <FormField label="Contact hours" htmlFor="contactHours" hint="Optional">
            <input id="contactHours" name="contactHours" type="number" min={0} max={200} className={fieldClassName} />
          </FormField>
          <FormField label="Stage" htmlFor="stage" hint="Programme stage when normally taken">
            <input id="stage" name="stage" type="number" min={1} max={20} defaultValue={1} required className={fieldClassName} />
          </FormField>
          <FormField label="Description" htmlFor="description" hint="Optional">
            <input id="description" name="description" maxLength={1000} className={fieldClassName} />
          </FormField>
          {state && (
            <p className="sm:col-span-2 text-sm text-[var(--color-danger)]">{state.message}</p>
          )}
          <div className="sm:col-span-2">
            <SubmitButton />
          </div>
        </form>
      </div>
    </details>
  );
}
