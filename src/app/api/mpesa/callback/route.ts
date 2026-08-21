import { NextResponse } from 'next/server';

import { handleMpesaCallback } from '@/server/finance/mpesa/service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await handleMpesaCallback(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    // Always return 200 to Safaricom to prevent retries
    return NextResponse.json({ ok: true });
  }
}
