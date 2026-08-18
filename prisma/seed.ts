/**
 * Development seed data.
 *
 * Everything created here is CLEARLY FICTIONAL demo data for two independent
 * tenants, which also makes tenant-isolation behaviour observable in the UI.
 * Never run this against a production database.
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ROLE_LABELS,
  ROLE_KEYS,
  permissionModule,
  type RoleKey,
} from '../src/lib/auth/permissions';
import { hashPassword } from '../src/lib/auth/password';
import { hashAccessToken } from '../src/server/admissions/references';

/**
 * Development-only demo password. NEVER use this in production. Seed refuses
 * to run when NODE_ENV=production unless ALLOW_PRODUCTION_SEED=yes.
 */
export const DEV_DEMO_PASSWORD = 'CampusOS-Dev-Only-2026!';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL must be set to seed the database.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DEMO_TAG = 'DEMO DATA — fictional, for development only';

async function seedPermissions(): Promise<void> {
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, module: permissionModule(key), description: PERMISSIONS[key] },
      update: { module: permissionModule(key), description: PERMISSIONS[key] },
    });
  }
}

/**
 * System roles exist per tenant, plus one global platform role.
 * Rows with `institutionId = null` cannot use compound upserts (PostgreSQL
 * treats NULL as distinct), so they are matched explicitly.
 */
async function seedRoles(institutionId: string | null): Promise<Map<RoleKey, string>> {
  const roleIds = new Map<RoleKey, string>();
  const keys = institutionId
    ? ROLE_KEYS.filter((key) => key !== 'PLATFORM_ADMIN')
    : (['PLATFORM_ADMIN'] as RoleKey[]);

  for (const key of keys) {
    const existing = await prisma.role.findFirst({ where: { institutionId, key } });
    const role = existing
      ? await prisma.role.update({ where: { id: existing.id }, data: { name: ROLE_LABELS[key] } })
      : await prisma.role.create({
          data: {
            institutionId,
            key,
            name: ROLE_LABELS[key],
            scope: institutionId ? 'INSTITUTION' : 'PLATFORM',
            isSystem: true,
          },
        });
    roleIds.set(key, role.id);

    const permissions = await prisma.permission.findMany({
      where: { key: { in: [...DEFAULT_ROLE_PERMISSIONS[key]] } },
      select: { id: true },
    });

    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }

  return roleIds;
}

interface DemoUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role: RoleKey;
}

async function seedUser(
  institutionId: string | null,
  roleIds: Map<RoleKey, string>,
  input: DemoUserInput,
  isPlatformAdmin = false,
): Promise<string> {
  const passwordHash = await hashPassword(DEV_DEMO_PASSWORD);
  const existing = await prisma.user.findFirst({ where: { institutionId, email: input.email } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          status: 'ACTIVE',
          passwordHash,
        },
      })
    : await prisma.user.create({
        data: {
          institutionId,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          status: 'ACTIVE',
          isPlatformAdmin,
          emailVerifiedAt: new Date(),
          passwordHash,
        },
      });

  const roleId = roleIds.get(input.role);
  if (roleId) {
    const assignment = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId, institutionId },
    });
    if (!assignment) {
      await prisma.userRole.create({ data: { userId: user.id, roleId, institutionId } });
    }
  }

  return user.id;
}

interface DemoInstitutionSpec {
  slug: string;
  name: string;
  shortName: string;
  type: 'TVET' | 'TECHNICAL_COLLEGE' | 'PRIVATE_COLLEGE';
  city: string;
  emailDomain: string;
  departments: { code: string; name: string }[];
  programmes: {
    code: string;
    name: string;
    department: string;
    levelCode: string;
    duration: number;
    stages: number;
    examiningBody: string;
  }[];
}

