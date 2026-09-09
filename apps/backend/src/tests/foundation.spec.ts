import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import request from 'supertest';
import { Controller, Get, Post, Body, Module, INestApplication } from '@nestjs/common';
import { IsString, IsNotEmpty, IsEmail } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { createApp } from '../bootstrap/create-app.js';
import { loadAppConfig } from '../config/app-config.js';
import { UnauthorizedError } from '../common/errors/app-error.js';
import { Idempotent } from '../common/idempotency/idempotent.decorator.js';
import { AppModule } from '../app.module.js';
import { sanitizeRequestId } from '../common/middleware/request-id.middleware.js';

class CreateTestItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;
}

@Controller('test')
class TestHarnessController {
  @Get('unauthorized')
  getUnauthorized(): void {
    throw new UnauthorizedError('Custom unauthorized message');
  }

  @Get('crash')
  getCrash(): void {
    throw new Error('Secret internal database failure stack');
  }

  @Post('validate')
  createItem(@Body() dto: CreateTestItemDto): { received: CreateTestItemDto } {
    return { received: dto };
  }

  @Post('idempotent-action')
  @Idempotent()
  doAction(@Body() body: Record<string, unknown>): { status: string; data: Record<string, unknown>; timestamp: number } {
    return {
      status: 'processed',
      data: body,
      timestamp: 1700000000000,
    };
  }

  @Get('rate-limited')
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  getRateLimited(): { ok: boolean } {
    return { ok: true };
  }

  @Post('upload-json')
  receivePayload(@Body() body: Record<string, unknown>): { receivedBytes: number } {
    return { receivedBytes: JSON.stringify(body).length };
  }
}

@Module({
  imports: [AppModule],
  controllers: [TestHarnessController],
})
class TestAppModule {}

