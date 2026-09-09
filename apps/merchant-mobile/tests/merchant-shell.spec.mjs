import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveClientConfig } from '@platform/config';
import { createApiClient, ApiClient } from '@platform/api-client';

describe('Merchant Mobile Shell Foundation Suite', () => {
  it('resolves merchant client configuration with MERCHANT_APP audience', () => {
    const config = resolveClientConfig({ audience: 'MERCHANT_APP' });
    assert.equal(config.audience, 'MERCHANT_APP');
    assert.ok(config.apiBaseUrl, 'API base URL must be resolved');
    assert.ok(!config.apiBaseUrl.endsWith('/'), 'Base URL must not have trailing slash');
  });

  it('initializes merchant ApiClient with non-hardcoded configuration', () => {
    const config = resolveClientConfig({
      apiBaseUrl: 'http://localhost:3000',
      audience: 'MERCHANT_APP',
    });
    const client = createApiClient({ baseUrl: config.apiBaseUrl });
    assert.ok(client instanceof ApiClient);
  });
});
