import { describe, expect, it } from 'vitest';

import { filterNavigation } from '@/lib/navigation-filter';
import { INSTITUTION_NAV, PLATFORM_NAV } from '@/lib/navigation';
import { authContext } from '../helpers/db';

describe('navigation filtering', () => {
  it('hides destinations the session cannot open', () => {
    const lecturer = authContext({ institutionId: 'inst-a', roleKeys: ['LECTURER'] });
    const labels = filterNavigation(INSTITUTION_NAV, lecturer)
      .flatMap((section) => section.items)
      .map((item) => item.label);

    expect(labels).toContain('Timetable');
    expect(labels).not.toContain('Finance');
    expect(labels).not.toContain('Settings');
  });

  it('drops sections that end up empty', () => {
    const sections = filterNavigation(PLATFORM_NAV, authContext({ institutionId: 'inst-a', roleKeys: ['STUDENT'] }));
    const labels = sections.flatMap((section) => section.items).map((item) => item.label);

    // Only the permission-free platform overview link survives, and the layout
    // itself still redirects non-platform users away.
    expect(labels).toEqual(['Overview']);
  });

  it('shows the full institution menu to an institution administrator', () => {
    const admin = authContext({ institutionId: 'inst-a', roleKeys: ['INSTITUTION_ADMIN'] });
    const sections = filterNavigation(INSTITUTION_NAV, admin);
    const total = INSTITUTION_NAV.flatMap((section) => section.items).length;

    expect(sections.flatMap((section) => section.items)).toHaveLength(total);
  });

  it('shows nothing but public destinations to an anonymous caller', () => {
    const sections = filterNavigation(INSTITUTION_NAV, null);
    const labels = sections.flatMap((section) => section.items).map((item) => item.label);
    expect(labels).toEqual(['Dashboard']);
  });

  it('shows Admissions to staff who can read applications', () => {
    const officer = authContext({ institutionId: 'inst-a', roleKeys: ['ADMISSIONS_OFFICER'] });
    const labels = filterNavigation(INSTITUTION_NAV, officer)
      .flatMap((section) => section.items)
      .map((item) => item.label);

    expect(labels).toContain('Admissions');
    expect(labels).toContain('Students');
  });

  it('marks Admissions as a shipped destination', () => {
    const admissions = INSTITUTION_NAV.flatMap((section) => section.items).find(
      (item) => item.href === '/admissions',
    );
    expect(admissions?.planned).toBeFalsy();
  });

  it('hides Admissions from a student session', () => {
    const student = authContext({ institutionId: 'inst-a', roleKeys: ['STUDENT'] });
    const labels = filterNavigation(INSTITUTION_NAV, student)
      .flatMap((section) => section.items)
      .map((item) => item.label);
    expect(labels).not.toContain('Admissions');
    expect(labels).not.toContain('Students');
  });
});
