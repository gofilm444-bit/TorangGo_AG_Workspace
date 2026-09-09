import type { ApiErrorResponse } from '@platform/shared-types';

/**
 * Standard client error for TorangGo APIs.
 * Preserves standard error attributes from HTTP response.
 */
export class ApiClientError extends Error {
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string;
  readonly status: number;

  constructor(params: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
    status: number;
  }) {
    super(params.message);
    this.name = 'ApiClientError';
    this.code = params.code;
    this.details = params.details;
    this.requestId = params.requestId ?? '';
    this.status = params.status;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Attempts to parse an ApiClientError from a fetch Response and body.
   */
  static async fromResponse(response: Response): Promise<ApiClientError> {
    const status = response.status;
    const headerRequestId = response.headers.get('x-request-id') ?? '';

    try {
      const json = (await response.json()) as ApiErrorResponse | Record<string, unknown>;

      if (json && typeof json === 'object' && 'error' in json && json.error) {
        const err = json.error as {
          code?: string;
          message?: string;
          details?: unknown;
          request_id?: string;
        };

        return new ApiClientError({
          code: err.code ?? 'UNKNOWN_ERROR',
          message: err.message ?? `Request failed with status ${status}`,
          details: err.details,
          requestId: err.request_id ?? headerRequestId,
          status,
        });
      }

      return new ApiClientError({
        code: 'HTTP_ERROR',
        message: `HTTP Error ${status}`,
        details: json,
        requestId: headerRequestId,
        status,
      });
    } catch {
      return new ApiClientError({
        code: 'NETWORK_ERROR',
        message: `Request failed with HTTP status ${status}`,
        requestId: headerRequestId,
        status,
      });
    }
  }
}