const DEMO_INSTITUTIONS: DemoInstitutionSpec[] = [
  {
    slug: 'demo-college',
    name: 'CampusOS Demo College',
    shortName: 'Demo College',
    type: 'TVET',
    city: 'Nairobi',
    emailDomain: 'demo-college.example',
    departments: [
      { code: 'ICT', name: 'Information & Communication Technology' },
      { code: 'BUS', name: 'Business Studies' },
      { code: 'ENG', name: 'Engineering' },
    ],
    programmes: [
      {
        code: 'ICT-DIP',
        name: 'Diploma in Information Communication Technology',
        department: 'ICT',
        levelCode: 'L6',
        duration: 3,
        stages: 3,
        examiningBody: 'Demo Qualifications Authority',
      },
      {
        code: 'ICT-CERT',
        name: 'Certificate in Information Communication Technology',
        department: 'ICT',
        levelCode: 'L5',
        duration: 2,
        stages: 2,
        examiningBody: 'Demo Qualifications Authority',
      },
      {
        code: 'BUS-DIP',
        name: 'Diploma in Business Management',
        department: 'BUS',
        levelCode: 'L6',
        duration: 3,
        stages: 3,
        examiningBody: 'Demo Qualifications Authority',
      },
      {
        code: 'ENG-DIP',
        name: 'Diploma in Electrical & Electronics Engineering',
        department: 'ENG',
        levelCode: 'L6',
        duration: 3,
        stages: 3,
        examiningBody: 'Demo Qualifications Authority',
      },
    ],
  },
  {
    slug: 'harbour-tvet',
    name: 'Harbour Point Technical Institute',
    shortName: 'Harbour Point',
    type: 'TECHNICAL_COLLEGE',
    city: 'Kisumu',
    emailDomain: 'harbour-point.example',
    departments: [
      { code: 'HOSP', name: 'Hospitality & Tourism' },
      { code: 'AGRI', name: 'Agribusiness' },
    ],
    programmes: [
      {
        code: 'HOSP-DIP',
        name: 'Diploma in Food & Beverage Management',
        department: 'HOSP',
        levelCode: 'L6',
        duration: 3,
        stages: 3,
        examiningBody: 'Demo Qualifications Authority',
      },
      {
        code: 'AGRI-CERT',
        name: 'Certificate in Agribusiness',
        department: 'AGRI',
        levelCode: 'L5',
        duration: 2,
        stages: 2,
        examiningBody: 'Demo Qualifications Authority',
      },
    ],
  },
];

const LEVELS = [
  { code: 'L4', name: 'Artisan (Level 4)', rank: 4 },
  { code: 'L5', name: 'Certificate (Level 5)', rank: 5 },
  { code: 'L6', name: 'Diploma (Level 6)', rank: 6 },
];

const FIRST_NAMES = ['Amina', 'Brian', 'Cynthia', 'Dennis', 'Esther', 'Felix', 'Grace', 'Hassan', 'Irene', 'Joel'];
const LAST_NAMES = ['Achieng', 'Barasa', 'Chebet', 'Damaris', 'Ekiru', 'Fundi', 'Gitonga', 'Hamisi', 'Injendi', 'Juma'];

