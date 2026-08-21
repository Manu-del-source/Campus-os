import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import {
  createAssessmentSchema,
  updateAssessmentSchema,
  submitMarkSchema,
  batchSubmitMarksSchema,
  calculateResultSchema,
  assessmentListQuerySchema,
  type AssessmentListQuery,
} from '@/server/assessment/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssessmentListRow {
  id: string;
  code: string;
  name: string;
  type: string;
  maxScore: number;
  weight: number;
  status: string;
  dueDate: Date | null;
  unitCode: string;
  semesterCode: string;
}

export interface AssessmentListResult {
  rows: AssessmentListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listAssessments(
  context: AuthContext,
  raw: AssessmentListQuery,
): Promise<AssessmentListResult> {
  requirePermission(context, 'marks.read');
  const query = assessmentListQuerySchema.parse(raw);

  const where = {
    ...tenantWhere(context),
    deletedAt: null,
    ...(query.unitId ? { unitId: query.unitId } : {}),
    ...(query.semesterId ? { semesterId: query.semesterId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search, mode: 'insensitive' as const } },
            { name: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, assessments] = await Promise.all([
    prisma.assessment.count({ where }),
    prisma.assessment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        maxScore: true,
        weight: true,
        status: true,
        dueDate: true,
        unit: { select: { code: true } },
        semester: { select: { code: true } },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: assessments.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      maxScore: a.maxScore,
      weight: a.weight,
      status: a.status,
      dueDate: a.dueDate,
      unitCode: a.unit.code,
      semesterCode: a.semester.code,
    })),
  };
}

export async function getAssessmentById(context: AuthContext, id: string) {
  requirePermission(context, 'marks.read');

  const assessment = await prisma.assessment.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
    include: {
      unit: { select: { id: true, code: true, name: true } },
      semester: { select: { id: true, code: true, name: true } },
      marks: {
        select: {
          id: true,
          student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } },
          score: true,
          percentage: true,
          grade: true,
          status: true,
          feedback: true,
          gradedBy: { select: { firstName: true, lastName: true } },
          gradedAt: true,
        },
        orderBy: { student: { lastName: 'asc' } },
      },
    },
  });

  if (!assessment) throw new TenantAccessError();
  return assessment;
}

// ---------------------------------------------------------------------------
// Assessment mutations
// ---------------------------------------------------------------------------

export async function createAssessment(context: AuthContext, raw: unknown) {
  requirePermission(context, 'marks.enter');
  const input = createAssessmentSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  // Verify unit and semester exist
  const [unit, semester] = await Promise.all([
    prisma.unit.findFirst({ where: { id: input.unitId, institutionId, deletedAt: null } }),
    prisma.semester.findFirst({ where: { id: input.semesterId, institutionId } }),
  ]);
  if (!unit) throw new DomainError('Unit not found.');
  if (!semester) throw new DomainError('Semester not found.');

  // Check duplicate code
  const existing = await prisma.assessment.findFirst({
    where: { institutionId, unitId: input.unitId, semesterId: input.semesterId, code: input.code, deletedAt: null },
  });
  if (existing) throw new DomainError('An assessment with this code already exists for this unit and semester.');

  const assessment = await prisma.assessment.create({
    data: {
      institutionId,
      ...input,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    },
  });

  await recordAudit(context, {
    action: 'assessment.created',
    entityType: 'Assessment',
    entityId: assessment.id,
    summary: `Assessment ${assessment.code} created for ${unit.code}`,
    metadata: { unitId: input.unitId, semesterId: input.semesterId, type: input.type },
  });

  return assessment;
}

