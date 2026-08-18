'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { fieldClassName, FormField } from '@/components/ui/form-field';
import { createApplicationAction } from '@/server/admissions/form-actions';

interface Option {
  id: string;
  code: string;
  name: string;
}

export function ApplyForm({
  slug,
  programmes,
  intakes,
  campuses,
}: {
  slug: string;
  programmes: Option[];
  intakes: Option[];
  campuses: Option[];
}) {
  const [state, action, pending] = useActionState(createApplicationAction, null);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="institutionSlug" value={slug} />

      {state?.message ? (
        <p role="alert" className="rounded-[var(--radius-base)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {state.message}
        </p>
      ) : null}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Programme</legend>
        <FormField label="Programme" htmlFor="programmeId">
          <select id="programmeId" name="programmeId" required className={fieldClassName}>
            <option value="">Select a programme</option>
            {programmes.map((programme) => (
              <option key={programme.id} value={programme.id}>
                {programme.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Intake" htmlFor="intakeId">
          <select id="intakeId" name="intakeId" required className={fieldClassName}>
            <option value="">Select an intake</option>
            {intakes.map((intake) => (
              <option key={intake.id} value={intake.id}>
                {intake.name}
              </option>
            ))}
          </select>
        </FormField>
        {campuses.length > 0 ? (
          <FormField label="Preferred campus" htmlFor="campusId">
            <select id="campusId" name="campusId" className={fieldClassName}>
              <option value="">No preference</option>
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Your details</legend>
        <FormField label="First name" htmlFor="firstName">
          <input id="firstName" name="firstName" required autoComplete="given-name" className={fieldClassName} />
        </FormField>
        <FormField label="Middle name" htmlFor="middleName">
          <input id="middleName" name="middleName" autoComplete="additional-name" className={fieldClassName} />
        </FormField>
        <FormField label="Last name" htmlFor="lastName">
          <input id="lastName" name="lastName" required autoComplete="family-name" className={fieldClassName} />
        </FormField>
        <FormField label="Email" htmlFor="email">
          <input id="email" name="email" type="email" required autoComplete="email" className={fieldClassName} />
        </FormField>
        <FormField label="Phone" htmlFor="phone">
          <input id="phone" name="phone" type="tel" autoComplete="tel" className={fieldClassName} />
        </FormField>
        <FormField label="National ID" htmlFor="nationalId">
          <input id="nationalId" name="nationalId" className={fieldClassName} />
        </FormField>
        <FormField label="Gender" htmlFor="gender">
          <select id="gender" name="gender" className={fieldClassName}>
            <option value="">Prefer not to say</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
            <option value="UNDISCLOSED">Undisclosed</option>
          </select>
        </FormField>
        <FormField label="City" htmlFor="city">
          <input id="city" name="city" className={fieldClassName} />
        </FormField>
        <FormField label="Guardian name" htmlFor="guardianName">
          <input id="guardianName" name="guardianName" className={fieldClassName} />
        </FormField>
        <FormField label="Guardian phone" htmlFor="guardianPhone">
          <input id="guardianPhone" name="guardianPhone" type="tel" className={fieldClassName} />
        </FormField>
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save draft application'}
      </Button>
    </form>
  );
}