describe('Backend Foundation End-to-End Suite', () => {
  let app: INestApplication;
  let server: Server;

  before(async () => {
    const config = loadAppConfig({
      NODE_ENV: 'test',
      PORT: '4001',
      LOG_LEVEL: 'silent',
      API_DOCS_ENABLED: 'false',
      CORS_ORIGINS: 'http://localhost:3000',
    });

    const instance = await createApp({
      config,
      module: TestAppModule,
    });

    app = instance.app;
    await app.init();
    // Nest owns the listener throughout the suite, including failed requests.
    await app.listen(0, '127.0.0.1');
    server = app.getHttpServer() as Server;
  });

  after(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Health Check', () => {
    it('returns 200 {"status":"ok"} at /api/v1/health', async () => {
      const res = await request(server)
        .get('/api/v1/health')
        .expect(200);

      assert.deepEqual(res.body, { status: 'ok' });
    });
  });

  describe('2. Hardened Request ID & Correlation', () => {
    it('generates a UUID X-Request-ID when not provided by caller', async () => {
      const res = await request(server)
        .get('/api/v1/health')
        .expect(200);

      const reqId = res.headers['x-request-id'];
      assert.ok(reqId, 'X-Request-ID header must be present');
      assert.match(
        reqId,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('propagates safe caller-supplied X-Request-ID unchanged', async () => {
      const customId = 'client-trace-12345_ABCDEF';
      const res = await request(server)
        .get('/api/v1/health')
        .set('X-Request-ID', customId)
        .expect(200);

      assert.equal(res.headers['x-request-id'], customId);
    });

    it('sanitizes CR/LF directly because Node rejects these bytes in HTTP headers', () => {
      const unsafeId = 'evil\r\nSet-Cookie: malicious=true';
      const returnedId = sanitizeRequestId(unsafeId);
      assert.notEqual(returnedId, unsafeId);
      assert.match(returnedId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('rejects HTTP-valid but unsafe caller ID characters and generates fresh UUID', async () => {
      const unsafeId = 'evil;Set-Cookie: malicious=true';
      const res = await request(server)
        .get('/api/v1/health')
        .set('X-Request-ID', unsafeId)
        .expect(200);

      const returnedId = res.headers['x-request-id'];
      assert.notEqual(returnedId, unsafeId);
      assert.equal(returnedId.includes('evil'), false);
      assert.equal(returnedId.includes('\r'), false);
      assert.equal(returnedId.includes('\n'), false);
      assert.match(
        returnedId,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('rejects excessively long caller ID (> 128 chars) and generates fresh UUID', async () => {
      const longId = 'a'.repeat(200);
      const res = await request(server)
        .get('/api/v1/health')
        .set('X-Request-ID', longId)
        .expect(200);

      const returnedId = res.headers['x-request-id'];
      assert.notEqual(returnedId, longId);
      assert.ok(returnedId.length <= 128);
      assert.match(
        returnedId,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('3. Security Headers & CORS', () => {
    it('applies helmet security headers to responses', async () => {
      const res = await request(server)
        .get('/api/v1/health')
        .expect(200);

      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
    });

    it('allows configured origin and exposes required headers', async () => {
      const res = await request(server)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:3000');
      assert.ok(res.headers['access-control-expose-headers']);
      assert.ok(res.headers['access-control-expose-headers'].includes('X-Request-ID'));
      assert.ok(res.headers['access-control-expose-headers'].includes('X-Idempotency-Replayed'));
    });

    it('does not grant permissive access-control-allow-origin to unlisted origins', async () => {
      const res = await request(server)
        .get('/api/v1/health')
        .set('Origin', 'http://malicious-site.example.com')
        .expect(200);

      assert.notEqual(res.headers['access-control-allow-origin'], 'http://malicious-site.example.com');
      assert.notEqual(res.headers['access-control-allow-origin'], '*');
    });
  });

  describe('4. Error Handling Contracts', () => {
    it('formats 404 for unknown route /api/v1/definitely-does-not-exist with standard contract and X-Request-ID', async () => {
      const res = await request(server)
        .get('/api/v1/definitely-does-not-exist')
        .expect(404);

      assert.ok(res.body.error, 'Response must contain top-level error object');
      assert.equal(res.body.error.code, 'NOT_FOUND');
      assert.ok(res.body.error.message);
      assert.ok(res.headers['x-request-id']);
      assert.equal(res.body.error.request_id, res.headers['x-request-id']);
    });

    it('formats AppError (401 Unauthorized) with TorangGo error contract', async () => {
      const res = await request(server)
        .get('/api/v1/test/unauthorized')
        .expect(401);

      assert.ok(res.body.error);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
      assert.equal(res.body.error.message, 'Custom unauthorized message');
      assert.ok(res.body.error.request_id);
      assert.equal(res.body.error.request_id, res.headers['x-request-id']);
    });

    it('formats 500 unhandled errors without leaking stack traces or internal secrets', async () => {
      const res = await request(server)
        .get('/api/v1/test/crash')
        .expect(500);

      assert.ok(res.body.error);
      assert.equal(res.body.error.code, 'INTERNAL_ERROR');
      assert.equal(res.body.error.message, 'An unexpected internal server error occurred');
      assert.ok(res.body.error.request_id);

      const jsonString = JSON.stringify(res.body);
      assert.equal(jsonString.includes('Secret internal database failure stack'), false);
      assert.equal(jsonString.includes('stack'), false);
    });
  });

  describe('5. Global Validation Pipe', () => {
    it('rejects invalid payload with 400 VALIDATION_ERROR and field details', async () => {
      const res = await request(server)
        .post('/api/v1/test/validate')
        .send({
          name: '',
          email: 'not-an-email',
        })
        .expect(400);

      assert.ok(res.body.error);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(res.body.error.details?.fields);

      const fieldNames = Object.keys(res.body.error.details.fields);
      assert.ok(fieldNames.includes('name'));
      assert.ok(fieldNames.includes('email'));
    });

    it('forbids non-whitelisted fields with 400 VALIDATION_ERROR', async () => {
      const res = await request(server)
        .post('/api/v1/test/validate')
        .send({
          name: 'Valid Name',
          email: 'test@toranggo.id',
          hackerField: 'should-fail',
        })
        .expect(400);

      assert.ok(res.body.error);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(res.body.error.details?.fields);
      const fieldNames = Object.keys(res.body.error.details.fields);
      assert.ok(fieldNames.includes('hackerField'));
    });

    it('accepts valid whitelisted payload with 201 Created', async () => {
      const res = await request(server)
        .post('/api/v1/test/validate')
        .send({
          name: 'Valid Name',
          email: 'valid@toranggo.id',
        })
        .expect(201);

      assert.deepEqual(res.body.received, {
        name: 'Valid Name',
        email: 'valid@toranggo.id',
      });
    });
  });

  describe('6. Body Limit (413 Payload Too Large)', () => {
    let smallBodyApp: INestApplication;
    let smallBodyServer: Server;

    before(async () => {
      const smallConfig = loadAppConfig({
        NODE_ENV: 'test',
        PORT: '4002',
        LOG_LEVEL: 'silent',
        API_DOCS_ENABLED: 'false',
        BODY_LIMIT: '50b',
      });

      const instance = await createApp({
        config: smallConfig,
        module: TestAppModule,
      });

      smallBodyApp = instance.app;
      await smallBodyApp.init();
      await smallBodyApp.listen(0, '127.0.0.1');
      smallBodyServer = smallBodyApp.getHttpServer() as Server;
    });

    after(async () => {
      if (smallBodyApp) {
        await smallBodyApp.close();
      }
    });

    it('returns 413 PAYLOAD_TOO_LARGE when body exceeds configured limit', async () => {
      const bigPayload = {
        data: 'x'.repeat(200),
      };

      const res = await request(smallBodyServer)
        .post('/api/v1/test/upload-json')
        .send(bigPayload)
        .expect(413);

      assert.ok(res.body.error);
      assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
      assert.ok(res.body.error.message);
      assert.ok(res.body.error.request_id);
      assert.ok(res.headers['x-request-id']);
      assert.equal(res.body.error.request_id, res.headers['x-request-id']);
    });
  });

  describe('7. Rate Limiting', () => {
    it('returns 429 RATE_LIMITED when threshold is exceeded', async () => {
      await request(server).get('/api/v1/test/rate-limited').expect(200);
      await request(server).get('/api/v1/test/rate-limited').expect(200);

      const res = await request(server)
        .get('/api/v1/test/rate-limited')
        .expect(429);

      assert.ok(res.body.error);
      assert.equal(res.body.error.code, 'RATE_LIMITED');
      assert.ok(res.body.error.request_id);
    });
  });

  describe('8. Canonical Idempotency Foundation', () => {
    const canonicalKey = `order-key-canonical-${Date.now()}`;

    it('executes normally on initial request with Idempotency-Key', async () => {
      const res = await request(server)
        .post('/api/v1/test/idempotent-action')
        .set('Idempotency-Key', canonicalKey)
        .send({ product: 'abc', quantity: 2 })
        .expect(201);

      assert.equal(res.body.status, 'processed');
      assert.equal(res.headers['x-idempotency-replayed'], undefined);
    });

    it('replays identical cached response when JSON object keys are REORDERED (canonicalization)', async () => {
      const res = await request(server)
        .post('/api/v1/test/idempotent-action')
        .set('Idempotency-Key', canonicalKey)
        .send({ quantity: 2, product: 'abc' })
        .expect(201);

      assert.equal(res.body.status, 'processed');
      assert.equal(res.headers['x-idempotency-replayed'], 'true');
    });

    it('returns 409 IDEMPOTENCY_KEY_REUSED when same key is used with genuinely DIFFERENT body', async () => {
      const res = await request(server)
        .post('/api/v1/test/idempotent-action')
        .set('Idempotency-Key', canonicalKey)
        .send({ product: 'different_product', quantity: 99 })
        .expect(409);

      assert.ok(res.body.error);
      assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_REUSED');
      assert.ok(res.body.error.message.includes('different parameters'));
    });
  });

  describe('9. Graceful Shutdown Practical Verification', () => {
    it('binds to port, serves traffic, and releases port cleanly on app.close()', async () => {
      const shutdownConfig = loadAppConfig({
        NODE_ENV: 'test',
        PORT: '4099',
        LOG_LEVEL: 'silent',
        API_DOCS_ENABLED: 'false',
      });

      const { app: shutdownApp } = await createApp({
        config: shutdownConfig,
        module: TestAppModule,
      });

      await shutdownApp.listen(4099);
      const s = shutdownApp.getHttpServer() as Server;
      assert.equal(s.listening, true);

      const res = await request(s)
        .get('/api/v1/health')
        .expect(200);

      assert.deepEqual(res.body, { status: 'ok' });

      await shutdownApp.close();
      assert.equal(s.listening, false);
    });
  });
});

