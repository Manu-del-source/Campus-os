'use server';

import { revalidatePath } from 'next/cache';

import { isAuthorizationError, isDomainError } from '@/lib/auth/errors';
import { getCurrentUser } from '@/lib/auth/session';
import {
  createRoom,
  archiveRoom,
} from '@/server/timetable/rooms';
import {
  createTimetableEntry,
  archiveTimetableEntry,
} from '@/server/timetable/entries';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formNumber(formData: FormData, key: string): number | undefined {
  const value = formString(formData, key);
  return value ? Number(value) : undefined;
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
// Room
// ---------------------------------------------------------------------------

export async function createRoomAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createRoom(context!, {
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      building: formString(formData, 'building'),
      floor: formNumber(formData, 'floor'),
      capacity: formNumber(formData, 'capacity'),
      roomType: formString(formData, 'roomType'),
    });
    revalidatePath('/timetable/rooms');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function archiveRoomAction(formData: FormData): Promise<void> {
  const context = await getCurrentUser();
  await archiveRoom(context!, formString(formData, 'id') ?? '');
  revalidatePath('/timetable/rooms');
}

// ---------------------------------------------------------------------------
// Timetable Entry
// ---------------------------------------------------------------------------

export async function createTimetableEntryAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createTimetableEntry(context!, {
      semesterId: formString(formData, 'semesterId') ?? '',
      unitId: formString(formData, 'unitId') ?? '',
      staffId: formString(formData, 'staffId') ?? '',
      roomId: formString(formData, 'roomId') ?? '',
      groupId: formString(formData, 'groupId') ?? '',
      dayOfWeek: formString(formData, 'dayOfWeek') as 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY',
      startTime: formString(formData, 'startTime') ?? '',
      endTime: formString(formData, 'endTime') ?? '',
      weekStart: formNumber(formData, 'weekStart'),
      weekEnd: formNumber(formData, 'weekEnd'),
    });
    revalidatePath('/timetable');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function archiveTimetableEntryAction(formData: FormData): Promise<void> {
  const context = await getCurrentUser();
  await archiveTimetableEntry(context!, formString(formData, 'id') ?? '');
  revalidatePath('/timetable');
}
