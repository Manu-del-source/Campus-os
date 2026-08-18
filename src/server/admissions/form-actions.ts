'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { isAuthorizationError, isDomainError } from '@/lib/auth/errors';
import { getCurrentUser } from '@/lib/auth/session';
import {
  issueOffer,
  registerApplicant,
  rejectApplication,
  startApplicationReview,
  withdrawApplicationAsStaff,
} from '@/server/admissions/actions';
import {
  acceptPublicOffer,
  createPublicApplication,
  submitPublicApplication,
  withdrawPublicApplication,
} from '@/server/admissions/public';

function formString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function fail(error: unknown): { ok: false; message: string } {
  if (isAuthorizationError(error) || isDomainError(error)) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: 'Something went wrong. Please try again.' };
}

export async function createApplicationAction(
  _previous: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const created = await createPublicApplication({
      institutionSlug: formString(formData, 'institutionSlug') ?? '',
      programmeId: formString(formData, 'programmeId') ?? '',
      intakeId: formString(formData, 'intakeId') ?? '',
      campusId: formString(formData, 'campusId'),
      firstName: formString(formData, 'firstName') ?? '',
      middleName: formString(formData, 'middleName'),
      lastName: formString(formData, 'lastName') ?? '',
      email: formString(formData, 'email') ?? '',
      phone: formString(formData, 'phone'),
      nationalId: formString(formData, 'nationalId'),
      nationality: formString(formData, 'nationality') ?? 'KE',
      gender: formString(formData, 'gender') as 'FEMALE' | 'MALE' | 'OTHER' | 'UNDISCLOSED' | undefined,
      city: formString(formData, 'city'),
      county: formString(formData, 'county'),
      guardianName: formString(formData, 'guardianName'),
      guardianPhone: formString(formData, 'guardianPhone'),
    });

    const slug = created.application.institution.slug;
    redirect(`/apply/${slug}/${created.application.reference}?token=${created.accessToken}`);
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    return fail(error);
  }
  return null;
}

export async function submitApplicationAction(formData: FormData): Promise<void> {
  const lookup = {
    institutionSlug: formString(formData, 'institutionSlug') ?? '',
    reference: formString(formData, 'reference') ?? '',
    token: formString(formData, 'token') ?? '',
  };
  await submitPublicApplication(lookup);
  redirect(`/apply/${lookup.institutionSlug}/${lookup.reference}?token=${lookup.token}`);
}

export async function withdrawApplicationAction(formData: FormData): Promise<void> {
  const lookup = {
    institutionSlug: formString(formData, 'institutionSlug') ?? '',
    reference: formString(formData, 'reference') ?? '',
    token: formString(formData, 'token') ?? '',
  };
  await withdrawPublicApplication(lookup);
  redirect(`/apply/${lookup.institutionSlug}/${lookup.reference}?token=${lookup.token}`);
}

export async function acceptOfferAction(formData: FormData): Promise<void> {
  const lookup = {
    institutionSlug: formString(formData, 'institutionSlug') ?? '',
    reference: formString(formData, 'reference') ?? '',
    token: formString(formData, 'token') ?? '',
  };
  await acceptPublicOffer(lookup);
  redirect(`/apply/${lookup.institutionSlug}/${lookup.reference}?token=${lookup.token}`);
}

export async function reviewApplicationAction(formData: FormData): Promise<void> {
  const context = await getCurrentUser();
  await startApplicationReview(context!, {
    applicationId: formString(formData, 'applicationId') ?? '',
    note: formString(formData, 'note'),
  });
  revalidatePath(`/admissions/${formString(formData, 'applicationId')}`);
}

export async function rejectApplicationAction(formData: FormData): Promise<void> {
  const context = await getCurrentUser();
  await rejectApplication(context!, {
    applicationId: formString(formData, 'applicationId') ?? '',
    note: formString(formData, 'note') ?? '',
  });
  revalidatePath(`/admissions/${formString(formData, 'applicationId')}`);
}

export async function withdrawStaffApplicationAction(formData: FormData): Promise<void> {
  const context = await getCurrentUser();
  await withdrawApplicationAsStaff(context!, {
    applicationId: formString(formData, 'applicationId') ?? '',
    note: formString(formData, 'note'),
  });
  revalidatePath(`/admissions/${formString(formData, 'applicationId')}`);
}

export async function issueOfferAction(formData: FormData): Promise<void> {
  const context = await getCurrentUser();
  const expires = formString(formData, 'expiresAt');
  await issueOffer(context!, {
    applicationId: formString(formData, 'applicationId') ?? '',
    cohortId: formString(formData, 'cohortId'),
    groupId: formString(formData, 'groupId'),
    expiresAt: expires ? new Date(expires) : undefined,
    conditions: formString(formData, 'conditions'),
  });
  revalidatePath(`/admissions/${formString(formData, 'applicationId')}`);
}

export async function registerApplicantAction(formData: FormData): Promise<void> {
  const context = await getCurrentUser();
  const result = await registerApplicant(context!, {
    applicationId: formString(formData, 'applicationId') ?? '',
    cohortId: formString(formData, 'cohortId'),
    groupId: formString(formData, 'groupId'),
  });
  revalidatePath('/students');
  redirect(`/students/${result.student.id}`);
}
