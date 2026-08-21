'use server';

import { revalidatePath } from 'next/cache';

import { isAuthorizationError, isDomainError } from '@/lib/auth/errors';
import { getCurrentUser } from '@/lib/auth/session';
import {
  archiveDepartment,
  createDepartment,
  updateDepartment,
} from '@/server/academics/departments';
import {
  createAcademicLevel,
  updateAcademicLevel,
} from '@/server/academics/levels';
import {
  archiveProgramme,
  createProgramme,
  updateProgramme,
} from '@/server/academics/programmes';
import {
  createAcademicYear,
  createSemester,
  updateAcademicYear,
  updateSemester,
} from '@/server/academics/years';
import {
  createIntake,
  updateIntake,
} from '@/server/academics/intakes';
import {
  createCohort,
  createGroup,
  updateCohort,
  updateGroup,
} from '@/server/academics/cohorts';
import {
  archiveUnit,
  createUnit,
  updateUnit,
} from '@/server/academics/units';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function fail(error: unknown): { ok: false; message: string } {
  if (isAuthorizationError(error) || isDomainError(error)) {
    return { ok: false, message: error.message };
  }
  if (error instanceof Error) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: 'Something went wrong. Please try again.' };
}

// ---------------------------------------------------------------------------
// Department
// ---------------------------------------------------------------------------

export async function createDepartmentAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createDepartment(context!, {
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      description: formString(formData, 'description'),
      campusId: formString(formData, 'campusId'),
    });
    revalidatePath('/departments');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function updateDepartmentAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await updateDepartment(context!, {
      id: formString(formData, 'id') ?? '',
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      description: formString(formData, 'description'),
      campusId: formString(formData, 'campusId'),
      isActive: formData.get('isActive') === 'on',
    });
    revalidatePath('/departments');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function archiveDepartmentAction(formData: FormData): Promise<void> {
  const context = await getCurrentUser();
  await archiveDepartment(context!, formString(formData, 'id') ?? '');
  revalidatePath('/departments');
}

// ---------------------------------------------------------------------------
// Academic Level
// ---------------------------------------------------------------------------

export async function createAcademicLevelAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createAcademicLevel(context!, {
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      rank: Number(formString(formData, 'rank') ?? '1'),
      description: formString(formData, 'description'),
    });
    revalidatePath('/academics');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function updateAcademicLevelAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await updateAcademicLevel(context!, {
      id: formString(formData, 'id') ?? '',
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      rank: Number(formString(formData, 'rank') ?? '1'),
      description: formString(formData, 'description'),
      isActive: formData.get('isActive') === 'on',
    });
    revalidatePath('/academics');
    return null;
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Programme
// ---------------------------------------------------------------------------

export async function createProgrammeAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createProgramme(context!, {
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      description: formString(formData, 'description'),
      departmentId: formString(formData, 'departmentId') ?? '',
      levelId: formString(formData, 'levelId'),
      duration: Number(formString(formData, 'duration') ?? '1'),
      durationUnit: (formString(formData, 'durationUnit') as 'YEAR' | 'MONTH' | 'TERM' | 'SEMESTER' | 'WEEK') ?? 'YEAR',
      stages: Number(formString(formData, 'stages') ?? '1'),
      examiningBody: formString(formData, 'examiningBody'),
      accreditationNumber: formString(formData, 'accreditationNumber'),
    });
    revalidatePath('/programmes');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function updateProgrammeAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await updateProgramme(context!, {
      id: formString(formData, 'id') ?? '',
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      description: formString(formData, 'description'),
      departmentId: formString(formData, 'departmentId') ?? '',
      levelId: formString(formData, 'levelId'),
      duration: Number(formString(formData, 'duration') ?? '1'),
      durationUnit: (formString(formData, 'durationUnit') as 'YEAR' | 'MONTH' | 'TERM' | 'SEMESTER' | 'WEEK') ?? 'YEAR',
      stages: Number(formString(formData, 'stages') ?? '1'),
      examiningBody: formString(formData, 'examiningBody'),
      accreditationNumber: formString(formData, 'accreditationNumber'),
      isActive: formData.get('isActive') === 'on',
    });
    revalidatePath('/programmes');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function archiveProgrammeAction(formData: FormData): Promise<void> {
  const context = await getCurrentUser();
  await archiveProgramme(context!, formString(formData, 'id') ?? '');
  revalidatePath('/programmes');
}

