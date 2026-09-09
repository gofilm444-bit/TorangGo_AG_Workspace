import type { ApiHealthStatus } from '@platform/shared-types';
import { API_CONFIG } from '@platform/config';

export interface ApiClientConfig {
  baseUrl: string;
  fetchFn?: typeof fetch;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async getHealth(): Promise<ApiHealthStatus> {
    const url = `${this.baseUrl}/${API_CONFIG.DEFAULT_PREFIX}/${API_CONFIG.HEALTH_PATH}`;
    const response = await this.fetchFn(url);
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }
    return (await response.json()) as ApiHealthStatus;
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}
export * from './error.js';
export * from './types.js';
export * from './client.js';
export * as OpenApiSchema from './generated/schema.js';
