/**
 * Canonical Phase-2A1 Admin Permission Catalog for TorangGo.
 * Strongly typed permissions enforced by backend-authoritative RBAC.
 */
export const ADMIN_PERMISSIONS = {
  ACCESS: 'admin:access',
  READ: 'admin:read',
  WRITE: 'admin:write',
  OPS: 'admin:ops',
} as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

export const ALL_ADMIN_PERMISSIONS: readonly AdminPermission[] = [
  ADMIN_PERMISSIONS.ACCESS,
  ADMIN_PERMISSIONS.READ,
  ADMIN_PERMISSIONS.WRITE,
  ADMIN_PERMISSIONS.OPS,
] as const;
