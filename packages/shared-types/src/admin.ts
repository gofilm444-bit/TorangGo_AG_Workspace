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

export const PROFILE_VERIFICATION_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
} as const;

export type ProfileVerificationStatus =
  (typeof PROFILE_VERIFICATION_STATUSES)[keyof typeof PROFILE_VERIFICATION_STATUSES];

export const ALL_PROFILE_VERIFICATION_STATUSES: readonly ProfileVerificationStatus[] = [
  PROFILE_VERIFICATION_STATUSES.PENDING,
  PROFILE_VERIFICATION_STATUSES.APPROVED,
  PROFILE_VERIFICATION_STATUSES.REJECTED,
  PROFILE_VERIFICATION_STATUSES.SUSPENDED,
] as const;

export const PROFILE_VERIFICATION_ACTIONS = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  SUSPEND: 'SUSPEND',
  REACTIVATE: 'REACTIVATE',
} as const;

export type ProfileVerificationAction =
  (typeof PROFILE_VERIFICATION_ACTIONS)[keyof typeof PROFILE_VERIFICATION_ACTIONS];

export const ALL_PROFILE_VERIFICATION_ACTIONS: readonly ProfileVerificationAction[] = [
  PROFILE_VERIFICATION_ACTIONS.APPROVE,
  PROFILE_VERIFICATION_ACTIONS.REJECT,
  PROFILE_VERIFICATION_ACTIONS.SUSPEND,
  PROFILE_VERIFICATION_ACTIONS.REACTIVATE,
] as const;

export const PROFILE_TYPES = {
  MERCHANT: 'MERCHANT',
  DRIVER: 'DRIVER',
} as const;

export type ProfileType = (typeof PROFILE_TYPES)[keyof typeof PROFILE_TYPES];
