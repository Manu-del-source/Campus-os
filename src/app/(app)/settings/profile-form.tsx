'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField, fieldClassName } from '@/components/ui/form-field';
import { updateInstitutionProfileAction } from '@/server/institution/form-actions';

interface Institution {
  name: string;
  shortName: string | null;
  type: string;
  registrationNumber: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  addressLine1: string | null;
  city: string | null;
  county: string | null;
  country: string;
  postalCode: string | null;
  timezone: string;
  currency: string;
  locale: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  );
}

export function UpdateProfileForm({ institution }: { institution: Institution }) {
  const [state, formAction] = useActionState(updateInstitutionProfileAction, null);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <FormField label="Institution name" htmlFor="name">
        <input id="name" name="name" required maxLength={200} defaultValue={institution.name} className={fieldClassName} />
      </FormField>
      <FormField label="Short name" htmlFor="shortName" hint="Optional">
        <input id="shortName" name="shortName" maxLength={60} defaultValue={institution.shortName ?? ''} className={fieldClassName} />
      </FormField>
      <FormField label="Type" htmlFor="type">
        <select id="type" name="type" defaultValue={institution.type} className={fieldClassName}>
          <option value="TVET">TVET</option>
          <option value="TECHNICAL_COLLEGE">Technical College</option>
          <option value="NATIONAL_POLYTECHNIC">National Polytechnic</option>
          <option value="UNIVERSITY_COLLEGE">University College</option>
          <option value="PRIVATE_COLLEGE">Private College</option>
          <option value="OTHER">Other</option>
        </select>
      </FormField>
      <FormField label="Registration number" htmlFor="registrationNumber" hint="Optional">
        <input id="registrationNumber" name="registrationNumber" maxLength={80} defaultValue={institution.registrationNumber ?? ''} className={fieldClassName} />
      </FormField>
      <FormField label="Email" htmlFor="email">
        <input id="email" name="email" type="email" maxLength={160} defaultValue={institution.email ?? ''} className={fieldClassName} />
      </FormField>
      <FormField label="Phone" htmlFor="phone">
        <input id="phone" name="phone" maxLength={40} defaultValue={institution.phone ?? ''} className={fieldClassName} />
      </FormField>
      <FormField label="Website" htmlFor="websiteUrl">
        <input id="websiteUrl" name="websiteUrl" type="url" maxLength={200} defaultValue={institution.websiteUrl ?? ''} className={fieldClassName} />
      </FormField>
      <FormField label="Address" htmlFor="addressLine1">
        <input id="addressLine1" name="addressLine1" maxLength={160} defaultValue={institution.addressLine1 ?? ''} className={fieldClassName} />
      </FormField>
      <FormField label="City" htmlFor="city">
        <input id="city" name="city" maxLength={80} defaultValue={institution.city ?? ''} className={fieldClassName} />
      </FormField>
      <FormField label="County" htmlFor="county">
        <input id="county" name="county" maxLength={80} defaultValue={institution.county ?? ''} className={fieldClassName} />
      </FormField>
      <FormField label="Country" htmlFor="country">
        <input id="country" name="country" maxLength={4} defaultValue={institution.country} className={fieldClassName} />
      </FormField>
      <FormField label="Postal code" htmlFor="postalCode">
        <input id="postalCode" name="postalCode" maxLength={20} defaultValue={institution.postalCode ?? ''} className={fieldClassName} />
      </FormField>
      <FormField label="Timezone" htmlFor="timezone">
        <input id="timezone" name="timezone" maxLength={60} defaultValue={institution.timezone} className={fieldClassName} />
      </FormField>
      <FormField label="Currency" htmlFor="currency">
        <input id="currency" name="currency" maxLength={5} defaultValue={institution.currency} className={fieldClassName} />
      </FormField>
      <FormField label="Locale" htmlFor="locale">
        <input id="locale" name="locale" maxLength={10} defaultValue={institution.locale} className={fieldClassName} />
      </FormField>
      {state && (
        <p className="sm:col-span-2 text-sm text-[var(--color-danger)]">{state.message}</p>
      )}
      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  );
}