export async function updateAssessment(context: AuthContext, raw: unknown) {
  requirePermission(context, 'marks.enter');
  const input = updateAssessmentSchema.parse(raw);

  const existing = await prisma.assessment.findFirst({
    where: { id: input.id, ...tenantWhere(context), deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  const { id, ...data } = input;
  const assessment = await prisma.assessment.update({
    where: { id },
    data: {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    },
  });

  await recordAudit(context, {
    action: 'assessment.updated',
    entityType: 'Assessment',
    entityId: assessment.id,
    summary: `Assessment ${assessment.code} updated`,
  });

  return assessment;
}

// ---------------------------------------------------------------------------
// Mark mutations
// ---------------------------------------------------------------------------

export async function submitMark(context: AuthContext, raw: unknown) {
  requirePermission(context, 'marks.enter');
  const input = submitMarkSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const assessment = await prisma.assessment.findFirst({
    where: { id: input.assessmentId, institutionId, deletedAt: null },
  });
  if (!assessment) throw new DomainError('Assessment not found.');

  // Calculate percentage
  const percentage = (input.score / assessment.maxScore) * 100;

  const mark = await prisma.mark.upsert({
    where: {
      institutionId_assessmentId_studentId: {
        institutionId,
        assessmentId: input.assessmentId,
        studentId: input.studentId,
      },
    },
    update: {
      score: input.score,
      percentage,
      feedback: input.feedback,
      gradedById: context.userId,
      gradedAt: new Date(),
      status: 'DRAFT',
    },
    create: {
      institutionId,
      assessmentId: input.assessmentId,
      studentId: input.studentId,
      score: input.score,
      percentage,
      feedback: input.feedback,
      gradedById: context.userId,
      gradedAt: new Date(),
      status: 'DRAFT',
    },
  });

  return mark;
}

export async function batchSubmitMarks(context: AuthContext, raw: unknown) {
  requirePermission(context, 'marks.enter');
  const input = batchSubmitMarksSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const assessment = await prisma.assessment.findFirst({
    where: { id: input.assessmentId, institutionId, deletedAt: null },
  });
  if (!assessment) throw new DomainError('Assessment not found.');

  const results = [];
  for (const m of input.marks) {
    const percentage = (m.score / assessment.maxScore) * 100;

    const mark = await prisma.mark.upsert({
      where: {
        institutionId_assessmentId_studentId: {
          institutionId,
          assessmentId: input.assessmentId,
          studentId: m.studentId,
        },
      },
      update: {
        score: m.score,
        percentage,
        feedback: m.feedback,
        gradedById: context.userId,
        gradedAt: new Date(),
        status: 'DRAFT',
      },
      create: {
        institutionId,
        assessmentId: input.assessmentId,
        studentId: m.studentId,
        score: m.score,
        percentage,
        feedback: m.feedback,
        gradedById: context.userId,
        gradedAt: new Date(),
        status: 'DRAFT',
      },
    });
    results.push(mark);
  }

  await recordAudit(context, {
    action: 'marks.batch_submitted',
    entityType: 'Assessment',
    entityId: input.assessmentId,
    summary: `Batch marks submitted for ${results.length} students`,
    metadata: { count: results.length },
  });

  return results;
}

// ---------------------------------------------------------------------------
// Result calculations
// ---------------------------------------------------------------------------

export async function calculateResult(context: AuthContext, raw: unknown) {
  requirePermission(context, 'results.approve');
  const input = calculateResultSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  // Get all assessments for this unit/semester
  const assessments = await prisma.assessment.findMany({
    where: { institutionId, unitId: input.unitId, semesterId: input.semesterId, deletedAt: null },
    select: { id: true, maxScore: true, weight: true, type: true },
  });

  if (assessments.length === 0) throw new DomainError('No assessments found for this unit and semester.');

  // Get all marks for this student in these assessments
  const marks = await prisma.mark.findMany({
    where: {
      institutionId,
      studentId: input.studentId,
      assessmentId: { in: assessments.map((a) => a.id) },
    },
    select: { assessmentId: true, score: true, percentage: true },
  });

  // Calculate weighted total
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const assessment of assessments) {
    const mark = marks.find((m) => m.assessmentId === assessment.id);
    if (mark && mark.percentage !== null) {
      totalWeightedScore += mark.percentage * (assessment.weight / 100);
      totalWeight += assessment.weight;
    }
  }

  const percentage = totalWeight > 0 ? totalWeightedScore / (totalWeight / 100) : 0;
  const totalScore = marks.reduce((sum, m) => sum + (m.score ?? 0), 0);

  // Determine grade based on percentage (simplified — should use institution grading config)
  let grade = 'F';
  if (percentage >= 80) grade = 'A';
  else if (percentage >= 70) grade = 'B';
  else if (percentage >= 60) grade = 'C';
  else if (percentage >= 50) grade = 'D';
  else if (percentage >= 40) grade = 'E';

  // Calculate GPA (simplified)
  const gpaMap: Record<string, number> = { A: 4.0, B: 3.0, C: 2.0, D: 1.0, E: 0.5, F: 0 };
  const gpa = gpaMap[grade] ?? 0;

  // Upsert result
  const result = await prisma.result.upsert({
    where: {
      institutionId_studentId_unitId_semesterId: {
        institutionId,
        studentId: input.studentId,
        unitId: input.unitId,
        semesterId: input.semesterId,
      },
    },
    update: {
      totalScore,
      percentage: Math.round(percentage * 10) / 10,
      grade,
      gpa,
      status: 'CALCULATED',
      calculatedAt: new Date(),
    },
    create: {
      institutionId,
      studentId: input.studentId,
      unitId: input.unitId,
      semesterId: input.semesterId,
      totalScore,
      percentage: Math.round(percentage * 10) / 10,
      grade,
      gpa,
      status: 'CALCULATED',
      calculatedAt: new Date(),
    },
  });

  await recordAudit(context, {
    action: 'result.calculated',
    entityType: 'Result',
    entityId: result.id,
    summary: `Result calculated: ${grade} (${percentage.toFixed(1)}%)`,
    metadata: { percentage, grade, gpa },
  });

  return result;
}

export async function verifyResult(context: AuthContext, resultId: string) {
  requirePermission(context, 'results.verify');

  const result = await prisma.result.findFirst({
    where: { id: resultId, ...tenantWhere(context) },
  });
  if (!result) throw new TenantAccessError();

  const updated = await prisma.result.update({
    where: { id: resultId },
    data: {
      status: 'VERIFIED',
      verifiedById: context.userId,
      verifiedAt: new Date(),
    },
  });

  await recordAudit(context, {
    action: 'result.verified',
    entityType: 'Result',
    entityId: resultId,
    summary: 'Result verified',
  });

  return updated;
}

export async function approveResult(context: AuthContext, resultId: string) {
  requirePermission(context, 'results.approve');

  const result = await prisma.result.findFirst({
    where: { id: resultId, ...tenantWhere(context) },
  });
  if (!result) throw new TenantAccessError();

  if (result.status !== 'VERIFIED') {
    throw new DomainError('Result must be verified before approval.');
  }

  const updated = await prisma.result.update({
    where: { id: resultId },
    data: {
      status: 'APPROVED',
      approvedById: context.userId,
      approvedAt: new Date(),
    },
  });

  await recordAudit(context, {
    action: 'result.approved',
    entityType: 'Result',
    entityId: resultId,
    summary: 'Result approved',
  });

  return updated;
}

export async function publishResults(context: AuthContext, semesterId: string, unitId: string) {
  requirePermission(context, 'results.publish');
  const institutionId = tenantWhere(context).institutionId;

  const results = await prisma.result.updateMany({
    where: {
      institutionId,
      semesterId,
      unitId,
      status: 'APPROVED',
    },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });

  await recordAudit(context, {
    action: 'results.published',
    entityType: 'Result',
    summary: `${results.count} results published for unit ${unitId} semester ${semesterId}`,
    metadata: { count: results.count, semesterId, unitId },
  });

  return { count: results.count };
}
