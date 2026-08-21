'use server';

import { revalidatePath } from 'next/cache';

import { isAuthorizationError, isDomainError } from '@/lib/auth/errors';
import { getCurrentUser } from '@/lib/auth/session';
import {
  createRegistration,
  updateRegistrationStatus,
  dropRegistration,
} from '@/server/registration/registrations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  if (error instanceof Error) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: 'Something went wrong. Please try again.' };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export async function createRegistrationAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createRegistration(context!, {
      studentId: formString(formData, 'studentId') ?? '',
      unitId: formString(formData, 'unitId') ?? '',
      semesterId: formString(formData, 'semesterId') ?? '',
    });
    revalidatePath('/registration');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function updateRegistrationStatusAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await updateRegistrationStatus(context!, {
      id: formString(formData, 'id') ?? '',
      status: formString(formData, 'status') as 'PENDING' | 'CONFIRMED' | 'DROPPED' | 'WITHDRAWN',
      reason: formString(formData, 'reason'),
    });
    revalidatePath('/registration');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function dropRegistrationAction(formData: FormData): Promise<void> {
  const context = await getCurrentUser();
  await dropRegistration(context!, formString(formData, 'id') ?? '');
  revalidatePath('/registration');
}
