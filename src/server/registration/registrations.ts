import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import {
  createRegistrationSchema,
  updateRegistrationStatusSchema,
  registrationListQuerySchema,
  type RegistrationListQuery,
} from '@/server/registration/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegistrationListRow {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  semesterId: string;
  semesterCode: string;
  semesterName: string;
  status: string;
  registeredAt: Date;
}

export interface RegistrationListResult {
  rows: RegistrationListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listRegistrations(
  context: AuthContext,
  raw: RegistrationListQuery,
): Promise<RegistrationListResult> {
  requirePermission(context, 'units.read');
  const query = registrationListQuerySchema.parse(raw);

  const where = {
    ...tenantWhere(context),
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.semesterId ? { semesterId: query.semesterId } : {}),
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.unitId ? { unitId: query.unitId } : {}),
    ...(query.search
      ? {
          OR: [
            { student: { firstName: { contains: query.search, mode: 'insensitive' as const } } },
            { student: { lastName: { contains: query.search, mode: 'insensitive' as const } } },
            { student: { studentNumber: { contains: query.search, mode: 'insensitive' as const } } },
            { unit: { code: { contains: query.search, mode: 'insensitive' as const } } },
            { unit: { name: { contains: query.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [total, registrations] = await Promise.all([
    prisma.unitRegistration.count({ where }),
    prisma.unitRegistration.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        studentId: true,
        student: { select: { firstName: true, lastName: true, studentNumber: true } },
        unitId: true,
        unit: { select: { code: true, name: true } },
        semesterId: true,
        semester: { select: { code: true, name: true } },
        status: true,
        registeredAt: true,
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: registrations.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.student.firstName} ${r.student.lastName}`,
      studentNumber: r.student.studentNumber,
      unitId: r.unitId,
      unitCode: r.unit.code,
      unitName: r.unit.name,
      semesterId: r.semesterId,
      semesterCode: r.semester.code,
      semesterName: r.semester.name,
      status: r.status,
      registeredAt: r.registeredAt,
    })),
  };
}

export async function getRegistrationById(context: AuthContext, id: string) {
  requirePermission(context, 'units.read');

  const registration = await prisma.unitRegistration.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } },
      unit: { select: { id: true, code: true, name: true } },
      semester: { select: { id: true, code: true, name: true } },
    },
  });

  if (!registration) throw new TenantAccessError();
  return registration;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createRegistration(context: AuthContext, raw: unknown) {
  requirePermission(context, 'units.manage');
  const input = createRegistrationSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  // Verify student belongs to this institution
  const student = await prisma.student.findFirst({
    where: { id: input.studentId, institutionId, deletedAt: null },
  });
  if (!student) throw new DomainError('Student not found.');

  // Verify unit belongs to this institution
  const unit = await prisma.unit.findFirst({
    where: { id: input.unitId, institutionId, deletedAt: null },
  });
  if (!unit) throw new DomainError('Unit not found.');

  // Verify semester belongs to this institution
  const semester = await prisma.semester.findFirst({
    where: { id: input.semesterId, institutionId },
  });
  if (!semester) throw new DomainError('Semester not found.');

  // Check for duplicate registration
  const existing = await prisma.unitRegistration.findFirst({
    where: {
      institutionId,
      studentId: input.studentId,
      unitId: input.unitId,
      semesterId: input.semesterId,
      deletedAt: null,
    },
  });
  if (existing) throw new DomainError('This student is already registered for this unit in this semester.');

  // Check capacity (if unit has a max registration limit — optional)
  // Could add capacity checks here if needed

  const registration = await prisma.unitRegistration.create({
    data: {
      institutionId,
      studentId: input.studentId,
      unitId: input.unitId,
      semesterId: input.semesterId,
      status: 'PENDING',
    },
  });

  await recordAudit(context, {
    action: 'registration.created',
    entityType: 'UnitRegistration',
    entityId: registration.id,
    summary: `Registration created for student ${student.studentNumber} in unit ${unit.code}`,
    metadata: { studentId: input.studentId, unitId: input.unitId, semesterId: input.semesterId },
  });

  return registration;
}

export async function updateRegistrationStatus(context: AuthContext, raw: unknown) {
  requirePermission(context, 'units.manage');
  const input = updateRegistrationStatusSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.unitRegistration.findFirst({
    where: { id: input.id, institutionId, deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  const data: Record<string, unknown> = { status: input.status };

  if (input.status === 'DROPPED') {
    data.droppedAt = new Date();
    data.dropReason = input.reason;
  } else if (input.status === 'WITHDRAWN') {
    data.withdrawAt = new Date();
    data.withdrawReason = input.reason;
  }

  const registration = await prisma.unitRegistration.update({
    where: { id: input.id },
    data,
  });

  await recordAudit(context, {
    action: 'registration.status_changed',
    entityType: 'UnitRegistration',
    entityId: registration.id,
    summary: `Registration status changed to ${input.status}`,
    metadata: { status: input.status, reason: input.reason },
  });

  return registration;
}

export async function dropRegistration(context: AuthContext, id: string) {
  requirePermission(context, 'units.manage');
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.unitRegistration.findFirst({
    where: { id, institutionId, deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  const registration = await prisma.unitRegistration.update({
    where: { id },
    data: { status: 'DROPPED', droppedAt: new Date() },
  });

  await recordAudit(context, {
    action: 'registration.dropped',
    entityType: 'UnitRegistration',
    entityId: registration.id,
    summary: 'Registration dropped',
  });

  return registration;
}
