import 'server-only';

import { z } from 'zod';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const updateInstitutionProfileSchema = z.object({
  name: z.string().trim().min(1).max(200),
  shortName: z.string().trim().max(60).optional(),
  type: z.enum(['TVET', 'TECHNICAL_COLLEGE', 'NATIONAL_POLYTECHNIC', 'UNIVERSITY_COLLEGE', 'PRIVATE_COLLEGE', 'OTHER']).optional(),
  registrationNumber: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional(),
  websiteUrl: z.string().trim().url().max(200).optional().or(z.literal('')),
  addressLine1: z.string().trim().max(160).optional(),
  addressLine2: z.string().trim().max(160).optional(),
  city: z.string().trim().max(80).optional(),
  county: z.string().trim().max(80).optional(),
  country: z.string().trim().min(2).max(4).optional(),
  postalCode: z.string().trim().max(20).optional(),
  timezone: z.string().trim().min(1).max(60).optional(),
  currency: z.string().trim().min(3).max(5).optional(),
  locale: z.string().trim().min(2).max(10).optional(),
});

export type UpdateInstitutionProfileInput = z.infer<typeof updateInstitutionProfileSchema>;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getInstitutionProfile(context: AuthContext) {
  requirePermission(context, 'institution.read');
  const institutionId = tenantWhere(context).institutionId;

  const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (!institution) throw new TenantAccessError();
  return institution;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function updateInstitutionProfile(context: AuthContext, raw: unknown) {
  requirePermission(context, 'institution.update');
  const input = updateInstitutionProfileSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (!existing) throw new TenantAccessError();

  const institution = await prisma.institution.update({
    where: { id: institutionId },
    data: {
      name: input.name,
      shortName: input.shortName || null,
      type: input.type ?? existing.type,
      registrationNumber: input.registrationNumber || null,
      email: input.email || null,
      phone: input.phone || null,
      websiteUrl: input.websiteUrl || null,
      addressLine1: input.addressLine1 || null,
      addressLine2: input.addressLine2 || null,
      city: input.city || null,
      county: input.county || null,
      country: input.country ?? existing.country,
      postalCode: input.postalCode || null,
      timezone: input.timezone ?? existing.timezone,
      currency: input.currency ?? existing.currency,
      locale: input.locale ?? existing.locale,
    },
  });

  await recordAudit(context, {
    action: 'institution.updated',
    entityType: 'Institution',
    entityId: institution.id,
    summary: `Institution profile updated`,
  });

  return institution;
}
