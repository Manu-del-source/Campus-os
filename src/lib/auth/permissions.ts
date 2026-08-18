/**
 * Permission catalogue.
 *
 * Permissions are data (rows in `permissions`), but the canonical list lives
 * here so that TypeScript can check every call site and the seeder can keep the
 * database in sync. Institutions may compose their own roles from these keys;
 * they can never invent keys the application does not understand.
 */

export const PERMISSIONS = {
  // Institution administration
  'institution.read': 'View institution profile',
  'institution.update': 'Update institution profile',
  'settings.manage': 'Manage institution settings',
  'users.read': 'View users',
  'users.invite': 'Invite users',
  'users.update': 'Update users',
  'users.deactivate': 'Deactivate users',
  'roles.read': 'View roles and permissions',
  'roles.manage': 'Create and modify roles',
  'audit.read': 'View the institution audit trail',

  // Academic structure
  'campuses.read': 'View campuses',
  'campuses.manage': 'Create and modify campuses',
  'departments.read': 'View departments',
  'departments.manage': 'Create and modify departments',
  'programmes.read': 'View programmes',
  'programmes.manage': 'Create and modify programmes',
  'units.read': 'View units',
  'units.manage': 'Create and modify units',
  'academics.read': 'View academic calendar structures',
  'academics.manage': 'Manage academic years, intakes, cohorts and groups',

  // Students
  'students.read': 'View students',
  'students.create': 'Create students',
  'students.update': 'Update students',
  'students.delete': 'Archive students',

  // Admissions
  'admissions.read': 'View applications',
  'admissions.review': 'Review applications',
  'admissions.approve': 'Approve or reject applications',
  'admissions.offer': 'Issue admission offers',
  'admissions.register': 'Register an accepted applicant as a student',

  // Staff
  'staff.read': 'View staff',
  'staff.create': 'Create staff',
  'staff.update': 'Update staff',
  'staff.delete': 'Archive staff',

  // Timetable and attendance
  'timetable.read': 'View timetables',
  'timetable.manage': 'Create and modify timetable entries',
  'attendance.read': 'View attendance',
  'attendance.record': 'Record attendance',

  // Assessment and results
  'marks.enter': 'Enter marks',
  'marks.submit': 'Submit marks for verification',
  'marks.verify': 'Verify submitted marks',
  'results.read': 'View results',
  'results.approve': 'Approve results',
  'results.publish': 'Publish results',

  // Finance
  'finance.read': 'View financial records',
  'finance.invoice': 'Create and modify invoices',
  'finance.payment': 'Record payments',
  'finance.receipt': 'Issue receipts',
  'finance.configure': 'Configure fee structures',

  // Documents, notifications, reports
  'documents.read': 'View documents',
  'documents.manage': 'Upload and issue documents',
  'notifications.read': 'View notifications',
  'notifications.send': 'Send notifications',
  'reports.read': 'View reports',

  // Platform (never granted to institution users)
  'platform.institutions.read': 'View institutions on the platform',
  'platform.institutions.manage': 'Create and modify institutions',
  'platform.subscriptions.manage': 'Manage plans and subscriptions',
  'platform.billing.manage': 'Manage platform billing',
  'platform.usage.read': 'View platform usage',
  'platform.audit.read': 'View the platform audit trail',
  'platform.settings.manage': 'Manage platform configuration',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Coarse module grouping derived from the permission key (`students.read` -> `students`). */
export function permissionModule(permission: Permission): string {
  const [head, second] = permission.split('.');
  return head === 'platform' ? `platform.${second}` : head;
}

export const ROLE_KEYS = [
  'PLATFORM_ADMIN',
  'INSTITUTION_ADMIN',
  'PRINCIPAL',
  'REGISTRAR',
  'FINANCE_OFFICER',
  'EXAM_OFFICER',
  'HOD',
  'LECTURER',
  'ADMISSIONS_OFFICER',
  'STUDENT',
  'STAFF',
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export const PLATFORM_ROLE_KEYS: readonly RoleKey[] = ['PLATFORM_ADMIN'];

const READ_ONLY_ACADEMIC: Permission[] = [
  'campuses.read',
  'departments.read',
  'programmes.read',
  'units.read',
  'academics.read',
];

/**
 * Default permission grants per system role. Institutions may clone a system
 * role and adjust it; these defaults are only the starting point.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  PLATFORM_ADMIN: ALL_PERMISSIONS.filter((permission) => permission.startsWith('platform.')),

  INSTITUTION_ADMIN: ALL_PERMISSIONS.filter((permission) => !permission.startsWith('platform.')),

  PRINCIPAL: [
    'institution.read',
    'users.read',
    'roles.read',
    'audit.read',
    ...READ_ONLY_ACADEMIC,
    'students.read',
    'staff.read',
    'admissions.read',
    'timetable.read',
    'attendance.read',
    'results.read',
    'results.approve',
    'finance.read',
    'documents.read',
    'notifications.read',
    'notifications.send',
    'reports.read',
  ],

  REGISTRAR: [
    'institution.read',
    ...READ_ONLY_ACADEMIC,
    'academics.manage',
    'programmes.manage',
    'units.manage',
    'departments.manage',
    'students.read',
    'students.create',
    'students.update',
    'students.delete',
    'admissions.read',
    'admissions.review',
    'admissions.approve',
    'admissions.offer',
    'admissions.register',
    'staff.read',
    'timetable.read',
    'timetable.manage',
    'attendance.read',
    'results.read',
    'documents.read',
    'documents.manage',
    'notifications.read',
    'notifications.send',
    'reports.read',
  ],

  FINANCE_OFFICER: [
    'institution.read',
    'students.read',
    ...READ_ONLY_ACADEMIC,
    'finance.read',
    'finance.invoice',
    'finance.payment',
    'finance.receipt',
    'finance.configure',
    'documents.read',
    'documents.manage',
    'notifications.read',
    'notifications.send',
    'reports.read',
  ],

  EXAM_OFFICER: [
    'institution.read',
    ...READ_ONLY_ACADEMIC,
    'students.read',
    'staff.read',
    'timetable.read',
    'marks.verify',
    'results.read',
    'results.approve',
    'results.publish',
    'documents.read',
    'documents.manage',
    'reports.read',
  ],

  HOD: [
    'institution.read',
    ...READ_ONLY_ACADEMIC,
    'students.read',
    'staff.read',
    'timetable.read',
    'timetable.manage',
    'attendance.read',
    'attendance.record',
    'marks.enter',
    'marks.submit',
    'marks.verify',
    'results.read',
    'reports.read',
  ],

  LECTURER: [
    'programmes.read',
    'units.read',
    'academics.read',
    'students.read',
    'timetable.read',
    'attendance.read',
    'attendance.record',
    'marks.enter',
    'marks.submit',
    'results.read',
    'notifications.read',
  ],

  ADMISSIONS_OFFICER: [
    'institution.read',
    'programmes.read',
    'academics.read',
    'students.read',
    'students.create',
    'students.update',
    'admissions.read',
    'admissions.review',
    'admissions.offer',
    'admissions.register',
    'documents.read',
    'documents.manage',
    'notifications.read',
    'notifications.send',
  ],

  STAFF: ['institution.read', 'programmes.read', 'units.read', 'timetable.read', 'notifications.read'],

  STUDENT: ['timetable.read', 'attendance.read', 'results.read', 'finance.read', 'notifications.read'],
};

export const ROLE_LABELS: Record<RoleKey, string> = {
  PLATFORM_ADMIN: 'Platform administrator',
  INSTITUTION_ADMIN: 'Institution administrator',
  PRINCIPAL: 'Principal',
  REGISTRAR: 'Registrar',
  FINANCE_OFFICER: 'Finance officer',
  EXAM_OFFICER: 'Examinations officer',
  HOD: 'Head of department',
  LECTURER: 'Lecturer',
  ADMISSIONS_OFFICER: 'Admissions officer',
  STUDENT: 'Student',
  STAFF: 'Staff member',
};

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

export function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value);
}
