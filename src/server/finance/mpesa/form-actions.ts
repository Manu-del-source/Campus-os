'use server';

import { revalidatePath } from 'next/cache';

import { isAuthorizationError, isDomainError } from '@/lib/auth/errors';
import { getCurrentUser } from '@/lib/auth/session';
import { initiateStkPush } from '@/server/finance/mpesa/service';

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
// STK Push
// ---------------------------------------------------------------------------

export async function initiateStkPushAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await initiateStkPush(context!, {
      paymentId: formString(formData, 'paymentId') ?? '',
      phoneNumber: formString(formData, 'phoneNumber') ?? '',
      amount: Number(formString(formData, 'amount') ?? '0'),
      accountReference: formString(formData, 'accountReference'),
      transactionDescription: formString(formData, 'transactionDescription'),
    });
    revalidatePath('/finance/payments');
    return null;
  } catch (error) {
    return fail(error);
  }
}
