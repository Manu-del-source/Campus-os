import { z } from 'zod';

// ---------------------------------------------------------------------------
// M-Pesa STK Push (Lipa Na M-Pesa Online)
// ---------------------------------------------------------------------------

export const initiateStkPushSchema = z.object({
  paymentId: z.string().uuid(),
  /** MSISDN in international format: 2547XXXXXXXX */
  phoneNumber: z.string().regex(/^254\d{9}$/, 'Phone must be in 254XXXXXXXXX format'),
  amount: z.number().min(1),
  /** Account reference shown to the user on their phone */
  accountReference: z.string().max(12).optional(),
  /** Description shown to the user on their phone */
  transactionDescription: z.string().max(13).optional(),
});

export type InitiateStkPushInput = z.infer<typeof initiateStkPushSchema>;

// ---------------------------------------------------------------------------
// M-Pesa callback payload
// ---------------------------------------------------------------------------

export const mpesaCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.number(),
      ResultDesc: z.string(),
      CallbackMetadata: z
        .object({
          Item: z.array(
            z.object({
              Name: z.string(),
              Value: z.union([z.string(), z.number()]),
            }),
          ),
        })
        .optional(),
    }),
  }),
});

export type MpesaCallbackPayload = z.infer<typeof mpesaCallbackSchema>;

// ---------------------------------------------------------------------------
// Transaction query
// ---------------------------------------------------------------------------

export const mpesaTransactionQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
});

export type MpesaTransactionQuery = z.infer<typeof mpesaTransactionQuerySchema>;
