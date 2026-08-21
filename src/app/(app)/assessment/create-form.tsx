'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField, fieldClassName } from '@/components/ui/form-field';
import { createAssessmentAction } from '@/server/assessment/form-actions';

interface Unit {
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
      {pending ? 'Creating…' : 'Create assessment'}
    </Button>
  );
}

export function CreateAssessmentForm({
  units,
  semesters,
}: {
  units: Unit[];
  semesters: Semester[];
}) {
  const [state, formAction] = useActionState(createAssessmentAction, null);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
        Create a new assessment
      </summary>
      <div className="mt-4">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Unit" htmlFor="unitId">
            <select id="unitId" name="unitId" required className={fieldClassName}>
              <option value="">Select unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Semester" htmlFor="semesterId">
            <select id="semesterId" name="semesterId" required className={fieldClassName}>
              <option value="">Select semester</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Code" htmlFor="code">
            <input id="code" name="code" required maxLength={40} placeholder="e.g. CAT1" className={fieldClassName} />
          </FormField>
          <FormField label="Name" htmlFor="name">
            <input id="name" name="name" required maxLength={200} placeholder="e.g. Continuous Assessment Test 1" className={fieldClassName} />
          </FormField>
          <FormField label="Type" htmlFor="type">
            <select id="type" name="type" defaultValue="COURSEWORK" className={fieldClassName}>
              <option value="EXAM">Exam</option>
              <option value="ASSIGNMENT">Assignment</option>
              <option value="QUIZ">Quiz</option>
              <option value="PROJECT">Project</option>
              <option value="PRACTICAL">Practical</option>
              <option value="COURSEWORK">Coursework</option>
              <option value="PRESENTATION">Presentation</option>
              <option value="OTHER">Other</option>
            </select>
          </FormField>
          <FormField label="Max score" htmlFor="maxScore">
            <input id="maxScore" name="maxScore" type="number" min={0} defaultValue={100} required className={fieldClassName} />
          </FormField>
          <FormField label="Weight (%)" htmlFor="weight" hint="Percentage of final grade">
            <input id="weight" name="weight" type="number" min={0} max={100} defaultValue={0} className={fieldClassName} />
          </FormField>
          <FormField label="Due date" htmlFor="dueDate" hint="Optional">
            <input id="dueDate" name="dueDate" type="datetime-local" className={fieldClassName} />
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
