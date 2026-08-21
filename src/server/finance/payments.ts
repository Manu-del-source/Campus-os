import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import {
  createPaymentSchema,
  paymentListQuerySchema,
  type PaymentListQuery,
} from '@/server/finance/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentListRow {
  id: string;
  paymentNumber: string;
  reference: string | null;
  studentName: string;
  studentNumber: string;
  method: string;
  amount: number;
  currency: string;
  status: string;
  receivedAt: Date | null;
}

export interface PaymentListResult {
  rows: PaymentListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listPayments(
  context: AuthContext,
  raw: PaymentListQuery,
): Promise<PaymentListResult> {
  requirePermission(context, 'finance.payment');
  const query = paymentListQuerySchema.parse(raw);

  const where = {
    ...tenantWhere(context),
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.method ? { method: query.method } : {}),
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.search
      ? {
          OR: [
            { paymentNumber: { contains: query.search, mode: 'insensitive' as const } },
            { reference: { contains: query.search, mode: 'insensitive' as const } },
            { student: { firstName: { contains: query.search, mode: 'insensitive' as const } } },
            { student: { lastName: { contains: query.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        paymentNumber: true,
        reference: true,
        student: { select: { firstName: true, lastName: true, studentNumber: true } },
        method: true,
        amount: true,
        currency: true,
        status: true,
        receivedAt: true,
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: payments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      reference: p.reference,
      studentName: `${p.student.firstName} ${p.student.lastName}`,
      studentNumber: p.student.studentNumber,
      method: p.method,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      receivedAt: p.receivedAt,
    })),
  };
}

export async function getPaymentById(context: AuthContext, id: string) {
  requirePermission(context, 'finance.payment');

  const payment = await prisma.payment.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } },
      confirmedBy: { select: { firstName: true, lastName: true } },
      allocations: {
        select: {
          id: true,
          amount: true,
          allocatedAt: true,
          invoice: { select: { id: true, invoiceNumber: true, total: true, balance: true } },
        },
      },
      receipts: true,
    },
  });

  if (!payment) throw new TenantAccessError();
  return payment;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

async function generatePaymentNumber(institutionId: string): Promise<string> {
  const count = await prisma.payment.count({ where: { institutionId } });
  const seq = (count + 1).toString().padStart(6, '0');
  return `PAY-${seq}`;
}

export async function createPayment(context: AuthContext, raw: unknown) {
  requirePermission(context, 'finance.payment');
  const input = createPaymentSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  // Verify student
  const student = await prisma.student.findFirst({
    where: { id: input.studentId, institutionId, deletedAt: null },
  });
  if (!student) throw new DomainError('Student not found.');

  const paymentNumber = await generatePaymentNumber(institutionId);

  // Verify total allocations don't exceed payment amount
  if (input.allocations && input.allocations.length > 0) {
    const totalAllocated = input.allocations.reduce((sum, a) => sum + a.amount, 0);
    if (totalAllocated > input.amount) {
      throw new DomainError('Total allocations exceed payment amount.');
    }

    // Verify all invoices exist
    for (const alloc of input.allocations) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: alloc.invoiceId, institutionId, deletedAt: null },
      });
      if (!invoice) throw new DomainError(`Invoice ${alloc.invoiceId} not found.`);
      if (invoice.status === 'CANCELLED' || invoice.status === 'VOID') {
        throw new DomainError(`Cannot allocate to a ${invoice.status.toLowerCase()} invoice.`);
      }
    }
  }

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        institutionId,
        paymentNumber,
        studentId: input.studentId,
        reference: input.reference,
        method: input.method,
        amount: input.amount,
        status: 'PENDING',
        notes: input.notes,
        receivedAt: new Date(),
      },
    });

    // Create allocations if provided
    if (input.allocations && input.allocations.length > 0) {
      for (const alloc of input.allocations) {
        await tx.paymentAllocation.create({
          data: {
            institutionId,
            paymentId: p.id,
            invoiceId: alloc.invoiceId,
            amount: alloc.amount,
          },
        });
      }
    }

    return p;
  });

  await recordAudit(context, {
    action: 'payment.changed',
    entityType: 'Payment',
    entityId: payment.id,
    summary: `Payment ${paymentNumber} created (${input.method}: ${input.amount} ${student.studentNumber})`,
    metadata: { method: input.method, amount: input.amount, studentId: input.studentId },
  });

  return payment;
}

export async function confirmPayment(context: AuthContext, paymentId: string) {
  requirePermission(context, 'finance.payment');

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, ...tenantWhere(context), deletedAt: null },
    include: { allocations: true },
  });
  if (!payment) throw new TenantAccessError();

  if (payment.status !== 'PENDING') throw new DomainError('Only pending payments can be confirmed.');

  const updated = await prisma.$transaction(async (tx) => {
    // Confirm the payment
    const p = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        confirmedAt: new Date(),
        confirmedById: context.userId,
      },
    });

    // Update invoice balances
    for (const alloc of payment.allocations) {
      const invoice = await tx.invoice.findFirst({ where: { id: alloc.invoiceId } });
      if (!invoice) continue;

      const newAmountPaid = invoice.amountPaid + alloc.amount;
      const newBalance = invoice.total - newAmountPaid;
      const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';

      await tx.invoice.update({
        where: { id: alloc.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          balance: Math.max(0, newBalance),
          status: newStatus as 'PAID' | 'PARTIALLY_PAID',
        },
      });
    }

    // Create receipt
    const receiptCount = await tx.receipt.count({ where: { institutionId: payment.institutionId } });
    const receiptNumber = `RCP-${(receiptCount + 1).toString().padStart(6, '0')}`;

    await tx.receipt.create({
      data: {
        institutionId: payment.institutionId,
        paymentId: payment.id,
        receiptNumber,
      },
    });

    return p;
  });

  await recordAudit(context, {
    action: 'payment.changed',
    entityType: 'Payment',
    entityId: paymentId,
    summary: `Payment ${payment.paymentNumber} confirmed`,
  });

  return updated;
}

export async function voidPayment(context: AuthContext, paymentId: string, reason: string) {
  requirePermission(context, 'finance.payment');

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, ...tenantWhere(context), deletedAt: null },
    include: { allocations: true },
  });
  if (!payment) throw new TenantAccessError();

  if (payment.status !== 'COMPLETED') throw new DomainError('Only completed payments can be voided.');

  const updated = await prisma.$transaction(async (tx) => {
    // Void the payment
    const p = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'CANCELLED',
        voidedAt: new Date(),
        voidedReason: reason,
      },
    });

    // Reverse invoice balances
    for (const alloc of payment.allocations) {
      const invoice = await tx.invoice.findFirst({ where: { id: alloc.invoiceId } });
      if (!invoice) continue;

      const newAmountPaid = Math.max(0, invoice.amountPaid - alloc.amount);
      const newBalance = invoice.total - newAmountPaid;

      await tx.invoice.update({
        where: { id: alloc.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          balance: newBalance,
          status: 'PARTIALLY_PAID',
        },
      });
    }

    return p;
  });

  await recordAudit(context, {
    action: 'payment.changed',
    entityType: 'Payment',
    entityId: paymentId,
    summary: `Payment ${payment.paymentNumber} voided: ${reason}`,
    metadata: { reason },
  });

  return updated;
}
