-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DROPPED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('EXAM', 'ASSIGNMENT', 'QUIZ', 'PROJECT', 'PRACTICAL', 'COURSEWORK', 'PRESENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUBMISSION_OPEN', 'SUBMISSION_CLOSED', 'GRADED', 'PUBLISHED_RESULTS');

-- CreateEnum
CREATE TYPE "MarkStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('PENDING', 'CALCULATED', 'VERIFIED', 'APPROVED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "unit_registrations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "institutionId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "droppedAt" TIMESTAMP(3),
    "withdrawAt" TIMESTAMP(3),
    "dropReason" TEXT,
    "withdrawReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "unit_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "institutionId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "building" TEXT,
    "floor" INTEGER,
    "capacity" INTEGER,
    "roomType" TEXT DEFAULT 'CLASSROOM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "institutionId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    "weekStart" INTEGER DEFAULT 1,
    "weekEnd" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "timetable_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "institutionId" UUID NOT NULL,
    "timetableEntryId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "sessionDate" DATE NOT NULL,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    "topic" TEXT,
    "notes" TEXT,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "institutionId" UUID NOT NULL,
    "attendanceSessionId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "markedById" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "institutionId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssessmentType" NOT NULL DEFAULT 'COURSEWORK',
    "maxScore" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "institutionId" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "score" DOUBLE PRECISION,
    "percentage" DOUBLE PRECISION,
    "grade" TEXT,
    "status" "MarkStatus" NOT NULL DEFAULT 'DRAFT',
    "feedback" TEXT,
    "gradedById" UUID,
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "institutionId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "totalScore" DOUBLE PRECISION,
    "percentage" DOUBLE PRECISION,
    "grade" TEXT,
    "gpa" DOUBLE PRECISION,
    "status" "ResultStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "calculatedAt" TIMESTAMP(3),
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unit_registrations_institutionId_studentId_unitId_semesterId_key" ON "unit_registrations"("institutionId", "studentId", "unitId", "semesterId");

-- CreateIndex
CREATE INDEX "unit_registrations_institutionId_idx" ON "unit_registrations"("institutionId");

-- CreateIndex
CREATE INDEX "unit_registrations_institutionId_studentId_idx" ON "unit_registrations"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "unit_registrations_institutionId_unitId_idx" ON "unit_registrations"("institutionId", "unitId");

-- CreateIndex
CREATE INDEX "unit_registrations_institutionId_semesterId_idx" ON "unit_registrations"("institutionId", "semesterId");

-- CreateIndex
CREATE INDEX "unit_registrations_institutionId_status_idx" ON "unit_registrations"("institutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_institutionId_code_key" ON "rooms"("institutionId", "code");

-- CreateIndex
CREATE INDEX "rooms_institutionId_idx" ON "rooms"("institutionId");

-- CreateIndex
CREATE INDEX "timetable_entries_institutionId_idx" ON "timetable_entries"("institutionId");

-- CreateIndex
CREATE INDEX "timetable_entries_institutionId_semesterId_idx" ON "timetable_entries"("institutionId", "semesterId");

-- CreateIndex
CREATE INDEX "timetable_entries_institutionId_staffId_idx" ON "timetable_entries"("institutionId", "staffId");

-- CreateIndex
CREATE INDEX "timetable_entries_institutionId_roomId_idx" ON "timetable_entries"("institutionId", "roomId");

-- CreateIndex
CREATE INDEX "timetable_entries_institutionId_groupId_idx" ON "timetable_entries"("institutionId", "groupId");

-- CreateIndex
CREATE INDEX "timetable_entries_institutionId_unitId_idx" ON "timetable_entries"("institutionId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_institutionId_timetableEntryId_sessionDate_key" ON "attendance_sessions"("institutionId", "timetableEntryId", "sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_sessionId_key" ON "attendance_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "attendance_sessions_institutionId_idx" ON "attendance_sessions"("institutionId");

-- CreateIndex
CREATE INDEX "attendance_sessions_institutionId_timetableEntryId_idx" ON "attendance_sessions"("institutionId", "timetableEntryId");

-- CreateIndex
CREATE INDEX "attendance_sessions_institutionId_sessionDate_idx" ON "attendance_sessions"("institutionId", "sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_institutionId_attendanceSessionId_studentId_key" ON "attendance_records"("institutionId", "attendanceSessionId", "studentId");

-- CreateIndex
CREATE INDEX "attendance_records_institutionId_idx" ON "attendance_records"("institutionId");

-- CreateIndex
CREATE INDEX "attendance_records_institutionId_studentId_idx" ON "attendance_records"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "attendance_records_institutionId_attendanceSessionId_idx" ON "attendance_records"("institutionId", "attendanceSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_institutionId_unitId_semesterId_code_key" ON "assessments"("institutionId", "unitId", "semesterId", "code");

-- CreateIndex
CREATE INDEX "assessments_institutionId_idx" ON "assessments"("institutionId");

-- CreateIndex
CREATE INDEX "assessments_institutionId_unitId_idx" ON "assessments"("institutionId", "unitId");

-- CreateIndex
CREATE INDEX "assessments_institutionId_semesterId_idx" ON "assessments"("institutionId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "marks_institutionId_assessmentId_studentId_key" ON "marks"("institutionId", "assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "marks_institutionId_idx" ON "marks"("institutionId");

-- CreateIndex
CREATE INDEX "marks_institutionId_studentId_idx" ON "marks"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "marks_institutionId_assessmentId_idx" ON "marks"("institutionId", "assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "results_institutionId_studentId_unitId_semesterId_key" ON "results"("institutionId", "studentId", "unitId", "semesterId");

-- CreateIndex
CREATE INDEX "results_institutionId_idx" ON "results"("institutionId");

-- CreateIndex
CREATE INDEX "results_institutionId_studentId_idx" ON "results"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "results_institutionId_unitId_idx" ON "results"("institutionId", "unitId");

-- CreateIndex
CREATE INDEX "results_institutionId_semesterId_idx" ON "results"("institutionId", "semesterId");

-- CreateIndex
CREATE INDEX "results_institutionId_status_idx" ON "results"("institutionId", "status");

-- AddForeignKey
ALTER TABLE "unit_registrations" ADD CONSTRAINT "unit_registrations_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_registrations" ADD CONSTRAINT "unit_registrations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_registrations" ADD CONSTRAINT "unit_registrations_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_registrations" ADD CONSTRAINT "unit_registrations_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_timetableEntryId_fkey" FOREIGN KEY ("timetableEntryId") REFERENCES "timetable_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_attendanceSessionId_fkey" FOREIGN KEY ("attendanceSessionId") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
