import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import {
  createFeeStructureSchema,
  createFeeItemSchema,
  createInvoiceSchema,
  invoiceListQuerySchema,
  type InvoiceListQuery,
} from '@/server/finance/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoiceListRow {
  id: string;
  invoiceNumber: string;
  studentName: string;
  studentNumber: string;
  total: number;
  amountPaid: number;
  balance: number;
  currency: string;
  status: string;
  dueDate: Date | null;
  issuedAt: Date | null;
}

export interface InvoiceListResult {
  rows: InvoiceListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Fee Structure queries
// ---------------------------------------------------------------------------

export async function listFeeStructures(context: AuthContext) {
  requirePermission(context, 'finance.read');
  const where = tenantWhere(context);

  return prisma.feeStructure.findMany({
    where: { ...where, deletedAt: null },
    orderBy: [{ code: 'asc' }],
    include: {
      feeItems: { select: { id: true, code: true, name: true, amount: true, isMandatory: true }, orderBy: { sortOrder: 'asc' } },
      programme: { select: { code: true, name: true } },
      cohort: { select: { code: true, name: true } },
    },
  });
}

export async function createFeeStructure(context: AuthContext, raw: unknown) {
  requirePermission(context, 'finance.configure');
  const input = createFeeStructureSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.feeStructure.findFirst({
    where: { institutionId, code: input.code, deletedAt: null },
  });
  if (existing) throw new DomainError('A fee structure with this code already exists.');

  const structure = await prisma.feeStructure.create({
    data: { institutionId, ...input },
  });

  await recordAudit(context, {
    action: 'invoice.changed',
    entityType: 'FeeStructure',
    entityId: structure.id,
    summary: `Fee structure ${structure.code} created`,
  });

  return structure;
}

export async function createFeeItem(context: AuthContext, raw: unknown) {
  requirePermission(context, 'finance.configure');
  const input = createFeeItemSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const structure = await prisma.feeStructure.findFirst({
    where: { id: input.feeStructureId, institutionId, deletedAt: null },
  });
  if (!structure) throw new DomainError('Fee structure not found.');

  const item = await prisma.feeItem.create({
    data: { institutionId, ...input },
  });

  return item;
}

// ---------------------------------------------------------------------------
// Invoice queries
// ---------------------------------------------------------------------------

export async function listInvoices(
  context: AuthContext,
  raw: InvoiceListQuery,
): Promise<InvoiceListResult> {
  requirePermission(context, 'finance.read');
  const query = invoiceListQuerySchema.parse(raw);

  const where = {
    ...tenantWhere(context),
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.semesterId ? { semesterId: query.semesterId } : {}),
    ...(query.search
      ? {
          OR: [
            { invoiceNumber: { contains: query.search, mode: 'insensitive' as const } },
            { student: { firstName: { contains: query.search, mode: 'insensitive' as const } } },
            { student: { lastName: { contains: query.search, mode: 'insensitive' as const } } },
            { student: { studentNumber: { contains: query.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        invoiceNumber: true,
        student: { select: { firstName: true, lastName: true, studentNumber: true } },
        total: true,
        amountPaid: true,
        balance: true,
        currency: true,
        status: true,
        dueDate: true,
        issuedAt: true,
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      studentName: `${inv.student.firstName} ${inv.student.lastName}`,
      studentNumber: inv.student.studentNumber,
      total: inv.total,
      amountPaid: inv.amountPaid,
      balance: inv.balance,
      currency: inv.currency,
      status: inv.status,
      dueDate: inv.dueDate,
      issuedAt: inv.issuedAt,
    })),
  };
}

export async function getInvoiceById(context: AuthContext, id: string) {
  requirePermission(context, 'finance.read');

  const invoice = await prisma.invoice.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } },
      feeStructure: { select: { id: true, code: true, name: true } },
      semester: { select: { id: true, code: true, name: true } },
      items: { orderBy: { createdAt: 'asc' } },
      allocations: {
        select: { id: true, amount: true, allocatedAt: true, payment: { select: { id: true, paymentNumber: true, method: true, status: true } } },
      },
    },
  });

  if (!invoice) throw new TenantAccessError();
  return invoice;
}

// ---------------------------------------------------------------------------
// Invoice mutations
// ---------------------------------------------------------------------------

async function generateInvoiceNumber(institutionId: string): Promise<string> {
  const count = await prisma.invoice.count({ where: { institutionId } });
  const seq = (count + 1).toString().padStart(6, '0');
  return `INV-${seq}`;
}

export async function createInvoice(context: AuthContext, raw: unknown) {
  requirePermission(context, 'finance.invoice');
  const input = createInvoiceSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  // Verify student
  const student = await prisma.student.findFirst({
    where: { id: input.studentId, institutionId, deletedAt: null },
  });
  if (!student) throw new DomainError('Student not found.');

  const invoiceNumber = await generateInvoiceNumber(institutionId);

  // Calculate totals
  let subtotal = 0;
  for (const item of input.items) {
    const itemTotal = (item.quantity * item.unitPrice) - item.discount;
    subtotal += itemTotal;
  }

  const invoice = await prisma.invoice.create({
    data: {
      institutionId,
      invoiceNumber,
      studentId: input.studentId,
      feeStructureId: input.feeStructureId,
      semesterId: input.semesterId,
      subtotal,
      total: subtotal,
      balance: subtotal,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      issuedAt: new Date(),
      status: 'SENT',
      items: {
        create: input.items.map((item) => ({
          institutionId,
          feeItemId: item.feeItemId,
          code: item.code,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: (item.quantity * item.unitPrice) - item.discount,
        })),
      },
    },
  });

  await recordAudit(context, {
    action: 'invoice.changed',
    entityType: 'Invoice',
    entityId: invoice.id,
    summary: `Invoice ${invoiceNumber} created for ${student.studentNumber} (total: ${subtotal})`,
    metadata: { studentId: input.studentId, total: subtotal },
  });

  return invoice;
}

export async function cancelInvoice(context: AuthContext, id: string, reason: string) {
  requirePermission(context, 'finance.invoice');

  const invoice = await prisma.invoice.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
  });
  if (!invoice) throw new TenantAccessError();

  if (invoice.status === 'PAID') throw new DomainError('Cannot cancel a paid invoice.');
  if (invoice.amountPaid > 0) throw new DomainError('Cannot cancel an invoice with payments allocated.');

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledReason: reason,
    },
  });

  await recordAudit(context, {
    action: 'invoice.changed',
    entityType: 'Invoice',
    entityId: id,
    summary: `Invoice ${invoice.invoiceNumber} cancelled: ${reason}`,
    metadata: { reason },
  });

  return updated;
}
