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
