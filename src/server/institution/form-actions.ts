'use server';

import { revalidatePath } from 'next/cache';

import { isAuthorizationError, isDomainError } from '@/lib/auth/errors';
import { getCurrentUser } from '@/lib/auth/session';
import { updateInstitutionProfile } from '@/server/institution/settings';
import { inviteUser, updateUser, deactivateUser } from '@/server/institution/users';
import { updateRolePermissions } from '@/server/institution/roles';

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
// Institution Profile
// ---------------------------------------------------------------------------

export async function updateInstitutionProfileAction(
  _prev: { ok: false; message: string } | { ok: true; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | { ok: true; message: string }> {
  try {
    const context = await getCurrentUser();
    await updateInstitutionProfile(context!, {
      name: formString(formData, 'name') ?? '',
      shortName: formString(formData, 'shortName'),
      type: formString(formData, 'type') as 'TVET' | 'TECHNICAL_COLLEGE' | 'NATIONAL_POLYTECHNIC' | 'UNIVERSITY_COLLEGE' | 'PRIVATE_COLLEGE' | 'OTHER' | undefined,
      registrationNumber: formString(formData, 'registrationNumber'),
      email: formString(formData, 'email'),
      phone: formString(formData, 'phone'),
      websiteUrl: formString(formData, 'websiteUrl'),
      addressLine1: formString(formData, 'addressLine1'),
      city: formString(formData, 'city'),
      county: formString(formData, 'county'),
      country: formString(formData, 'country'),
      postalCode: formString(formData, 'postalCode'),
      timezone: formString(formData, 'timezone'),
      currency: formString(formData, 'currency'),
      locale: formString(formData, 'locale'),
    });
    revalidatePath('/settings');
    return { ok: true, message: 'Institution profile updated.' };
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// User Invitations
// ---------------------------------------------------------------------------

export async function inviteUserAction(
  _prev: { ok: false; message: string } | { ok: true; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | { ok: true; message: string }> {
  try {
    const context = await getCurrentUser();
    await inviteUser(context!, {
      email: formString(formData, 'email') ?? '',
      firstName: formString(formData, 'firstName') ?? '',
      lastName: formString(formData, 'lastName') ?? '',
      roleKey: formString(formData, 'roleKey') ?? '',
      password: formString(formData, 'password'),
    });
    revalidatePath('/settings/users');
    return { ok: true, message: 'User invited.' };
  } catch (error) {
    return fail(error);
  }
}

export async function updateUserAction(
  _prev: { ok: false; message: string } | { ok: true; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | { ok: true; message: string }> {
  try {
    const context = await getCurrentUser();
    await updateUser(context!, {
      id: formString(formData, 'id') ?? '',
      firstName: formString(formData, 'firstName'),
      lastName: formString(formData, 'lastName'),
      phone: formString(formData, 'phone'),
      status: formString(formData, 'status') as 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | undefined,
    });
    revalidatePath('/settings/users');
    return { ok: true, message: 'User updated.' };
  } catch (error) {
    return fail(error);
  }
}

export async function deactivateUserAction(formData: FormData): Promise<void> {
  const context = await getCurrentUser();
  await deactivateUser(context!, formString(formData, 'id') ?? '');
  revalidatePath('/settings/users');
}

// ---------------------------------------------------------------------------
// Role Permissions
// ---------------------------------------------------------------------------

export async function updateRolePermissionsAction(
  _prev: { ok: false; message: string } | { ok: true; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | { ok: true; message: string }> {
  try {
    const context = await getCurrentUser();
    const permissionKeys = formData.getAll('permissions').filter((v): v is string => typeof v === 'string');
    await updateRolePermissions(context!, {
      roleId: formString(formData, 'roleId') ?? '',
      permissionKeys,
    });
    revalidatePath('/settings/roles');
    return { ok: true, message: 'Role permissions updated.' };
  } catch (error) {
    return fail(error);
  }
}
