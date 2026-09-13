import type { ApiHealthStatus } from '@platform/shared-types';
import { generateUuidV7, snakeToCamel } from '@platform/utils';
import { ApiClientError } from './error.js';
import type { ApiClientConfig, RequestOptions, ApiResponse } from './types.js';

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly defaultTimeoutMs: number;
  private readonly autoGenerateRequestId: boolean;
  private readonly getAuthToken?: () => string | Promise<string | null | undefined> | null | undefined;
  private readonly getCsrfToken?: () => string | Promise<string | null | undefined> | null | undefined;
  private readonly credentials?: RequestCredentials;

  constructor(config: ApiClientConfig) {
    if (!config.baseUrl) {
      throw new Error('ApiClient requires a valid baseUrl');
    }
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.fetchFn = config.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 15000;
    this.autoGenerateRequestId = config.autoGenerateRequestId ?? true;
    this.getAuthToken = config.getAuthToken;
    this.getCsrfToken = config.getCsrfToken;
    this.credentials = config.credentials;
  }

  /**
   * Core request dispatcher with header injection, timeout, and standard error handling.
   */
  async request<T>(
    path: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${this.baseUrl}${normalizedPath}`;

    const headers = new Headers(init.headers);

    // Caller-provided or auto-generated X-Request-ID
    const requestId =
      options.requestId ??
      headers.get('X-Request-ID') ??
      (this.autoGenerateRequestId ? generateUuidV7() : undefined);

    if (requestId) {
      headers.set('X-Request-ID', requestId);
    }

    // Idempotency-Key header injection
    if (options.idempotencyKey) {
      headers.set('Idempotency-Key', options.idempotencyKey);
    }

    // Auth Token header injection (Bearer)
    const token =
      options.authToken ?? (this.getAuthToken ? await this.getAuthToken() : undefined);
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // CSRF Token header injection
    const csrfToken =
      options.csrfToken ?? (this.getCsrfToken ? await this.getCsrfToken() : undefined);
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }

    // Set JSON content-type if body is provided and not already set
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    // Handle timeout and abort signals
    let signal = options.signal ?? init.signal;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    if (timeoutMs > 0 && !signal) {
      const controller = new AbortController();
      signal = controller.signal;
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    try {
      const response = await this.fetchFn(url, {
        ...init,
        credentials: init.credentials ?? this.credentials,
        headers,
        signal,
      });

      if (!response.ok) {
        throw await ApiClientError.fromResponse(response);
      }

      const isReplayed = response.headers.get('x-idempotency-replayed') === 'true';
      const responseRequestId = response.headers.get('x-request-id') ?? requestId ?? '';

      // Handle 204 No Content
      if (response.status === 204) {
        return {
          data: undefined as unknown as T,
          status: response.status,
          headers: response.headers,
          requestId: responseRequestId,
          isReplayed,
        };
      }

      const rawJson = await response.json();
      const data = snakeToCamel<T>(rawJson);

      return {
        data,
        status: response.status,
        headers: response.headers,
        requestId: responseRequestId,
        isReplayed,
      };
    } catch (err) {
      if (err instanceof ApiClientError) {
        throw err;
      }
      const isAbort = (err as Error)?.name === 'AbortError';
      throw new ApiClientError({
        code: isAbort ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR',
        message: isAbort ? `Request timed out after ${timeoutMs}ms` : ((err as Error)?.message ?? 'Network error'),
        requestId: requestId ?? '',
        status: 0,
      });
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Health check endpoint.
   */
  async getHealth(options?: RequestOptions): Promise<ApiHealthStatus> {
    const res = await this.request<ApiHealthStatus>('/api/v1/health', { method: 'GET' }, options);
    return res.data;
  }

  /**
   * Request 6-digit OTP for mobile applications.
   */
  async requestMobileOtp(
    body: { phone: string; audience: string; installation_id?: string },
    options?: RequestOptions,
  ) {
    const res = await this.request<{ challengeId: string; resendAvailableInSeconds: number }>(
      '/api/v1/auth/mobile/request-otp',
      { method: 'POST', body: JSON.stringify(body) },
      options,
    );
    return res.data;
  }

  /**
   * Verify 6-digit OTP for mobile applications.
   */
  async verifyMobileOtp<T = unknown>(
    body: { phone: string; audience: string; otp: string; installation_id?: string },
    options?: RequestOptions,
  ) {
    const res = await this.request<T>(
      '/api/v1/auth/mobile/verify-otp',
      { method: 'POST', body: JSON.stringify(body) },
      options,
    );
    return res.data;
  }

  /**
   * Rotate refresh token.
   */
  async refreshTokens<T = unknown>(
    body: { refresh_token: string },
    options?: RequestOptions,
  ) {
    const res = await this.request<T>(
      '/api/v1/auth/refresh',
      { method: 'POST', body: JSON.stringify(body) },
      options,
    );
    return res.data;
  }

  /**
   * Revoke current session.
   */
  async logout(options?: RequestOptions) {
    const res = await this.request<{ success: boolean }>(
      '/api/v1/auth/logout',
      { method: 'POST' },
      options,
    );
    return res.data;
  }

  /**
   * Revoke all sessions for authenticated principal.
   */
  async logoutAll(options?: RequestOptions) {
    const res = await this.request<{ success: boolean }>(
      '/api/v1/auth/logout-all',
      { method: 'POST' },
      options,
    );
    return res.data;
  }

  /**
   * Retrieve identity for current session.
   */
  async getMe<T = unknown>(options?: RequestOptions): Promise<T> {
    const res = await this.request<T>('/api/v1/auth/me', { method: 'GET' }, options);
    return res.data;
  }

  /**
   * Admin login step 1: Validate credentials and obtain MFA challenge token.
   */
  async adminLogin(
    body: { identifier: string; password: string },
    options?: RequestOptions,
  ) {
    const res = await this.request<{ mfaRequired: boolean; mfaChallengeToken: string }>(
      '/api/v1/auth/admin/login',
      { method: 'POST', body: JSON.stringify(body) },
      options,
    );
    return res.data;
  }

  /**
   * Admin login step 2: Verify TOTP / recovery code.
   */
  async adminMfaVerify<T = unknown>(
    body: { mfa_challenge_token: string; code: string },
    options?: RequestOptions,
  ) {
    const res = await this.request<T>(
      '/api/v1/auth/admin/mfa/verify',
      { method: 'POST', body: JSON.stringify(body) },
      options,
    );
    return res.data;
  }

  /**
   * Admin CSRF token retrieval / cookie refresh.
   */
  async adminCsrf(options?: RequestOptions) {
    const res = await this.request<{ csrfToken: string }>(
      '/api/v1/auth/admin/csrf',
      { method: 'POST' },
      options,
    );
    return res.data;
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}
