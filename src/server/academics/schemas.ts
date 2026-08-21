import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared pagination / search
// ---------------------------------------------------------------------------

export const academicListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type AcademicListQuery = z.infer<typeof academicListQuerySchema>;

// ---------------------------------------------------------------------------
// Department
// ---------------------------------------------------------------------------

export const createDepartmentSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  campusId: z.string().uuid().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.extend({
  id: z.string().uuid(),
  isActive: z.coerce.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Academic Level
// ---------------------------------------------------------------------------

export const createAcademicLevelSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  rank: z.coerce.number().int().min(1).max(100),
  description: z.string().trim().max(500).optional(),
});

export const updateAcademicLevelSchema = createAcademicLevelSchema.extend({
  id: z.string().uuid(),
  isActive: z.coerce.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Programme
// ---------------------------------------------------------------------------

export const durationUnitSchema = z.enum(['WEEK', 'MONTH', 'TERM', 'SEMESTER', 'YEAR']);

export const createProgrammeSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  departmentId: z.string().uuid(),
  levelId: z.string().uuid().optional(),
  duration: z.coerce.number().int().min(1).max(20),
  durationUnit: durationUnitSchema.default('YEAR'),
  stages: z.coerce.number().int().min(1).max(20).default(1),
  examiningBody: z.string().trim().max(160).optional(),
  accreditationNumber: z.string().trim().max(80).optional(),
});

export const updateProgrammeSchema = createProgrammeSchema.extend({
  id: z.string().uuid(),
  isActive: z.coerce.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Academic Year
// ---------------------------------------------------------------------------

export const academicPeriodStatusSchema = z.enum(['PLANNED', 'ACTIVE', 'CLOSED', 'ARCHIVED']);

export const createAcademicYearSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.coerce.boolean().default(false),
  status: academicPeriodStatusSchema.default('PLANNED'),
});

export const updateAcademicYearSchema = createAcademicYearSchema.extend({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Semester
// ---------------------------------------------------------------------------

export const createSemesterSchema = z.object({
  academicYearId: z.string().uuid(),
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  sequence: z.coerce.number().int().min(1).max(10),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.coerce.boolean().default(false),
  status: academicPeriodStatusSchema.default('PLANNED'),
});

export const updateSemesterSchema = createSemesterSchema.extend({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

export const intakeStatusSchema = z.enum(['PLANNED', 'OPEN', 'CLOSED', 'CANCELLED']);

export const createIntakeSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  academicYearId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  applicationOpen: z.coerce.date().optional(),
  applicationClose: z.coerce.date().optional(),
  status: intakeStatusSchema.default('PLANNED'),
});

export const updateIntakeSchema = createIntakeSchema.extend({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Cohort
// ---------------------------------------------------------------------------

export const createCohortSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(120),
  programmeId: z.string().uuid(),
  intakeId: z.string().uuid(),
  academicYearId: z.string().uuid().optional(),
  currentStage: z.coerce.number().int().min(1).max(20).default(1),
  startDate: z.coerce.date().optional(),
  expectedEndDate: z.coerce.date().optional(),
  status: academicPeriodStatusSchema.default('PLANNED'),
});

export const updateCohortSchema = createCohortSchema.extend({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------

export const createGroupSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  cohortId: z.string().uuid(),
  campusId: z.string().uuid().optional(),
  capacity: z.coerce.number().int().min(1).max(10_000).optional(),
});

export const updateGroupSchema = createGroupSchema.extend({
  id: z.string().uuid(),
  isActive: z.coerce.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Unit
// ---------------------------------------------------------------------------

export const unitTypeSchema = z.enum(['CORE', 'ELECTIVE', 'COMMON', 'INDUSTRIAL_ATTACHMENT', 'PROJECT']);

export const createUnitSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  programmeId: z.string().uuid(),
  levelId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  type: unitTypeSchema.default('CORE'),
  creditHours: z.coerce.number().int().min(0).max(20).optional(),
  contactHours: z.coerce.number().int().min(0).max(200).optional(),
  stage: z.coerce.number().int().min(1).max(20).default(1),
});

export const updateUnitSchema = createUnitSchema.extend({
  id: z.string().uuid(),
  isActive: z.coerce.boolean().optional(),
});
