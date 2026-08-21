import 'server-only';

import { DomainError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import {
  initiateStkPushSchema,
  mpesaCallbackSchema,
} from '@/server/finance/mpesa/schemas';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface MpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  shortCode: string;
  passkey: string;
  callbackUrl: string;
  environment: 'sandbox' | 'production';
}

function getConfig(): MpesaConfig {
  return {
    consumerKey: process.env.MPESA_CONSUMER_KEY ?? '',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? '',
    shortCode: process.env.MPESA_SHORTCODE ?? '',
    passkey: process.env.MPESA_PASSKEY ?? '',
    callbackUrl: process.env.MPESA_CALLBACK_URL ?? '',
    environment: (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') ?? 'sandbox',
  };
}

function getBaseUrl(config: MpesaConfig): string {
  return config.environment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

// ---------------------------------------------------------------------------
// Access token
// ---------------------------------------------------------------------------

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: MpesaConfig): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
  const baseUrl = getBaseUrl(config);

  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!response.ok) {
    throw new DomainError('Failed to obtain M-Pesa access token.');
  }

  const data = (await response.json()) as { access_token: string; expires_in: string };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000 - 60_000, // buffer 1 minute
  };

  return cachedToken.token;
}

// ---------------------------------------------------------------------------
// Password generation
// ---------------------------------------------------------------------------

function generatePassword(config: MpesaConfig, timestamp: string): string {
  const data = `${config.shortCode}${config.passkey}${timestamp}`;
  return Buffer.from(data).toString('base64');
}

// ---------------------------------------------------------------------------
// STK Push
// ---------------------------------------------------------------------------

export interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
}

export async function initiateStkPush(
  context: AuthContext,
  raw: unknown,
): Promise<StkPushResult> {
  const input = initiateStkPushSchema.parse(raw);
  const config = getConfig();

  if (!config.consumerKey || !config.consumerSecret) {
    throw new DomainError('M-Pesa credentials are not configured.');
  }

  // Verify the payment exists
  const payment = await prisma.payment.findFirst({
    where: { id: input.paymentId, ...(context.institutionId ? { institutionId: context.institutionId } : {}), deletedAt: null },
  });
  if (!payment) throw new DomainError('Payment not found.');

  if (payment.status !== 'PENDING') throw new DomainError('Only pending payments can be processed via M-Pesa.');

  const accessToken = await getAccessToken(config);
  const baseUrl = getBaseUrl(config);
  const timestamp = formatTimestamp(new Date());
  const password = generatePassword(config, timestamp);

  const body = {
    BusinessShortCode: config.shortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(input.amount),
    PartyA: input.phoneNumber,
    PartyB: config.shortCode,
    PhoneNumber: input.phoneNumber,
    CallBackURL: `${config.callbackUrl}/api/mpesa/callback`,
    AccountReference: input.accountReference ?? payment.paymentNumber,
    TransactionDesc: input.transactionDescription ?? `Payment ${payment.paymentNumber}`,
  };

  const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as {
    MerchantRequestID?: string;
    CheckoutRequestID?: string;
    ResponseCode?: string;
    ResponseDescription?: string;
    errorMessage?: string;
  };

  if (!response.ok || data.ResponseCode !== '0') {
    throw new DomainError(data.errorMessage ?? data.ResponseDescription ?? 'STK push failed.');
  }

  // Update payment reference with checkout request ID
  await prisma.payment.update({
    where: { id: input.paymentId },
    data: { reference: data.CheckoutRequestID },
  });

  await recordAudit(context, {
    action: 'payment.changed',
    entityType: 'Payment',
    entityId: input.paymentId,
    summary: `M-Pesa STK push initiated for ${input.phoneNumber}`,
    metadata: { checkoutRequestId: data.CheckoutRequestID, amount: input.amount },
  });

  return {
    merchantRequestId: data.MerchantRequestID ?? '',
    checkoutRequestId: data.CheckoutRequestID ?? '',
    responseCode: data.ResponseCode ?? '',
    responseDescription: data.ResponseDescription ?? '',
  };
}

