'use server';

import { revalidatePath } from 'next/cache';

import { isAuthorizationError, isDomainError } from '@/lib/auth/errors';
import { getCurrentUser } from '@/lib/auth/session';
import {
  createFeeStructure,
  createInvoice,
} from '@/server/finance/invoices';
import {
  createPayment,
  confirmPayment,
  voidPayment,
} from '@/server/finance/payments';

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
// Fee Structure
// ---------------------------------------------------------------------------

export async function createFeeStructureAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createFeeStructure(context!, {
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      description: formString(formData, 'description'),
      programmeId: formString(formData, 'programmeId'),
      cohortId: formString(formData, 'cohortId'),
      academicYearId: formString(formData, 'academicYearId'),
    });
    revalidatePath('/finance/fee-structures');
    return null;
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------

export async function createInvoiceAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();

    // Parse line items from form data
    const items: { code: string; name: string; quantity: number; unitPrice: number; discount: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const code = formString(formData, `itemCode_${i}`);
      const name = formString(formData, `itemName_${i}`);
      if (code && name) {
        items.push({
          code,
          name,
          quantity: Number(formString(formData, `itemQty_${i}`) ?? '1'),
          unitPrice: Number(formString(formData, `itemPrice_${i}`) ?? '0'),
          discount: Number(formString(formData, `itemDiscount_${i}`) ?? '0'),
        });
      }
    }

    await createInvoice(context!, {
      studentId: formString(formData, 'studentId') ?? '',
      feeStructureId: formString(formData, 'feeStructureId'),
      semesterId: formString(formData, 'semesterId'),
      dueDate: formString(formData, 'dueDate'),
      items,
    });
    revalidatePath('/finance/invoices');
    return null;
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

export async function createPaymentAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();

    // Parse allocations from form data
    const allocations: { invoiceId: string; amount: number }[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('allocInvoice_') && value === 'on') {
        const invoiceId = key.replace('allocInvoice_', '');
        const amountKey = `allocAmount_${invoiceId}`;
        const amount = Number(formData.get(amountKey) ?? '0');
        if (amount > 0) {
          allocations.push({ invoiceId, amount });
        }
      }
    }

    await createPayment(context!, {
      studentId: formString(formData, 'studentId') ?? '',
      method: formString(formData, 'method') as 'CASH' | 'BANK_TRANSFER' | 'MPESA' | 'CARD' | 'CHEQUE' | 'OTHER',
      amount: Number(formString(formData, 'amount') ?? '0'),
      reference: formString(formData, 'reference'),
      notes: formString(formData, 'notes'),
      allocations: allocations.length > 0 ? allocations : undefined,
    });
    revalidatePath('/finance/payments');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function confirmPaymentAction(formData: FormData): Promise<void> {
  const context = await getCurrentUser();
  await confirmPayment(context!, formString(formData, 'id') ?? '');
  revalidatePath('/finance/payments');
}

export async function voidPaymentAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await voidPayment(
      context!,
      formString(formData, 'id') ?? '',
      formString(formData, 'reason') ?? '',
    );
    revalidatePath('/finance/payments');
    return null;
  } catch (error) {
    return fail(error);
  }
}
