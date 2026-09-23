export interface RequestOptions {
  headers?: Record<string, string>;
  requestId?: string;
  idempotencyKey?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  authToken?: string;
  csrfToken?: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
  requestId: string;
  isReplayed: boolean;
}

export interface ApiClientConfig {
  baseUrl: string;
  fetchFn?: typeof fetch;
  defaultTimeoutMs?: number;
  /**
   * If true, generates an RFC 9562 UUIDv7 for X-Request-ID when not provided.
   * Defaults to true.
   */
  autoGenerateRequestId?: boolean;
  /**
   * Optional async callback to resolve access token for requests.
   */
  getAuthToken?: () => string | Promise<string | null | undefined> | null | undefined;
  /**
   * Optional async callback to resolve CSRF token for mutating browser requests.
   */
  getCsrfToken?: () => string | Promise<string | null | undefined> | null | undefined;
  /**
   * Request credentials mode (e.g. 'include' for cookie transport in Admin Web).
   */
  credentials?: RequestCredentials;
}

export interface MobileUserSummaryDto {
  id: string;
  phone: string;
  status: string;
  customer_profile?: { id: string; name?: string } | null;
  merchant_profile?: { id: string; business_name?: string; status: string } | null;
  driver_profile?: { id: string; full_name?: string; status: string } | null;
}

export interface MobileAuthResponseDto {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: MobileUserSummaryDto;
}

export interface AdminUserSummaryDto {
  id: string;
  email: string;
  username: string;
  full_name: string;
  status: string;
  roles: string[];
  permissions: string[];
}

export interface AdminMfaChallengeResponseDto {
  mfaRequired: boolean;
  mfaChallengeToken: string;
}

export interface AdminMfaVerifyResponseDto {
  success: boolean;
  admin: AdminUserSummaryDto;
  csrfToken: string;
}

import type { components } from './generated/schema.js';

export type AdminOverviewUsersDto = components['schemas']['AdminOverviewUsersDto'];
export type AdminOverviewMerchantsDto = components['schemas']['AdminOverviewMerchantsDto'];
export type AdminOverviewDriversDto = components['schemas']['AdminOverviewDriversDto'];
export type AdminOverviewResponseDto = components['schemas']['AdminOverviewResponseDto'];

export type MerchantVerificationItemDto = components['schemas']['MerchantVerificationItemDto'];
export type MerchantVerificationListResponseDto = components['schemas']['MerchantVerificationListResponseDto'];
export type VerificationAuditLogItemDto = components['schemas']['VerificationAuditLogItemDto'];
export type MerchantVerificationDetailResponseDto = components['schemas']['MerchantVerificationDetailResponseDto'];
export type ApproveVerificationActionDto = components['schemas']['ApproveVerificationActionDto'];
export type ReasonRequiredVerificationActionDto = components['schemas']['ReasonRequiredVerificationActionDto'];
export type DriverVerificationItemDto = components['schemas']['DriverVerificationItemDto'];
export type DriverVerificationListResponseDto = components['schemas']['DriverVerificationListResponseDto'];
export type DriverVerificationDetailResponseDto = components['schemas']['DriverVerificationDetailResponseDto'];

export type MerchantOnboardingDocumentDto = components['schemas']['MerchantOnboardingDocumentDto'];
export type MerchantOnboardingSubmissionDto = components['schemas']['MerchantOnboardingSubmissionDto'];
export type MerchantOnboardingDraftDto = components['schemas']['MerchantOnboardingDraftDto'];
export type MerchantOnboardingStatusResponseDto = components['schemas']['MerchantOnboardingStatusResponseDto'];
export type SaveMerchantOnboardingDraftDto = components['schemas']['SaveMerchantOnboardingDraftDto'];
export type SubmitMerchantOnboardingDto = components['schemas']['SubmitMerchantOnboardingDto'];
export type ApproveMerchantVerificationActionDto = components['schemas']['ApproveMerchantVerificationActionDto'];
export type RejectMerchantVerificationActionDto = components['schemas']['RejectMerchantVerificationActionDto'];
export type RevealNikResponseDto = components['schemas']['RevealNikResponseDto'];

export interface VerificationQueryOptions {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  q?: string;
  page?: number;
  limit?: number;
}
