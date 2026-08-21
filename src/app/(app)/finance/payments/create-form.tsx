'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { FormField, fieldClassName } from '@/components/ui/form-field';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  balance: number;
  studentId: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Processing…' : 'Record payment'}
    </Button>
  );
}

function MpesaSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="secondary">
      {pending ? 'Sending STK push…' : 'Send M-Pesa STK push'}
    </Button>
  );
}

export function CreatePaymentForm({
  students,
  invoices,
}: {
  students: Student[];
  invoices: Invoice[];
}) {
  const [state, formAction] = useActionState(
    async (prev: { ok: false; message: string } | null, formData: FormData) => {
      'use server';
      const { createPaymentAction } = await import('@/server/finance/form-actions');
      return createPaymentAction(prev, formData);
    },
    null,
  );

  const [mpesaState, mpesaFormAction] = useActionState(
    async (prev: { ok: false; message: string } | null, formData: FormData) => {
      'use server';
      const { initiateStkPushAction } = await import('@/server/finance/mpesa/form-actions');
      return initiateStkPushAction(prev, formData);
    },
    null,
  );

  return (
    <div className="space-y-6">
      {/* Manual payment */}
      <details className="group" open>
        <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
          Record manual payment (Cash / Bank Transfer / Cheque)
        </summary>
        <div className="mt-4">
          <form action={formAction} className="grid gap-4 sm:grid-cols-2">
            <FormField label="Student" htmlFor="studentId">
              <select id="studentId" name="studentId" required className={fieldClassName}>
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.studentNumber} — {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Payment method" htmlFor="method">
              <select id="method" name="method" required className={fieldClassName}>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>
            </FormField>
            <FormField label="Amount" htmlFor="amount">
              <input id="amount" name="amount" type="number" min="0.01" step="0.01" required className={fieldClassName} />
            </FormField>
            <FormField label="Reference" htmlFor="reference" hint="Optional — e.g. cheque number">
              <input id="reference" name="reference" maxLength={100} className={fieldClassName} />
            </FormField>
            <FormField label="Notes" htmlFor="notes" hint="Optional">
              <input id="notes" name="notes" maxLength={500} className={fieldClassName} />
            </FormField>

            {/* Invoice allocation */}
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium">Allocate to invoices (optional)</p>
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <label key={inv.id} className="flex items-center gap-3 text-sm">
                    <input type="checkbox" name={`allocInvoice_${inv.id}`} className="h-4 w-4" />
                    <span>{inv.invoiceNumber}</span>
                    <span className="text-[var(--color-muted-foreground)]">Balance: {inv.balance.toFixed(2)}</span>
                    <input
                      type="number"
                      name={`allocAmount_${inv.id}`}
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      className="w-24 rounded border border-[var(--color-border)] px-2 py-1 text-sm"
                    />
                  </label>
                ))}
              </div>
            </div>

            {state && (
              <p className="sm:col-span-2 text-sm text-[var(--color-danger)]">{state.message}</p>
            )}
            <div className="sm:col-span-2">
              <SubmitButton />
            </div>
          </form>
        </div>
      </details>

      {/* M-Pesa STK Push */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
          Send M-Pesa STK push
        </summary>
        <div className="mt-4">
          <form action={mpesaFormAction} className="grid gap-4 sm:grid-cols-2">
            <FormField label="Student" htmlFor="mpesaStudentId">
              <select id="mpesaStudentId" name="studentId" required className={fieldClassName}>
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.studentNumber} — {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Phone number" htmlFor="phoneNumber" hint="254XXXXXXXXX format">
              <input id="phoneNumber" name="phoneNumber" required pattern="254\d{9}" placeholder="254712345678" className={fieldClassName} />
            </FormField>
            <FormField label="Amount" htmlFor="mpesaAmount">
              <input id="mpesaAmount" name="amount" type="number" min="1" required className={fieldClassName} />
            </FormField>
            <FormField label="Account reference" htmlFor="accountReference" hint="Max 12 chars">
              <input id="accountReference" name="accountReference" maxLength={12} className={fieldClassName} />
            </FormField>

            {mpesaState && (
              <p className="sm:col-span-2 text-sm text-[var(--color-danger)]">{mpesaState.message}</p>
            )}
            <div className="sm:col-span-2">
              <MpesaSubmitButton />
            </div>
          </form>
        </div>
      </details>
    </div>
  );
}
