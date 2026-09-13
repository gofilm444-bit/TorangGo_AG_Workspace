import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, createApiClient } from './client.js';
import { ApiClientError } from './error.js';

describe('ApiClient Foundation Suite', () => {
  it('invokes default fetch with the global receiver', async (t) => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async function (this: unknown, ...[input, init]: Parameters<typeof fetch>) {
      if (this !== globalThis) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      calls += 1;
      assert.equal(input, 'https://api.example.test/api/v1/health');
      assert.equal(init?.method, 'GET');
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    });

    const client = new ApiClient({ baseUrl: 'https://api.example.test' });
    assert.equal((await client.getHealth()).status, 'ok');
    assert.equal(calls, 1);
  });

  it('preserves the supplied custom fetch receiver and bypasses global fetch', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => {
      assert.fail('Custom fetch must bypass global fetch');
    });
    let calls = 0;
    const customFetch: typeof fetch = async function (this: unknown, ...[input, init]: Parameters<typeof fetch>) {
      assert.equal(this, client);
      calls += 1;
      assert.equal(input, 'https://api.example.test/api/v1/health');
      assert.equal(init?.method, 'GET');
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    };
    const client = new ApiClient({
      baseUrl: 'https://api.example.test',
      fetchFn: customFetch,
    });

    assert.equal((await client.getHealth()).status, 'ok');
    assert.equal(calls, 1);
  });
  it('successfully retrieves health status', async () => {
    const mockFetch: typeof fetch = async (input, init) => {
      const url = input.toString();
      assert.ok(url.endsWith('/api/v1/health'));
      assert.equal(init?.method, 'GET');

      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'mock-req-123',
        },
      });
    };

    const client = createApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: mockFetch,
    });

    const health = await client.getHealth();
    assert.equal(health.status, 'ok');
  });

  it('generates and propagates X-Request-ID when not supplied', async () => {
    let capturedRequestId: string | null = null;

    const mockFetch: typeof fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      capturedRequestId = headers.get('X-Request-ID');

      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': capturedRequestId ?? '',
        },
      });
    };

    const client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: mockFetch,
      autoGenerateRequestId: true,
    });

    await client.getHealth();
    assert.ok(capturedRequestId, 'Expected an auto-generated X-Request-ID');
    assert.match(
      capturedRequestId!,
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      'Expected a valid UUIDv7',
    );
  });

  it('injects caller-supplied Idempotency-Key and detects X-Idempotency-Replayed', async () => {
    let capturedIdempotencyKey: string | null = null;

    const mockFetch: typeof fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      capturedIdempotencyKey = headers.get('Idempotency-Key');

      return new Response(JSON.stringify({ created: true }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'req-idem-1',
          'X-Idempotency-Replayed': 'true',
        },
      });
    };

    const client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: mockFetch,
    });

    const res = await client.request(
      '/api/v1/orders',
      { method: 'POST', body: JSON.stringify({ amount: 50000 }) },
      { idempotencyKey: 'idem-key-abc-123' },
    );

    assert.equal(capturedIdempotencyKey, 'idem-key-abc-123');
    assert.equal(res.isReplayed, true);
    assert.equal(res.status, 201);
  });

  it('parses standard TorangGo error responses into typed ApiClientError', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid payload provided',
            details: [{ field: 'amount', message: 'Must be positive' }],
            request_id: 'err-req-999',
          },
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': 'err-req-999',
          },
        },
      );
    };

    const client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: mockFetch,
    });

    await assert.rejects(
      async () => {
        await client.request('/api/v1/resource');
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'VALIDATION_ERROR');
        assert.equal(err.status, 400);
        assert.equal(err.requestId, 'err-req-999');
        assert.equal(err.message, 'Invalid payload provided');
        assert.deepEqual(err.details, [{ field: 'amount', message: 'Must be positive' }]);
        return true;
      },
    );
  });

  it('handles request timeout gracefully with TIMEOUT_ERROR code', async () => {
    const mockFetch: typeof fetch = async (_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    };

    const client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: mockFetch,
      defaultTimeoutMs: 50,
    });

    await assert.rejects(
      async () => {
        await client.request('/api/v1/slow-endpoint', {}, { timeoutMs: 50 });
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'TIMEOUT_ERROR');
        assert.ok(err.message.includes('timed out'));
        return true;
      },
    );
  });

  it('automatically maps snake_case wire responses to camelCase runtime representation', async () => {
    interface WireOrderPayload {
      order_id: string;
      total_amount: number;
      created_at: string;
      customer_info: {
        full_name: string;
        phone_number: string;
      };
    }

    interface OrderModel {
      orderId: string;
      totalAmount: number;
      createdAt: string;
      customerInfo: {
        fullName: string;
        phoneNumber: string;
      };
    }

    const mockFetch: typeof fetch = async () => {
      const wireResponse: WireOrderPayload = {
        order_id: 'ord-01',
        total_amount: 75000,
        created_at: '2026-09-09T03:00:00.000Z',
        customer_info: {
          full_name: 'Budi Santoso',
          phone_number: '+628123456789',
        },
      };

      return new Response(JSON.stringify(wireResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: mockFetch,
    });

    const res = await client.request<OrderModel>('/api/v1/orders/1');
    assert.equal(res.data.orderId, 'ord-01');
    assert.equal(res.data.totalAmount, 75000);
    assert.equal(res.data.createdAt, '2026-09-09T03:00:00.000Z');
    assert.equal(res.data.customerInfo.fullName, 'Budi Santoso');
    assert.equal(res.data.customerInfo.phoneNumber, '+628123456789');
  });

  it('injects Authorization and X-CSRF-Token headers and respects credentials option', async () => {
    let capturedAuth: string | null = null;
    let capturedCsrf: string | null = null;
    let capturedCredentials: RequestCredentials | undefined;

    const mockFetch: typeof fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      capturedAuth = headers.get('Authorization');
      capturedCsrf = headers.get('X-CSRF-Token');
      capturedCredentials = init?.credentials;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: mockFetch,
      credentials: 'include',
      getAuthToken: () => 'bearer-token-from-provider',
      getCsrfToken: () => 'csrf-token-from-provider',
    });

    await client.logout();
    assert.equal(capturedAuth, 'Bearer bearer-token-from-provider');
    assert.equal(capturedCsrf, 'csrf-token-from-provider');
    assert.equal(capturedCredentials, 'include');
  });

  it('correctly invokes mobile and admin auth endpoints', async () => {
    const invokedPaths: string[] = [];

    const mockFetch: typeof fetch = async (input, init) => {
      const url = input.toString();
      invokedPaths.push(`${init?.method} ${url.replace('http://localhost:3000', '')}`);

      if (url.includes('/mobile/request-otp')) {
        return new Response(
          JSON.stringify({ challenge_id: 'chal-1', resend_available_in_seconds: 60 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/admin/login')) {
        return new Response(
          JSON.stringify({ mfa_required: true, mfa_challenge_token: 'mfa-tok-1' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: mockFetch,
    });

    const otpRes = await client.requestMobileOtp({ phone: '+6281234567890', audience: 'CUSTOMER_APP' });
    assert.equal(otpRes.challengeId, 'chal-1');
    assert.equal(otpRes.resendAvailableInSeconds, 60);

    const adminRes = await client.adminLogin({ identifier: 'admin', password: 'secret' });
    assert.equal(adminRes.mfaRequired, true);
    assert.equal(adminRes.mfaChallengeToken, 'mfa-tok-1');

    assert.ok(invokedPaths.includes('POST /api/v1/auth/mobile/request-otp'));
    assert.ok(invokedPaths.includes('POST /api/v1/auth/admin/login'));
  });
});
