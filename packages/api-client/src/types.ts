export interface RequestOptions {
  headers?: Record<string, string>;
  requestId?: string;
  idempotencyKey?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
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
}