async function seedInstitution(spec: DemoInstitutionSpec): Promise<void> {
  const institution = await prisma.institution.upsert({
    where: { slug: spec.slug },
    create: {
      slug: spec.slug,
      name: spec.name,
      shortName: spec.shortName,
      type: spec.type,
      status: 'ACTIVE',
      email: `registry@${spec.emailDomain}`,
      phone: '+254700000000',
      city: spec.city,
      county: spec.city,
      settings: { demo: true, note: DEMO_TAG },
    },
    update: { name: spec.name, status: 'ACTIVE' },
  });

  const institutionId = institution.id;
  const roleIds = await seedRoles(institutionId);

  const campus = await prisma.campus.upsert({
    where: { institutionId_code: { institutionId, code: 'MAIN' } },
    create: { institutionId, code: 'MAIN', name: `${spec.shortName} Main Campus`, isMain: true, city: spec.city },
    update: {},
  });

  const levelIds = new Map<string, string>();
  for (const level of LEVELS) {
    const record = await prisma.academicLevel.upsert({
      where: { institutionId_code: { institutionId, code: level.code } },
      create: { institutionId, ...level },
      update: { name: level.name, rank: level.rank },
    });
    levelIds.set(level.code, record.id);
  }

  const departmentIds = new Map<string, string>();
  for (const department of spec.departments) {
    const record = await prisma.department.upsert({
      where: { institutionId_code: { institutionId, code: department.code } },
      create: { institutionId, campusId: campus.id, ...department },
      update: { name: department.name },
    });
    departmentIds.set(department.code, record.id);
  }

  const programmeIds = new Map<string, string>();
  for (const programme of spec.programmes) {
    const record = await prisma.programme.upsert({
      where: { institutionId_code: { institutionId, code: programme.code } },
      create: {
        institutionId,
        departmentId: departmentIds.get(programme.department) as string,
        levelId: levelIds.get(programme.levelCode),
        code: programme.code,
        name: programme.name,
        duration: programme.duration,
        durationUnit: 'YEAR',
        stages: programme.stages,
        examiningBody: programme.examiningBody,
      },
      update: { name: programme.name },
    });
    programmeIds.set(programme.code, record.id);
  }

  const academicYear = await prisma.academicYear.upsert({
    where: { institutionId_code: { institutionId, code: '2026' } },
    create: {
      institutionId,
      code: '2026',
      name: 'Academic Year 2026',
      startDate: new Date('2026-01-05'),
      endDate: new Date('2026-12-11'),
      isCurrent: true,
      status: 'ACTIVE',
    },
    update: { isCurrent: true, status: 'ACTIVE' },
  });

  for (const semester of [
    { code: '2026-S1', name: 'Semester 1', sequence: 1, start: '2026-01-05', end: '2026-04-24', current: true },
    { code: '2026-S2', name: 'Semester 2', sequence: 2, start: '2026-05-04', end: '2026-08-21', current: false },
    { code: '2026-S3', name: 'Semester 3', sequence: 3, start: '2026-09-07', end: '2026-12-11', current: false },
  ]) {
    await prisma.semester.upsert({
      where: { institutionId_code: { institutionId, code: semester.code } },
      create: {
        institutionId,
        academicYearId: academicYear.id,
        code: semester.code,
        name: semester.name,
        sequence: semester.sequence,
        startDate: new Date(semester.start),
        endDate: new Date(semester.end),
        isCurrent: semester.current,
        status: semester.current ? 'ACTIVE' : 'PLANNED',
      },
      update: {},
    });
  }

  const intakes = [
    { code: 'JAN2026', name: 'January 2026 Intake', start: '2026-01-05', status: 'CLOSED' as const },
    { code: 'MAY2026', name: 'May 2026 Intake', start: '2026-05-04', status: 'OPEN' as const },
    { code: 'SEP2026', name: 'September 2026 Intake', start: '2026-09-07', status: 'OPEN' as const },
  ];

  const intakeIds = new Map<string, string>();
  for (const intake of intakes) {
    const record = await prisma.intake.upsert({
      where: { institutionId_code: { institutionId, code: intake.code } },
      create: {
        institutionId,
        academicYearId: academicYear.id,
        code: intake.code,
        name: intake.name,
        startDate: new Date(intake.start),
        status: intake.status,
      },
      update: { status: intake.status },
    });
    intakeIds.set(intake.code, record.id);
  }

  // Units for the first programme of each institution.
  const primaryProgramme = spec.programmes[0];
  const primaryProgrammeId = programmeIds.get(primaryProgramme.code) as string;

  const unitSpecs = [
    { suffix: '101', name: 'Communication Skills', stage: 1 },
    { suffix: '102', name: 'Introduction to the Discipline', stage: 1 },
    { suffix: '201', name: 'Applied Practice', stage: 2 },
    { suffix: '202', name: 'Entrepreneurship', stage: 2 },
    { suffix: '301', name: 'Industrial Attachment', stage: 3 },
  ];

  for (const unit of unitSpecs) {
    const code = `${primaryProgramme.code}-${unit.suffix}`;
    await prisma.unit.upsert({
      where: { institutionId_code: { institutionId, code } },
      create: {
        institutionId,
        programmeId: primaryProgrammeId,
        levelId: levelIds.get(primaryProgramme.levelCode),
        code,
        name: unit.name,
        stage: unit.stage,
        creditHours: 3,
        contactHours: 45,
        type: unit.suffix === '301' ? 'INDUSTRIAL_ATTACHMENT' : 'CORE',
      },
      update: { name: unit.name },
    });
  }

  // Cohort + groups for the September intake of the primary programme.
  const cohortCode = `${primaryProgramme.code}-SEP26`;
  const cohort = await prisma.cohort.upsert({
    where: { institutionId_code: { institutionId, code: cohortCode } },
    create: {
      institutionId,
      programmeId: primaryProgrammeId,
      intakeId: intakeIds.get('SEP2026') as string,
      academicYearId: academicYear.id,
      code: cohortCode,
      name: `${primaryProgramme.name} — September 2026`,
      startDate: new Date('2026-09-07'),
      status: 'PLANNED',
    },
    update: {},
  });

  const groupIds: string[] = [];
  for (const suffix of ['A', 'B']) {
    const group = await prisma.group.upsert({
      where: { institutionId_code: { institutionId, code: `${cohortCode}-${suffix}` } },
      create: {
        institutionId,
        cohortId: cohort.id,
        campusId: campus.id,
        code: `${cohortCode}-${suffix}`,
        name: `Group ${suffix}`,
        capacity: 40,
      },
      update: {},
    });
    groupIds.push(group.id);
  }

  // Demo users, one per operational role.
  const demoUsers: DemoUserInput[] = [
    { email: `admin@${spec.emailDomain}`, firstName: 'Ada', lastName: 'Administrator', role: 'INSTITUTION_ADMIN' },
    { email: `principal@${spec.emailDomain}`, firstName: 'Paul', lastName: 'Principal', role: 'PRINCIPAL' },
    { email: `registrar@${spec.emailDomain}`, firstName: 'Rita', lastName: 'Registrar', role: 'REGISTRAR' },
    { email: `finance@${spec.emailDomain}`, firstName: 'Faith', lastName: 'Finance', role: 'FINANCE_OFFICER' },
    { email: `exams@${spec.emailDomain}`, firstName: 'Eric', lastName: 'Examiner', role: 'EXAM_OFFICER' },
    { email: `hod@${spec.emailDomain}`, firstName: 'Hilda', lastName: 'Head', role: 'HOD' },
    { email: `lecturer@${spec.emailDomain}`, firstName: 'Leo', lastName: 'Lecturer', role: 'LECTURER' },
    { email: `admissions@${spec.emailDomain}`, firstName: 'Alice', lastName: 'Admissions', role: 'ADMISSIONS_OFFICER' },
  ];

  const userIds = new Map<string, string>();
  for (const demoUser of demoUsers) {
    userIds.set(demoUser.email, await seedUser(institutionId, roleIds, demoUser));
  }

  // Staff records for the academic users.
  const staffSpecs = [
    { email: `hod@${spec.emailDomain}`, number: 'STF-001', first: 'Hilda', last: 'Head', title: 'Head of Department', department: spec.departments[0].code },
    { email: `lecturer@${spec.emailDomain}`, number: 'STF-002', first: 'Leo', last: 'Lecturer', title: 'Lecturer', department: spec.departments[0].code },
    { email: `registrar@${spec.emailDomain}`, number: 'STF-003', first: 'Rita', last: 'Registrar', title: 'Registrar', department: spec.departments[0].code },
  ];

  for (const staff of staffSpecs) {
    await prisma.staff.upsert({
      where: { institutionId_staffNumber: { institutionId, staffNumber: staff.number } },
      create: {
        institutionId,
        userId: userIds.get(staff.email),
        departmentId: departmentIds.get(staff.department),
        campusId: campus.id,
        staffNumber: staff.number,
        firstName: staff.first,
        lastName: staff.last,
        email: staff.email,
        jobTitle: staff.title,
        category: staff.title === 'Registrar' ? 'ADMINISTRATIVE' : 'ACADEMIC',
        employmentStatus: 'ACTIVE',
        employmentDate: new Date('2024-01-15'),
      },
      update: { jobTitle: staff.title },
    });
  }

  // Learners spread across the two groups.
  for (let index = 0; index < 12; index += 1) {
    const studentNumber = `${spec.shortName.slice(0, 2).toUpperCase()}/2026/${String(index + 1).padStart(4, '0')}`;
    const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(index * 3) % LAST_NAMES.length];

    await prisma.student.upsert({
      where: { institutionId_studentNumber: { institutionId, studentNumber } },
      create: {
        institutionId,
        studentNumber,
        applicationReference: `APP-2026-${spec.slug.toUpperCase()}-${String(index + 1).padStart(4, '0')}`,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@students.${spec.emailDomain}`,
        phone: '+254711000000',
        gender: index % 2 === 0 ? 'FEMALE' : 'MALE',
        dateOfBirth: new Date(2004, index % 12, ((index * 5) % 27) + 1),
        programmeId: primaryProgrammeId,
        levelId: levelIds.get(primaryProgramme.levelCode),
        intakeId: intakeIds.get('SEP2026'),
        cohortId: cohort.id,
        groupId: groupIds[index % groupIds.length],
        campusId: campus.id,
        status: index < 9 ? 'ACTIVE' : 'APPLICANT',
        admissionDate: index < 9 ? new Date('2026-09-07') : null,
        guardianName: 'Demo Guardian',
        guardianPhone: '+254722000000',
      },
      update: {},
    });
  }

  const demoApplications: { first: string; last: string; status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'OFFERED' }[] =
    [
      { first: 'Naomi', last: 'Otieno', status: 'DRAFT' },
      { first: 'Peter', last: 'Wanjiku', status: 'SUBMITTED' },
      { first: 'Quincy', last: 'Mutiso', status: 'UNDER_REVIEW' },
      { first: 'Rose', last: 'Nyambura', status: 'OFFERED' },
    ];

  for (const [index, applicant] of demoApplications.entries()) {
    const reference = `APP-2026-${spec.slug.slice(0, 4).toUpperCase()}-D${String(index + 1).padStart(3, '0')}`;
    const existing = await prisma.application.findFirst({ where: { institutionId, reference } });
    if (existing) continue;

    const application = await prisma.application.create({
      data: {
        institutionId,
        programmeId: primaryProgrammeId,
        intakeId: intakeIds.get('SEP2026') as string,
        campusId: campus.id,
        reference,
        status: applicant.status,
        firstName: applicant.first,
        lastName: applicant.last,
        email: `${applicant.first.toLowerCase()}.${applicant.last.toLowerCase()}@apply.${spec.emailDomain}`,
        phone: '+254733000000',
        accessTokenHash: hashAccessToken(`demo-token-${spec.slug}-${index}`),
        submittedAt: applicant.status === 'DRAFT' ? null : new Date('2026-03-01'),
      },
    });

    if (applicant.status === 'OFFERED') {
      await prisma.admission.create({
        data: {
          institutionId,
          applicationId: application.id,
          cohortId: cohort.id,
          groupId: groupIds[0],
          offerIssuedAt: new Date('2026-03-15'),
          offerExpiresAt: new Date('2026-04-15'),
          conditions: 'Provide original certificates at registration.',
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      institutionId,
      actorType: 'SYSTEM',
      actorLabel: 'seed',
      action: 'institution.created',
      entityType: 'Institution',
      entityId: institutionId,
      summary: `Seeded ${spec.name}`,
      metadata: { demo: true, note: DEMO_TAG },
    },
  });

  console.log(`Seeded ${spec.name} (${spec.slug})`);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'yes') {
    throw new Error('Refusing to seed demo data in production.');
  }

  await seedPermissions();

  const platformRoles = await seedRoles(null);
  await seedUser(
    null,
    platformRoles,
    { email: 'platform-admin@campusos.example', firstName: 'Pat', lastName: 'Platform', role: 'PLATFORM_ADMIN' },
    true,
  );

  for (const spec of DEMO_INSTITUTIONS) {
    await seedInstitution(spec);
  }

  console.log(`\n${DEMO_TAG}`);
  console.log('Development-only first-party login (hashed in PostgreSQL, never a production default):');
  console.log(`  password for every seeded user: ${DEV_DEMO_PASSWORD}`);
  console.log('  platform-admin@campusos.example                 PLATFORM_ADMIN');
  for (const spec of DEMO_INSTITUTIONS) {
    console.log(`  admin@${spec.emailDomain}       INSTITUTION_ADMIN (${spec.name})`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
