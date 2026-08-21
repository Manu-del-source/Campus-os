'use server';

import { revalidatePath } from 'next/cache';

import { isAuthorizationError, isDomainError } from '@/lib/auth/errors';
import { getCurrentUser } from '@/lib/auth/session';
import {
  createAssessment,
  submitMark,
} from '@/server/assessment/assessments';

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
// Assessment
// ---------------------------------------------------------------------------

export async function createAssessmentAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createAssessment(context!, {
      unitId: formString(formData, 'unitId') ?? '',
      semesterId: formString(formData, 'semesterId') ?? '',
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      description: formString(formData, 'description'),
      type: formString(formData, 'type') as 'EXAM' | 'ASSIGNMENT' | 'QUIZ' | 'PROJECT' | 'PRACTICAL' | 'COURSEWORK' | 'PRESENTATION' | 'OTHER',
      maxScore: Number(formString(formData, 'maxScore') ?? '100'),
      weight: Number(formString(formData, 'weight') ?? '0'),
      dueDate: formString(formData, 'dueDate'),
    });
    revalidatePath('/assessment');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function submitMarkAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await submitMark(context!, {
      assessmentId: formString(formData, 'assessmentId') ?? '',
      studentId: formString(formData, 'studentId') ?? '',
      score: Number(formString(formData, 'score') ?? '0'),
      feedback: formString(formData, 'feedback'),
    });
    revalidatePath('/assessment');
    return null;
  } catch (error) {
    return fail(error);
  }
}
