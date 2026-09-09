import { createApiClient, type ApiClient } from '@platform/api-client';
import { merchantConfig } from './config.js';

/**
 * Shared ApiClient instance configured for Merchant Mobile app.
 * Base URL comes strictly from client configuration without hardcoded IPs or ports.
 */
export const merchantApiClient: ApiClient = createApiClient({
  baseUrl: merchantConfig.apiBaseUrl,
});
