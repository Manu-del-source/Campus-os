'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField, fieldClassName } from '@/components/ui/form-field';
import { createRoomAction } from '@/server/timetable/form-actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create room'}
    </Button>
  );
}

export function CreateRoomForm() {
  const [state, formAction] = useActionState(createRoomAction, null);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
        Create a new room
      </summary>
      <div className="mt-4">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Code" htmlFor="code">
            <input id="code" name="code" required maxLength={40} placeholder="e.g. RM-101" className={fieldClassName} />
          </FormField>
          <FormField label="Name" htmlFor="name">
            <input id="name" name="name" required maxLength={160} placeholder="e.g. Lecture Hall A" className={fieldClassName} />
          </FormField>
          <FormField label="Building" htmlFor="building" hint="Optional">
            <input id="building" name="building" maxLength={120} className={fieldClassName} />
          </FormField>
          <FormField label="Floor" htmlFor="floor" hint="Optional">
            <input id="floor" name="floor" type="number" min={0} max={50} className={fieldClassName} />
          </FormField>
          <FormField label="Capacity" htmlFor="capacity" hint="Optional">
            <input id="capacity" name="capacity" type="number" min={1} className={fieldClassName} />
          </FormField>
          <FormField label="Type" htmlFor="roomType">
            <select id="roomType" name="roomType" defaultValue="CLASSROOM" className={fieldClassName}>
              <option value="CLASSROOM">Classroom</option>
              <option value="LAB">Laboratory</option>
              <option value="WORKSHOP">Workshop</option>
              <option value="LECTURE_HALL">Lecture Hall</option>
              <option value="COMPUTER_LAB">Computer Lab</option>
              <option value="LIBRARY">Library</option>
              <option value="OFFICE">Office</option>
              <option value="OTHER">Other</option>
            </select>
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
