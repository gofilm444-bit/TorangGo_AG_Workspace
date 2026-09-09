import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveClientConfig } from '@platform/config';
import { createApiClient, ApiClient } from '@platform/api-client';

describe('Customer Mobile Shell Foundation Suite', () => {
  it('resolves customer client configuration with CUSTOMER_APP audience', () => {
    const config = resolveClientConfig({ audience: 'CUSTOMER_APP' });
    assert.equal(config.audience, 'CUSTOMER_APP');
    assert.ok(config.apiBaseUrl, 'API base URL must be resolved');
    assert.ok(!config.apiBaseUrl.endsWith('/'), 'Base URL must not have trailing slash');
  });

  it('initializes customer ApiClient with non-hardcoded configuration', () => {
    const config = resolveClientConfig({
      apiBaseUrl: 'http://localhost:3000',
      audience: 'CUSTOMER_APP',
    });
    const client = createApiClient({ baseUrl: config.apiBaseUrl });
    assert.ok(client instanceof ApiClient);
  });
});
