import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveClientConfig } from '@platform/config';
import { createApiClient, ApiClient } from '@platform/api-client';

describe('Driver Mobile Shell Foundation Suite', () => {
  it('resolves driver client configuration with DRIVER_APP audience', () => {
    const config = resolveClientConfig({ audience: 'DRIVER_APP' });
    assert.equal(config.audience, 'DRIVER_APP');
    assert.ok(config.apiBaseUrl, 'API base URL must be resolved');
    assert.ok(!config.apiBaseUrl.endsWith('/'), 'Base URL must not have trailing slash');
  });

  it('initializes driver ApiClient with non-hardcoded configuration', () => {
    const config = resolveClientConfig({
      apiBaseUrl: 'http://localhost:3000',
      audience: 'DRIVER_APP',
    });
    const client = createApiClient({ baseUrl: config.apiBaseUrl });
    assert.ok(client instanceof ApiClient);
  });
});
