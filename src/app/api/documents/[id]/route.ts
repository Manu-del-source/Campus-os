import { NextResponse } from 'next/server';

import { isAuthorizationError } from '@/lib/auth/errors';
import { getCurrentUser } from '@/lib/auth/session';
import { readDocumentBytes } from '@/server/documents/access';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const accessToken = url.searchParams.get('accessToken');
  const reference = url.searchParams.get('reference');

  try {
    const session = await getCurrentUser();
    const result = await readDocumentBytes({
      documentId: id,
      context: session,
      token,
      publicToken: accessToken && reference ? { applicationReference: reference, accessToken } : null,
    });

    return new NextResponse(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.fileName.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Resource not found.' }, { status: 404 });
  }
}
