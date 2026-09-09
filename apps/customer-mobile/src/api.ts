import { createApiClient, type ApiClient } from '@platform/api-client';
import { customerConfig } from './config.js';

/**
 * Shared ApiClient instance configured for Customer Mobile app.
 * Base URL comes strictly from client configuration without hardcoded IPs or ports.
 */
export const customerApiClient: ApiClient = createApiClient({
  baseUrl: customerConfig.apiBaseUrl,
});
