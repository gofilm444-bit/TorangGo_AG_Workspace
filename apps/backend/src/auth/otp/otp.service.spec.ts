import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isE164Phone, OtpService } from './otp.service.js';
import { DevelopmentOtpProvider } from './providers/development-otp.provider.js';
import { AppError } from '../../common/errors/app-error.js';

describe('OTP Foundations & Security Specifications', () => {
  describe('E.164 Phone Format Validation', () => {
    it('accepts valid E.164 numbers', () => {
      assert.equal(isE164Phone('+6281234567890'), true);
      assert.equal(isE164Phone('+12025550123'), true);
      assert.equal(isE164Phone('+447911123456'), true);
      assert.equal(isE164Phone('+6591234567'), true);
    });

    it('rejects invalid phone numbers without country code or with invalid characters', () => {
      assert.equal(isE164Phone('081234567890'), false, 'Local format must be rejected');
      assert.equal(isE164Phone('81234567890'), false, 'Missing + must be rejected');
      assert.equal(isE164Phone('+0123456789'), false, 'Leading zero country code rejected');
      assert.equal(isE164Phone('+62-812-3456'), false, 'Hyphens rejected in canonical E.164');
      assert.equal(isE164Phone('+62 812 3456'), false, 'Spaces rejected in canonical E.164');
      assert.equal(isE164Phone(''), false, 'Empty string rejected');
      assert.equal(isE164Phone('not-a-number'), false);
    });
  });

  describe('DevelopmentOtpProvider Production Fail-Fast', () => {
    it('fails fast if loaded under NODE_ENV=production', () => {
      const oldEnv = process.env.NODE_ENV;
      const oldAppEnv = process.env.APP_ENV;
      try {
        process.env.NODE_ENV = 'production';
        process.env.APP_ENV = 'production';

        const mockLogger = { log: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;

        assert.throws(
          () => new DevelopmentOtpProvider(mockLogger),
          /Development OTP provider is strictly forbidden in production|DevelopmentOtpProvider is strictly prohibited in production mode/,
        );
      } finally {
        if (oldEnv !== undefined) {
          process.env.NODE_ENV = oldEnv;
        } else {
          delete process.env.NODE_ENV;
        }
        if (oldAppEnv !== undefined) {
          process.env.APP_ENV = oldAppEnv;
        } else {
          delete process.env.APP_ENV;
        }
      }
    });

    it('redacts and hides raw OTP from logs during dispatch', async () => {
      const logs: any[] = [];
      const mockLogger = {
        log: (data: any) => logs.push(data),
        info: (data: any) => logs.push(data),
        warn: (data: any) => logs.push(data),
        error: (data: any) => logs.push(data),
      } as any;

      const provider = new DevelopmentOtpProvider(mockLogger);
      const secretOtp = '839214';

      await provider.sendOtp('+6281234567890', secretOtp, {
        audience: 'CUSTOMER_APP',
        challengeId: 'chal-001',
      });

      assert.equal(logs.length, 1);
      const logString = JSON.stringify(logs[0]);
      assert.ok(!logString.includes(secretOtp), 'Raw OTP must NEVER appear in logs');
      assert.equal(provider.getLastDispatchedOtp('+6281234567890'), secretOtp);
    });
  });

  describe('OtpService State Machine (Mocked Redis)', () => {
    function createMockRedis() {
      const store = new Map<string, string>();
      const ttls = new Map<string, number>();

      return {
        store,
        ttls,
        get: async (k: string) => store.get(k) ?? null,
        set: async (k: string, v: string, ttl?: number) => {
          store.set(k, v);
          if (ttl !== undefined) {
            ttls.set(k, ttl);
          }
          return 'OK';
        },
        del: async (k: string) => {
          const existed = store.delete(k);
          ttls.delete(k);
          return existed ? 1 : 0;
        },
        incr: async (k: string) => {
          const cur = parseInt(store.get(k) ?? '0', 10);
          const next = cur + 1;
          store.set(k, next.toString());
          return next;
        },
        expire: async (k: string, ttl: number) => {
          ttls.set(k, ttl);
          return 1;
        },
        ttl: async (k: string) => ttls.get(k) ?? 300,
      } as any;
    }

    it('generates 6-digit OTP, sets 300s TTL and enforces 60s cooldown on immediate resend', async () => {
      const mockRedis = createMockRedis();
      const mockLogger = { log: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;
      const provider = new DevelopmentOtpProvider(mockLogger);

      const otpService = new OtpService(mockRedis, provider, mockLogger);
      const phone = '+6281234567890';

      const res1 = await otpService.requestOtp({
        phone,
        audience: 'CUSTOMER_APP',
      });

      assert.ok(res1.challengeId);
      assert.equal(res1.resendAvailableInSeconds, 60);

      const dispatched = provider.getLastDispatchedOtp(phone);
      assert.ok(dispatched);
      assert.equal(dispatched.length, 6);
      assert.ok(/^\d{6}$/.test(dispatched), 'OTP must be 6 numeric digits');

      // Immediate resend must fail with 429 cooldown
      await assert.rejects(
        async () => {
          await otpService.requestOtp({
            phone,
            audience: 'CUSTOMER_APP',
          });
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 429);
          assert.equal(err.code, 'OTP_RESEND_COOLDOWN');
          return true;
        },
      );
    });

    it('verifies valid OTP and consumes it immediately (single-use)', async () => {
      const mockRedis = createMockRedis();
      const mockLogger = { log: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;
      const provider = new DevelopmentOtpProvider(mockLogger);

      const otpService = new OtpService(mockRedis, provider, mockLogger);
      const phone = '+6281234567890';

      await otpService.requestOtp({
        phone,
        audience: 'CUSTOMER_APP',
      });

      const dispatched = provider.getLastDispatchedOtp(phone)!;

      // 1st verification succeeds
      const verifyResult = await otpService.verifyOtp({
        phone,
        audience: 'CUSTOMER_APP',
        otp: dispatched,
      });

      assert.equal(verifyResult.verified, true);
      assert.equal(verifyResult.phone, phone);

      // 2nd verification with SAME code must fail (already consumed / expired)
      await assert.rejects(
        async () => {
          await otpService.verifyOtp({
            phone,
            audience: 'CUSTOMER_APP',
            otp: dispatched,
          });
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'OTP_EXPIRED');
          return true;
        },
      );
    });

    it('locks and revokes challenge after 3 incorrect attempts', async () => {
      const mockRedis = createMockRedis();
      const mockLogger = { log: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;
      const provider = new DevelopmentOtpProvider(mockLogger);

      const otpService = new OtpService(mockRedis, provider, mockLogger);
      const phone = '+6281234567890';

      await otpService.requestOtp({
        phone,
        audience: 'CUSTOMER_APP',
      });

      // Attempt 1 incorrect
      await assert.rejects(
        async () => {
          await otpService.verifyOtp({ phone, audience: 'CUSTOMER_APP', otp: '000000' });
        },
        (err: any) => {
          assert.equal(err.code, 'OTP_INVALID');
          assert.equal(err.details?.attempts_remaining, 2);
          return true;
        },
      );

      // Attempt 2 incorrect
      await assert.rejects(
        async () => {
          await otpService.verifyOtp({ phone, audience: 'CUSTOMER_APP', otp: '111111' });
        },
        (err: any) => {
          assert.equal(err.code, 'OTP_INVALID');
          assert.equal(err.details?.attempts_remaining, 1);
          return true;
        },
      );

      // Attempt 3 incorrect -> Locked / Max attempts exceeded
      await assert.rejects(
        async () => {
          await otpService.verifyOtp({ phone, audience: 'CUSTOMER_APP', otp: '222222' });
        },
        (err: any) => {
          assert.equal(err.code, 'OTP_ATTEMPTS_EXCEEDED');
          assert.equal(err.statusCode, 400);
          return true;
        },
      );

      // Challenge is now deleted from Redis
      const key = `auth:otp:challenge:CUSTOMER_APP:${phone}`;
      assert.equal(await mockRedis.get(key), null, 'Challenge must be deleted after max attempts');
    });
  });
});
