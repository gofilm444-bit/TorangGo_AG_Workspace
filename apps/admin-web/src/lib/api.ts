import { createApiClient, type ApiClient } from '@platform/api-client';
import { adminConfig } from './config';

let memoryCsrfToken: string | null = null;

export function setAdminCsrfToken(token: string | null) {
  memoryCsrfToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('admin_csrf_token', token);
    } else {
      sessionStorage.removeItem('admin_csrf_token');
    }
  }
}

export function getAdminCsrfToken(): string | null {
  if (!memoryCsrfToken && typeof window !== 'undefined') {
    memoryCsrfToken = sessionStorage.getItem('admin_csrf_token');
  }
  return memoryCsrfToken;
}

/**
 * Shared ApiClient instance configured for TorangGo Admin Web.
 * Base URL comes strictly from client configuration without hardcoded hosts or ports.
 *
 * Phase 1G Auth Readiness:
 * When session/token handling is implemented in Phase 1G, auth headers or interceptors
 * will be injected through this client foundation.
 * Transport uses HttpOnly session cookies (`credentials: 'include'`) and CSRF token injection.
 */
export const adminApiClient: ApiClient = createApiClient({
  baseUrl: adminConfig.apiBaseUrl,
  credentials: 'include',
  getCsrfToken: () => getAdminCsrfToken(),
});
