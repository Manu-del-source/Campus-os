-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('IDENTITY', 'ACADEMIC_CERTIFICATE', 'TRANSCRIPT', 'OFFER_LETTER', 'SUPPORTING', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('PRIVATE', 'STAFF');

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "programmeId" UUID NOT NULL,
    "intakeId" UUID NOT NULL,
    "campusId" UUID,
    "reference" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "dateOfBirth" DATE,
    "gender" "Gender",
    "nationalId" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'KE',
    "addressLine1" TEXT,
    "city" TEXT,
    "county" TEXT,
    "postalCode" TEXT,
    "guardianName" TEXT,
    "guardianRelationship" TEXT,
    "guardianPhone" TEXT,
    "guardianEmail" TEXT,
    "accessTokenHash" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "decisionNote" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admissions" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "studentId" UUID,
    "cohortId" UUID,
    "groupId" UUID,
    "offerIssuedAt" TIMESTAMP(3) NOT NULL,
    "offerExpiresAt" TIMESTAMP(3),
    "offerAcceptedAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3),
    "conditions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "applicationId" UUID,
    "studentId" UUID,
    "uploadedById" UUID,
    "kind" "DocumentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_institutionId_idx" ON "applications"("institutionId");

-- CreateIndex
CREATE INDEX "applications_institutionId_status_idx" ON "applications"("institutionId", "status");

-- CreateIndex
CREATE INDEX "applications_institutionId_programmeId_idx" ON "applications"("institutionId", "programmeId");

-- CreateIndex
CREATE INDEX "applications_institutionId_intakeId_idx" ON "applications"("institutionId", "intakeId");

-- CreateIndex
CREATE INDEX "applications_institutionId_email_idx" ON "applications"("institutionId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "applications_institutionId_reference_key" ON "applications"("institutionId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "admissions_applicationId_key" ON "admissions"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "admissions_studentId_key" ON "admissions"("studentId");

-- CreateIndex
CREATE INDEX "admissions_institutionId_idx" ON "admissions"("institutionId");

-- CreateIndex
CREATE INDEX "documents_institutionId_idx" ON "documents"("institutionId");

-- CreateIndex
CREATE INDEX "documents_institutionId_applicationId_idx" ON "documents"("institutionId", "applicationId");

-- CreateIndex
CREATE INDEX "documents_institutionId_studentId_idx" ON "documents"("institutionId", "studentId");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "intakes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
