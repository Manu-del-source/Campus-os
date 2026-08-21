import { z } from 'zod';

// ---------------------------------------------------------------------------
// Fee Structure schemas
// ---------------------------------------------------------------------------

export const createFeeStructureSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional(),
  programmeId: z.string().uuid().optional(),
  cohortId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
});

export const createFeeItemSchema = z.object({
  feeStructureId: z.string().uuid(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional(),
  amount: z.number().min(0),
  isMandatory: z.boolean().default(true),
  isRecurring: z.boolean().default(false),
  recurringPeriod: z.string().max(40).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Invoice schemas
// ---------------------------------------------------------------------------

export const createInvoiceSchema = z.object({
  studentId: z.string().uuid(),
  feeStructureId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
  items: z.array(
    z.object({
      feeItemId: z.string().uuid().optional(),
      code: z.string().trim().min(1).max(40),
      name: z.string().trim().min(1).max(200),
      description: z.string().max(500).optional(),
      quantity: z.number().int().min(1).default(1),
      unitPrice: z.number().min(0),
      discount: z.number().min(0).default(0),
    }),
  ).min(1, 'At least one item is required'),
});

// ---------------------------------------------------------------------------
// Payment schemas
// ---------------------------------------------------------------------------

export const createPaymentSchema = z.object({
  studentId: z.string().uuid(),
  reference: z.string().max(100).optional(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'MPESA', 'CARD', 'CHEQUE', 'OTHER']),
  amount: z.number().min(0.01),
  notes: z.string().max(500).optional(),
  allocations: z.array(
    z.object({
      invoiceId: z.string().uuid(),
      amount: z.number().min(0.01),
    }),
  ).optional(),
});

// ---------------------------------------------------------------------------
// List query schemas
// ---------------------------------------------------------------------------

export const invoiceListQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED', 'VOID']).optional(),
  studentId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
});

export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;

export const paymentListQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED']).optional(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'MPESA', 'CARD', 'CHEQUE', 'OTHER']).optional(),
  studentId: z.string().uuid().optional(),
});

export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;

export const feeStructureListQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type FeeStructureListQuery = z.infer<typeof feeStructureListQuerySchema>;
