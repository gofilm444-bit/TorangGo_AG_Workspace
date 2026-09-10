import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { redactHeaders, redactObject, redactUrlOrQuery } from './log-redaction.js';

describe('Log Redaction Suite', () => {
  test('should redact sensitive HTTP headers case-insensitively', () => {
    const rawSecrets = {
      auth: 'Bearer ultra-secret-token-123',
      cookie: 'session_id=confidential456',
      setCookie: 'remember_me=secret789',
      apiKey: 'key_live_abcdef012345',
      csrfToken: 'csrf_secret_token_val_999',
    };

    const headers = {
      'Content-Type': 'application/json',
      Authorization: rawSecrets.auth,
      COOKIE: rawSecrets.cookie,
      'Set-Cookie': rawSecrets.setCookie,
      'X-Api-Key': rawSecrets.apiKey,
      'X-CSRF-Token': rawSecrets.csrfToken,
      'X-Request-ID': 'req-safe-uuid-123',
    };

    const redacted = redactHeaders(headers);

    assert.equal(redacted['Content-Type'], 'application/json');
    assert.equal(redacted['X-Request-ID'], 'req-safe-uuid-123');
    assert.equal(redacted['Authorization'], '[REDACTED]');
    assert.equal(redacted['COOKIE'], '[REDACTED]');
    assert.equal(redacted['Set-Cookie'], '[REDACTED]');
    assert.equal(redacted['X-Api-Key'], '[REDACTED]');
    assert.equal(redacted['X-CSRF-Token'], '[REDACTED]');

    const serialized = JSON.stringify(redacted);
    assert.equal(serialized.includes(rawSecrets.auth), false);
    assert.equal(serialized.includes(rawSecrets.cookie), false);
    assert.equal(serialized.includes(rawSecrets.setCookie), false);
    assert.equal(serialized.includes(rawSecrets.apiKey), false);
    assert.equal(serialized.includes(rawSecrets.csrfToken), false);
  });

  test('should redact sensitive object fields recursively with camelCase and snake_case variants', () => {
    const rawSecrets = {
      password: 'SuperSecretPassword!99',
      otp: '987654',
      token: 'raw.jwt.token',
      accessToken: 'at_1234567890',
      refreshToken: 'rt_0987654321',
      clientSecret: 'cs_xyz_secret_999',
      creditCard: '4111111111111111',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      recoveryCode: 'ABCD-EFGH-1234',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
      csrfSecret: 'csrf-secret-value-321',
      encryptionKey: '0123456789abcdef0123456789abcdef',
    };

    const payload = {
      username: 'johndoe',
      password: rawSecrets.password,
      otp: rawSecrets.otp,
      token: rawSecrets.token,
      accessToken: rawSecrets.accessToken,
      access_token: rawSecrets.accessToken,
      refreshToken: rawSecrets.refreshToken,
      refresh_token: rawSecrets.refreshToken,
      apiKey: 'api-key-val',
      api_key: 'api-key-val',
      clientSecret: rawSecrets.clientSecret,
      client_secret: rawSecrets.clientSecret,
      'x-api-key': 'x-api-key-val',
      totp_secret: rawSecrets.totpSecret,
      totpSecret: rawSecrets.totpSecret,
      recovery_code: rawSecrets.recoveryCode,
      recoveryCode: rawSecrets.recoveryCode,
      password_hash: rawSecrets.passwordHash,
      csrf_secret: rawSecrets.csrfSecret,
      encryption_key: rawSecrets.encryptionKey,
      nested: {
        credit_card: rawSecrets.creditCard,
        publicField: 'visible_data',
        arrayField: [
          { apiKey: 'secret_nested_key_111' },
          { harmless: 'item' },
        ],
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redacted = redactObject(payload) as any;

    assert.equal(redacted['username'], 'johndoe');
    assert.equal(redacted['password'], '[REDACTED]');
    assert.equal(redacted['otp'], '[REDACTED]');
    assert.equal(redacted['token'], '[REDACTED]');
    assert.equal(redacted['accessToken'], '[REDACTED]');
    assert.equal(redacted['access_token'], '[REDACTED]');
    assert.equal(redacted['refreshToken'], '[REDACTED]');
    assert.equal(redacted['refresh_token'], '[REDACTED]');
    assert.equal(redacted['apiKey'], '[REDACTED]');
    assert.equal(redacted['api_key'], '[REDACTED]');
    assert.equal(redacted['clientSecret'], '[REDACTED]');
    assert.equal(redacted['client_secret'], '[REDACTED]');
    assert.equal(redacted['x-api-key'], '[REDACTED]');
    assert.equal(redacted['totp_secret'], '[REDACTED]');
    assert.equal(redacted['totpSecret'], '[REDACTED]');
    assert.equal(redacted['recovery_code'], '[REDACTED]');
    assert.equal(redacted['recoveryCode'], '[REDACTED]');
    assert.equal(redacted['password_hash'], '[REDACTED]');
    assert.equal(redacted['csrf_secret'], '[REDACTED]');
    assert.equal(redacted['encryption_key'], '[REDACTED]');
    assert.equal(redacted['nested'].credit_card, '[REDACTED]');
    assert.equal(redacted['nested'].publicField, 'visible_data');
    assert.equal(redacted['nested'].arrayField[0].apiKey, '[REDACTED]');
    assert.equal(redacted['nested'].arrayField[1].harmless, 'item');

    const serialized = JSON.stringify(redacted);
    for (const secret of Object.values(rawSecrets)) {
      assert.equal(serialized.includes(secret), false);
    }
    assert.equal(serialized.includes('secret_nested_key_111'), false);
  });

  test('should redact sensitive URL query parameters', () => {
    const rawSecret = 'secret_query_token_abc123';
    const rawUrl = `/api/v1/resource?token=${rawSecret}&page=2&limit=50&apiKey=secretKey456`;
    const redactedUrl = redactUrlOrQuery(rawUrl);

    assert.equal(redactedUrl.includes(rawSecret), false);
    assert.equal(redactedUrl.includes('secretKey456'), false);
    assert.ok(redactedUrl.includes('page=2'));
    assert.ok(redactedUrl.includes('limit=50'));
  });
});
