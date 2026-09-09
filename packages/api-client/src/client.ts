import type { ApiHealthStatus } from '@platform/shared-types';
import { generateUuidV7, snakeToCamel } from '@platform/utils';
import { ApiClientError } from './error.js';
import type { ApiClientConfig, RequestOptions, ApiResponse } from './types.js';

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly defaultTimeoutMs: number;
  private readonly autoGenerateRequestId: boolean;

  constructor(config: ApiClientConfig) {
    if (!config.baseUrl) {
      throw new Error('ApiClient requires a valid baseUrl');
    }
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.fetchFn = config.fetchFn ?? fetch;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 15000;
    this.autoGenerateRequestId = config.autoGenerateRequestId ?? true;
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
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}
