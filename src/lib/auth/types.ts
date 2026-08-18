import type { Permission, RoleKey } from '@/lib/auth/permissions';

/** Identity of the caller, resolved on the server from the auth session. */
export interface AuthContext {
  readonly userId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly isPlatformAdmin: boolean;
  /** Null only for platform administrators. */
  readonly institutionId: string | null;
  readonly institution: TenantSummary | null;
  readonly roleKeys: readonly RoleKey[];
  readonly permissions: ReadonlySet<Permission>;
}

export interface TenantSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly shortName: string | null;
  readonly status: string;
  readonly currency: string;
  readonly timezone: string;
}

/** Any record that belongs to a tenant. */
export interface TenantOwned {
  readonly institutionId: string | null;
}