// ---------------------------------------------------------------------------
// Callback handler
// ---------------------------------------------------------------------------

export async function handleMpesaCallback(payload: unknown): Promise<void> {
  const parsed = mpesaCallbackSchema.parse(payload);
  const { stkCallback } = parsed.Body;

  // Find the payment by checkout request ID
  const payment = await prisma.payment.findFirst({
    where: { reference: stkCallback.CheckoutRequestID },
  });

  if (!payment) {
    // Payment not found — log and return (idempotent)
    console.warn(`M-Pesa callback for unknown checkout: ${stkCallback.CheckoutRequestID}`);
    return;
  }

  if (payment.status === 'COMPLETED') {
    // Already processed — idempotent
    return;
  }

  if (stkCallback.ResultCode === 0) {
    // Success — extract metadata
    const metadata = stkCallback.CallbackMetadata?.Item ?? [];
    const mpesaReceipt = metadata.find((item) => item.Name === 'MpesaReceiptNumber')?.Value as string;
    // transactionDate and phoneNumber available in metadata if needed

    // Confirm the payment
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        reference: mpesaReceipt ?? stkCallback.CheckoutRequestID,
        confirmedAt: new Date(),
        notes: `M-Pesa receipt: ${mpesaReceipt}`,
      },
    });

    // Update invoice balances (same logic as manual confirmation)
    const allocations = await prisma.paymentAllocation.findMany({
      where: { paymentId: payment.id },
    });

    for (const alloc of allocations) {
      const invoice = await prisma.invoice.findFirst({ where: { id: alloc.invoiceId } });
      if (!invoice) continue;

      const newAmountPaid = invoice.amountPaid + alloc.amount;
      const newBalance = invoice.total - newAmountPaid;
      const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';

      await prisma.invoice.update({
        where: { id: alloc.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          balance: Math.max(0, newBalance),
          status: newStatus as 'PAID' | 'PARTIALLY_PAID',
        },
      });
    }

    // Create receipt
    const receiptCount = await prisma.receipt.count({ where: { institutionId: payment.institutionId } });
    const receiptNumber = `RCP-${(receiptCount + 1).toString().padStart(6, '0')}`;

    await prisma.receipt.create({
      data: {
        institutionId: payment.institutionId,
        paymentId: payment.id,
        receiptNumber,
        notes: `M-Pesa receipt: ${mpesaReceipt}`,
      },
    });

    console.log(`M-Pesa payment ${payment.paymentNumber} confirmed via callback`);
  } else {
    // Failed
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        notes: `M-Pesa error: ${stkCallback.ResultDesc}`,
      },
    });

    console.warn(`M-Pesa payment ${payment.paymentNumber} failed: ${stkCallback.ResultDesc}`);
  }
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

export async function reconcileMpesaTransaction(
  context: AuthContext,
  checkoutRequestId: string,
): Promise<{ found: boolean; paymentId: string | null; status: string }> {
  const config = getConfig();

  if (!config.consumerKey || !config.consumerSecret) {
    throw new DomainError('M-Pesa credentials are not configured.');
  }

  const accessToken = await getAccessToken(config);
  const baseUrl = getBaseUrl(config);
  const timestamp = formatTimestamp(new Date());
  const password = generatePassword(config, timestamp);

  const response = await fetch(`${baseUrl}/mpesa/transactionstatus/v1/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: config.shortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });

  if (!response.ok) {
    throw new DomainError('Failed to query M-Pesa transaction status.');
  }

  // Response contains ResultCode and ResultDesc — we primarily reconcile against local state
  await response.json();

  const payment = await prisma.payment.findFirst({
    where: { reference: checkoutRequestId },
    select: { id: true, status: true },
  });

  return {
    found: !!payment,
    paymentId: payment?.id ?? null,
    status: payment?.status ?? 'UNKNOWN',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}${h}${min}${s}`;
}
