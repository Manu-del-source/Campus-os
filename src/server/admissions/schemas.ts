import { z } from 'zod';

export const applicationStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'OFFERED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
]);

export const genderSchema = z.enum(['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED']);

export const applicantIdentitySchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: genderSchema.optional(),
  nationalId: z.string().trim().max(40).optional(),
  nationality: z.string().trim().min(2).max(4).optional(),
  addressLine1: z.string().trim().max(160).optional(),
  city: z.string().trim().max(80).optional(),
  county: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  guardianName: z.string().trim().max(120).optional(),
  guardianRelationship: z.string().trim().max(80).optional(),
  guardianPhone: z.string().trim().max(40).optional(),
  guardianEmail: z.string().trim().email().max(160).optional().or(z.literal('')),
});

export const createApplicationSchema = applicantIdentitySchema.extend({
  institutionSlug: z.string().trim().min(1).max(80),
  programmeId: z.string().uuid(),
  intakeId: z.string().uuid(),
  campusId: z.string().uuid().optional(),
});

export const publicApplicationLookupSchema = z.object({
  institutionSlug: z.string().trim().min(1).max(80),
  reference: z.string().trim().min(1).max(40),
  token: z.string().trim().min(16).max(128),
});

export const applicationListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: applicationStatusSchema.optional(),
  programmeId: z.string().uuid().optional(),
  intakeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const reviewApplicationSchema = z.object({
  applicationId: z.string().uuid(),
  note: z.string().trim().max(2000).optional(),
});

export const rejectApplicationSchema = z.object({
  applicationId: z.string().uuid(),
  note: z.string().trim().min(1).max(2000),
});

export const issueOfferSchema = z.object({
  applicationId: z.string().uuid(),
  cohortId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  expiresAt: z.coerce.date().optional(),
  conditions: z.string().trim().max(2000).optional(),
});

export const registerApplicantSchema = z.object({
  applicationId: z.string().uuid(),
  cohortId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type PublicApplicationLookup = z.infer<typeof publicApplicationLookupSchema>;
export type ApplicationListQuery = z.infer<typeof applicationListQuerySchema>;
export type IssueOfferInput = z.infer<typeof issueOfferSchema>;
export type RegisterApplicantInput = z.infer<typeof registerApplicantSchema>;
