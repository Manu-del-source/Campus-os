import 'server-only';

import { headers } from 'next/headers';

import { prisma } from '@/lib/db';
import type { AuthContext } from '@/lib/auth/types';

/**
 * Append-only audit trail.
 *
 * Writes go through this module only. Nothing in the application updates or
 * deletes audit rows, and reading them requires the `audit.read` permission
 * (or `platform.audit.read` for the platform trail).
 */

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password_reset_requested'
  | 'institution.created'
  | 'institution.updated'
  | 'institution.settings_updated'
  | 'user.invited'
  | 'user.updated'
  | 'user.role_changed'
  | 'role.permissions_changed'
  | 'student.created'
  | 'student.updated'
  | 'student.archived'
  | 'staff.created'
  | 'staff.updated'
  | 'admission.decided'
  | 'marks.changed'
  | 'results.approved'
  | 'results.published'
  | 'invoice.changed'
  | 'payment.changed';

export interface AuditInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
  /** Explicit tenant, for system events without a session. */
  institutionId?: string | null;
}

async function requestFingerprint(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  try {
    const headerList = await headers();
    const forwardedFor = headerList.get('x-forwarded-for');
    return {
      ipAddress: forwardedFor ? (forwardedFor.split(',')[0]?.trim() ?? null) : null,
      userAgent: headerList.get('user-agent'),
    };
  } catch {
    // Outside a request scope (e.g. background job or seed script).
    return { ipAddress: null, userAgent: null };
  }
}

export async function recordAudit(context: AuthContext | null, input: AuditInput): Promise<void> {
  const { ipAddress, userAgent } = await requestFingerprint();

  await prisma.auditLog.create({
    data: {
      institutionId: input.institutionId ?? context?.institutionId ?? null,
      actorUserId: context?.userId ?? null,
      actorType: context ? 'USER' : 'SYSTEM',
      actorLabel: context ? `${context.firstName} ${context.lastName}`.trim() : 'system',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary ?? null,
      metadata: (input.metadata ?? {}) as never,
      ipAddress,
      userAgent,
    },
  });
}
