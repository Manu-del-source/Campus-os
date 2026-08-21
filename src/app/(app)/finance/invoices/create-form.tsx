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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create invoice'}
    </Button>
  );
}

export function CreateInvoiceForm({ students }: { students: Student[] }) {
  const [state, formAction] = useActionState(
    async (prev: { ok: false; message: string } | null, formData: FormData) => {
      'use server';
      const { createInvoiceAction } = await import('@/server/finance/form-actions');
      return createInvoiceAction(prev, formData);
    },
    null,
  );

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)] hover:underline">
        Create a new invoice
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
          <FormField label="Due date" htmlFor="dueDate" hint="Optional">
            <input id="dueDate" name="dueDate" type="date" className={fieldClassName} />
          </FormField>

          {/* Invoice items */}
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium">Line items</p>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-[var(--color-muted-foreground)]">
                <div className="col-span-2">Code</div>
                <div className="col-span-4">Name</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Unit Price</div>
                <div className="col-span-2">Discount</div>
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input name={`itemCode_${i}`} placeholder="Code" className="col-span-2 rounded border border-[var(--color-border)] px-2 py-1.5 text-sm" />
                  <input name={`itemName_${i}`} placeholder="Name" className="col-span-4 rounded border border-[var(--color-border)] px-2 py-1.5 text-sm" />
                  <input name={`itemQty_${i}`} type="number" min="1" defaultValue="1" className="col-span-2 rounded border border-[var(--color-border)] px-2 py-1.5 text-sm" />
                  <input name={`itemPrice_${i}`} type="number" min="0" step="0.01" placeholder="0.00" className="col-span-2 rounded border border-[var(--color-border)] px-2 py-1.5 text-sm" />
                  <input name={`itemDiscount_${i}`} type="number" min="0" step="0.01" defaultValue="0" className="col-span-2 rounded border border-[var(--color-border)] px-2 py-1.5 text-sm" />
                </div>
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
  );
}
