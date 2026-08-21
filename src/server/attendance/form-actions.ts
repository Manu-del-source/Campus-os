'use server';

import { revalidatePath } from 'next/cache';

import { isAuthorizationError, isDomainError } from '@/lib/auth/errors';
import { getCurrentUser } from '@/lib/auth/session';
import {
  createAttendanceSession,
  cancelAttendanceSession,
} from '@/server/attendance/sessions';

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
// Attendance Session
// ---------------------------------------------------------------------------

export async function createAttendanceSessionAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createAttendanceSession(context!, {
      timetableEntryId: formString(formData, 'timetableEntryId') ?? '',
      sessionDate: formString(formData, 'sessionDate') ?? '',
      startTime: formString(formData, 'startTime') ?? '',
      endTime: formString(formData, 'endTime') ?? '',
      topic: formString(formData, 'topic'),
      notes: formString(formData, 'notes'),
    });
    revalidatePath('/attendance');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function cancelAttendanceSessionAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await cancelAttendanceSession(context!, {
      id: formString(formData, 'id') ?? '',
      reason: formString(formData, 'reason') ?? '',
    });
    revalidatePath('/attendance');
    return null;
  } catch (error) {
    return fail(error);
  }
}
