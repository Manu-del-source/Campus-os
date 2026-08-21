'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField, fieldClassName } from '@/components/ui/form-field';
import { createTimetableEntryAction } from '@/server/timetable/form-actions';

interface Semester {
  id: string;
  code: string;
  name: string;
}

interface Unit {
  id: string;
  code: string;
  name: string;
}

interface Staff {
  id: string;
  firstName: string;
  lastName: string;
}

interface Room {
  id: string;
  code: string;
  name: string;
}

interface Group {
  id: string;
  code: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create entry'}
    </Button>
  );
}

export function CreateTimetableEntryForm({
  semesters,
  units,
  staffList,
  rooms,
  groups,
}: {
  semesters: Semester[];
  units: Unit[];
  staffList: Staff[];
  rooms: Room[];
  groups: Group[];
}) {
  const [state, formAction] = useActionState(createTimetableEntryAction, null);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
        Create a new timetable entry
      </summary>
      <div className="mt-4">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Semester" htmlFor="semesterId">
            <select id="semesterId" name="semesterId" required className={fieldClassName}>
              <option value="">Select semester</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Unit" htmlFor="unitId">
            <select id="unitId" name="unitId" required className={fieldClassName}>
              <option value="">Select unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Lecturer" htmlFor="staffId">
            <select id="staffId" name="staffId" required className={fieldClassName}>
              <option value="">Select lecturer</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Room" htmlFor="roomId">
            <select id="roomId" name="roomId" required className={fieldClassName}>
              <option value="">Select room</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Group" htmlFor="groupId">
            <select id="groupId" name="groupId" required className={fieldClassName}>
              <option value="">Select group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Day" htmlFor="dayOfWeek">
            <select id="dayOfWeek" name="dayOfWeek" required className={fieldClassName}>
              <option value="">Select day</option>
              <option value="MONDAY">Monday</option>
              <option value="TUESDAY">Tuesday</option>
              <option value="WEDNESDAY">Wednesday</option>
              <option value="THURSDAY">Thursday</option>
              <option value="FRIDAY">Friday</option>
              <option value="SATURDAY">Saturday</option>
            </select>
          </FormField>
          <FormField label="Start time" htmlFor="startTime">
            <input id="startTime" name="startTime" type="time" required className={fieldClassName} />
          </FormField>
          <FormField label="End time" htmlFor="endTime">
            <input id="endTime" name="endTime" type="time" required className={fieldClassName} />
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
