import { z } from 'zod';

// ---------------------------------------------------------------------------
// Assessment schemas
// ---------------------------------------------------------------------------

export const createAssessmentSchema = z.object({
  unitId: z.string().uuid(),
  semesterId: z.string().uuid(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(['EXAM', 'ASSIGNMENT', 'QUIZ', 'PROJECT', 'PRACTICAL', 'COURSEWORK', 'PRESENTATION', 'OTHER']),
  maxScore: z.number().min(0).max(1000),
  weight: z.number().min(0).max(100),
  dueDate: z.string().optional(),
});

export const updateAssessmentSchema = createAssessmentSchema.extend({
  id: z.string().uuid(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SUBMISSION_OPEN', 'SUBMISSION_CLOSED', 'GRADED', 'PUBLISHED_RESULTS']).optional(),
});

// ---------------------------------------------------------------------------
// Mark schemas
// ---------------------------------------------------------------------------

export const submitMarkSchema = z.object({
  assessmentId: z.string().uuid(),
  studentId: z.string().uuid(),
  score: z.number().min(0),
  feedback: z.string().max(2000).optional(),
});

export const batchSubmitMarksSchema = z.object({
  assessmentId: z.string().uuid(),
  marks: z.array(
    z.object({
      studentId: z.string().uuid(),
      score: z.number().min(0),
      feedback: z.string().max(2000).optional(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Result schemas
// ---------------------------------------------------------------------------

export const calculateResultSchema = z.object({
  studentId: z.string().uuid(),
  unitId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// List query schemas
// ---------------------------------------------------------------------------

export const assessmentListQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  unitId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  type: z.enum(['EXAM', 'ASSIGNMENT', 'QUIZ', 'PROJECT', 'PRACTICAL', 'COURSEWORK', 'PRESENTATION', 'OTHER']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SUBMISSION_OPEN', 'SUBMISSION_CLOSED', 'GRADED', 'PUBLISHED_RESULTS']).optional(),
});

export type AssessmentListQuery = z.infer<typeof assessmentListQuerySchema>;
