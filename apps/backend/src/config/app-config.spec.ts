import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppConfig } from './app-config.js';

describe('AppConfig Validation', () => {
  test('should load valid default development configuration', () => {
    const config = loadAppConfig({
      NODE_ENV: 'development',
      PORT: '4000',
    });

    assert.equal(config.nodeEnv, 'development');
    assert.equal(config.port, 4000);
    assert.equal(config.host, '0.0.0.0');
    assert.equal(config.apiPrefix, 'api/v1');
    assert.deepEqual(config.corsOrigins, ['http://localhost:3000']);
    assert.equal(config.apiDocsEnabled, true);
    assert.equal(config.isDevelopment, true);
    assert.equal(config.databaseUrl, 'postgresql://postgres:postgres@localhost:5433/toranggo_dev');
    assert.equal(config.databasePoolMin, 2);
    assert.equal(config.databasePoolMax, 10);
    assert.equal(config.databaseSsl, false);
  });

  test('should fail fast on invalid PORT', () => {
    assert.throws(
      () => {
        loadAppConfig({
          PORT: 'not-a-number',
        });
      },
      (err: Error) => err.message.includes('Invalid environment configuration'),
    );
  });

  test('should fail fast on invalid NODE_ENV', () => {
    assert.throws(
      () => {
        loadAppConfig({
          NODE_ENV: 'invalid-env',
        });
      },
      (err: Error) => err.message.includes('Invalid environment configuration'),
    );
  });

  test('should forbid wildcard CORS in production', () => {
    assert.throws(
      () => {
        loadAppConfig({
          NODE_ENV: 'production',
          CORS_ORIGINS: '*',
        });
      },
      (err: Error) => err.message.includes('Wildcard CORS origin'),
    );
  });
});