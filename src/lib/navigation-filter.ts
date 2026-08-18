import { hasPermission } from '@/lib/auth/authorization';
import type { AuthContext } from '@/lib/auth/types';
import type { NavSection } from '@/lib/navigation';

/**
 * Removes destinations the session cannot open, and then any section left
 * empty. Pure so it can be unit tested without rendering React.
 */
export function filterNavigation(
  sections: readonly NavSection[],
  context: AuthContext | null,
): NavSection[] {
  return sections
    .map((section) => ({
      label: section.label,
      items: section.items.filter(
        (item) => !item.permission || hasPermission(context, item.permission),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