// ---------------------------------------------------------------------------
// Academic Year
// ---------------------------------------------------------------------------

export async function createAcademicYearAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createAcademicYear(context!, {
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      startDate: new Date(formString(formData, 'startDate') ?? ''),
      endDate: new Date(formString(formData, 'endDate') ?? ''),
      isCurrent: formData.get('isCurrent') === 'on',
      status: (formString(formData, 'status') as 'PLANNED' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED') ?? 'PLANNED',
    });
    revalidatePath('/academics');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function updateAcademicYearAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await updateAcademicYear(context!, {
      id: formString(formData, 'id') ?? '',
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      startDate: new Date(formString(formData, 'startDate') ?? ''),
      endDate: new Date(formString(formData, 'endDate') ?? ''),
      isCurrent: formData.get('isCurrent') === 'on',
      status: (formString(formData, 'status') as 'PLANNED' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED') ?? 'PLANNED',
    });
    revalidatePath('/academics');
    return null;
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Semester
// ---------------------------------------------------------------------------

export async function createSemesterAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createSemester(context!, {
      academicYearId: formString(formData, 'academicYearId') ?? '',
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      sequence: Number(formString(formData, 'sequence') ?? '1'),
      startDate: new Date(formString(formData, 'startDate') ?? ''),
      endDate: new Date(formString(formData, 'endDate') ?? ''),
      isCurrent: formData.get('isCurrent') === 'on',
      status: (formString(formData, 'status') as 'PLANNED' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED') ?? 'PLANNED',
    });
    revalidatePath('/academics');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function updateSemesterAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await updateSemester(context!, {
      id: formString(formData, 'id') ?? '',
      academicYearId: formString(formData, 'academicYearId') ?? '',
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      sequence: Number(formString(formData, 'sequence') ?? '1'),
      startDate: new Date(formString(formData, 'startDate') ?? ''),
      endDate: new Date(formString(formData, 'endDate') ?? ''),
      isCurrent: formData.get('isCurrent') === 'on',
      status: (formString(formData, 'status') as 'PLANNED' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED') ?? 'PLANNED',
    });
    revalidatePath('/academics');
    return null;
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

export async function createIntakeAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createIntake(context!, {
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      academicYearId: formString(formData, 'academicYearId') ?? '',
      startDate: new Date(formString(formData, 'startDate') ?? ''),
      endDate: formString(formData, 'endDate') ? new Date(formString(formData, 'endDate')!) : undefined,
      applicationOpen: formString(formData, 'applicationOpen') ? new Date(formString(formData, 'applicationOpen')!) : undefined,
      applicationClose: formString(formData, 'applicationClose') ? new Date(formString(formData, 'applicationClose')!) : undefined,
      status: (formString(formData, 'status') as 'PLANNED' | 'OPEN' | 'CLOSED' | 'CANCELLED') ?? 'PLANNED',
    });
    revalidatePath('/academics');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function updateIntakeAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await updateIntake(context!, {
      id: formString(formData, 'id') ?? '',
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      academicYearId: formString(formData, 'academicYearId') ?? '',
      startDate: new Date(formString(formData, 'startDate') ?? ''),
      endDate: formString(formData, 'endDate') ? new Date(formString(formData, 'endDate')!) : undefined,
      applicationOpen: formString(formData, 'applicationOpen') ? new Date(formString(formData, 'applicationOpen')!) : undefined,
      applicationClose: formString(formData, 'applicationClose') ? new Date(formString(formData, 'applicationClose')!) : undefined,
      status: (formString(formData, 'status') as 'PLANNED' | 'OPEN' | 'CLOSED' | 'CANCELLED') ?? 'PLANNED',
    });
    revalidatePath('/academics');
    return null;
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Cohort
// ---------------------------------------------------------------------------

export async function createCohortAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createCohort(context!, {
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      programmeId: formString(formData, 'programmeId') ?? '',
      intakeId: formString(formData, 'intakeId') ?? '',
      academicYearId: formString(formData, 'academicYearId'),
      currentStage: Number(formString(formData, 'currentStage') ?? '1'),
      startDate: formString(formData, 'startDate') ? new Date(formString(formData, 'startDate')!) : undefined,
      expectedEndDate: formString(formData, 'expectedEndDate') ? new Date(formString(formData, 'expectedEndDate')!) : undefined,
      status: (formString(formData, 'status') as 'PLANNED' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED') ?? 'PLANNED',
    });
    revalidatePath('/cohorts');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function updateCohortAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await updateCohort(context!, {
      id: formString(formData, 'id') ?? '',
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      programmeId: formString(formData, 'programmeId') ?? '',
      intakeId: formString(formData, 'intakeId') ?? '',
      academicYearId: formString(formData, 'academicYearId'),
      currentStage: Number(formString(formData, 'currentStage') ?? '1'),
      startDate: formString(formData, 'startDate') ? new Date(formString(formData, 'startDate')!) : undefined,
      expectedEndDate: formString(formData, 'expectedEndDate') ? new Date(formString(formData, 'expectedEndDate')!) : undefined,
      status: (formString(formData, 'status') as 'PLANNED' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED') ?? 'PLANNED',
    });
    revalidatePath('/cohorts');
    return null;
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------

export async function createGroupAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createGroup(context!, {
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      cohortId: formString(formData, 'cohortId') ?? '',
      campusId: formString(formData, 'campusId'),
      capacity: formString(formData, 'capacity') ? Number(formString(formData, 'capacity')) : undefined,
    });
    revalidatePath('/cohorts');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function updateGroupAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await updateGroup(context!, {
      id: formString(formData, 'id') ?? '',
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      cohortId: formString(formData, 'cohortId') ?? '',
      campusId: formString(formData, 'campusId'),
      capacity: formString(formData, 'capacity') ? Number(formString(formData, 'capacity')) : undefined,
      isActive: formData.get('isActive') === 'on',
    });
    revalidatePath('/cohorts');
    return null;
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Unit
// ---------------------------------------------------------------------------

export async function createUnitAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await createUnit(context!, {
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      description: formString(formData, 'description'),
      programmeId: formString(formData, 'programmeId') ?? '',
      levelId: formString(formData, 'levelId'),
      semesterId: formString(formData, 'semesterId'),
      type: (formString(formData, 'type') as 'CORE' | 'ELECTIVE' | 'COMMON' | 'INDUSTRIAL_ATTACHMENT' | 'PROJECT') ?? 'CORE',
      creditHours: formString(formData, 'creditHours') ? Number(formString(formData, 'creditHours')) : undefined,
      contactHours: formString(formData, 'contactHours') ? Number(formString(formData, 'contactHours')) : undefined,
      stage: Number(formString(formData, 'stage') ?? '1'),
    });
    revalidatePath('/units');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function updateUnitAction(
  _prev: { ok: false; message: string } | null,
  formData: FormData,
): Promise<{ ok: false; message: string } | null> {
  try {
    const context = await getCurrentUser();
    await updateUnit(context!, {
      id: formString(formData, 'id') ?? '',
      code: formString(formData, 'code') ?? '',
      name: formString(formData, 'name') ?? '',
      description: formString(formData, 'description'),
      programmeId: formString(formData, 'programmeId') ?? '',
      levelId: formString(formData, 'levelId'),
      semesterId: formString(formData, 'semesterId'),
      type: (formString(formData, 'type') as 'CORE' | 'ELECTIVE' | 'COMMON' | 'INDUSTRIAL_ATTACHMENT' | 'PROJECT') ?? 'CORE',
      creditHours: formString(formData, 'creditHours') ? Number(formString(formData, 'creditHours')) : undefined,
      contactHours: formString(formData, 'contactHours') ? Number(formString(formData, 'contactHours')) : undefined,
      stage: Number(formString(formData, 'stage') ?? '1'),
      isActive: formData.get('isActive') === 'on',
    });
    revalidatePath('/units');
    return null;
  } catch (error) {
    return fail(error);
  }
}

export async function archiveUnitAction(formData: FormData): Promise<void> {
  const context = await getCurrentUser();
  await archiveUnit(context!, formString(formData, 'id') ?? '');
  revalidatePath('/units');
}
