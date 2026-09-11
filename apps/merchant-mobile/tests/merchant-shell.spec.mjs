import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveClientConfig } from '@platform/config';
import { createApiClient, ApiClient } from '@platform/api-client';

describe('TorangGo Mitra / Merchant Mobile Shell Foundation Suite', () => {
  it('resolves partner client configuration with canonical PARTNER_APP audience', () => {
    const config = resolveClientConfig({ audience: 'PARTNER_APP' });
    assert.equal(config.audience, 'PARTNER_APP');
    assert.ok(config.apiBaseUrl, 'API base URL must be resolved');
    assert.ok(!config.apiBaseUrl.endsWith('/'), 'Base URL must not have trailing slash');
  });

  it('supports legacy MERCHANT_APP audience for migration compatibility', () => {
    const config = resolveClientConfig({ audience: 'MERCHANT_APP' });
    assert.equal(config.audience, 'MERCHANT_APP');
  });

  it('initializes partner ApiClient with non-hardcoded configuration and PARTNER_APP', () => {
    const config = resolveClientConfig({
      apiBaseUrl: 'http://localhost:3000',
      audience: 'PARTNER_APP',
    });
    const client = createApiClient({ baseUrl: config.apiBaseUrl });
    assert.ok(client instanceof ApiClient);
  });
});
