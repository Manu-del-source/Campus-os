import type { Permission } from '@/lib/auth/permissions';

/**
 * Navigation is declared once, with the permission each destination requires.
 * The server filters this list before rendering, so the sidebar can never
 * advertise a surface the session is not allowed to open — and the pages
 * themselves still re-check on every request.
 */
export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly permission?: Permission;
  /** Marks routes that are part of the phase-1 foundation rather than shipped modules. */
  readonly planned?: boolean;
}

export interface NavSection {
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const INSTITUTION_NAV: readonly NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/dashboard' }],
  },
  {
    label: 'People',
    items: [
      { label: 'Students', href: '/students', permission: 'students.read' },
      { label: 'Staff', href: '/staff-directory', permission: 'staff.read' },
      { label: 'Admissions', href: '/admissions', permission: 'admissions.read', planned: true },
    ],
  },
  {
    label: 'Academics',
    items: [
      { label: 'Academic structure', href: '/academics', permission: 'academics.read' },
      { label: 'Departments', href: '/departments', permission: 'departments.read' },
      { label: 'Programmes', href: '/programmes', permission: 'programmes.read' },
      { label: 'Units', href: '/units', permission: 'units.read' },
      { label: 'Cohorts & groups', href: '/cohorts', permission: 'academics.read' },
      { label: 'Timetable', href: '/timetable', permission: 'timetable.read', planned: true },
      { label: 'Attendance', href: '/attendance', permission: 'attendance.read', planned: true },
      { label: 'Examinations', href: '/examinations', permission: 'results.read', planned: true },
      { label: 'Results', href: '/results', permission: 'results.read', planned: true },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Finance', href: '/finance', permission: 'finance.read', planned: true },
      { label: 'Documents', href: '/documents', permission: 'documents.read', planned: true },
      { label: 'Notifications', href: '/notifications', permission: 'notifications.read', planned: true },
      { label: 'Reports', href: '/reports', permission: 'reports.read', planned: true },
      { label: 'Settings', href: '/settings', permission: 'settings.manage' },
    ],
  },
];

export const PLATFORM_NAV: readonly NavSection[] = [
  {
    label: 'Platform',
    items: [
      { label: 'Overview', href: '/platform' },
      { label: 'Institutions', href: '/platform/institutions', permission: 'platform.institutions.read' },
      { label: 'Plans', href: '/platform/plans', permission: 'platform.subscriptions.manage', planned: true },
      {
        label: 'Subscriptions',
        href: '/platform/subscriptions',
        permission: 'platform.subscriptions.manage',
        planned: true,
      },
      { label: 'Billing', href: '/platform/billing', permission: 'platform.billing.manage', planned: true },
      { label: 'Usage', href: '/platform/usage', permission: 'platform.usage.read', planned: true },
      { label: 'Audit log', href: '/platform/audit', permission: 'platform.audit.read', planned: true },
      { label: 'Settings', href: '/platform/settings', permission: 'platform.settings.manage', planned: true },
    ],
  },
];
