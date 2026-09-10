import { Inject, Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { RedisService } from '../../database/redis/redis.service.js';
import { loadAppConfig, type AppConfig } from '../../config/app-config.js';
import { StructuredLogger } from '../../common/logging/logger.service.js';
import { AppError } from '../../common/errors/app-error.js';
import { generateUuidV7 } from '@platform/utils';
import {
  OTP_PROVIDER_TOKEN,
  type OtpProvider,
} from './providers/otp-provider.interface.js';
import type {
  OtpChallenge,
  RequestOtpParams,
  VerifyOtpParams,
  OtpVerificationResult,
} from './otp.types.js';

export function isE164Phone(phone: string): boolean {
  // ITU-T E.164: + followed by 7 to 15 digits, first digit 1-9
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

@Injectable()
export class OtpService {
  private readonly config: AppConfig;

  constructor(
    private readonly redis: RedisService,
    @Inject(OTP_PROVIDER_TOKEN)
    private readonly otpProvider: OtpProvider,
    private readonly logger: StructuredLogger,
  ) {
    this.config = loadAppConfig();
  }

  private getChallengeKey(audience: string, phone: string): string {
    return `auth:otp:challenge:${audience}:${phone}`;
  }

  private computeHmac(otp: string, challengeId: string): string {
    return crypto
      .createHmac('sha256', this.config.otpHmacSecret)
      .update(`${otp}:${challengeId}`)
      .digest('hex');
  }

  /**
   * Check rate limits across phone, IP, and installation ID.
   */
  private async enforceRateLimits(params: RequestOtpParams): Promise<void> {
    const { phone, clientIp, installationId } = params;

    // 1. Phone rate limit: max 5 requests per 10 minutes
    const phoneLimitKey = `auth:otp:ratelimit:phone:${phone}`;
    const phoneCount = await this.redis.incr(phoneLimitKey);
    if (phoneCount === 1) {
      await this.redis.expire(phoneLimitKey, 600);
    }
    if (phoneCount > 5) {
      throw new AppError(
        429,
        'RATE_LIMITED',
        'Too many OTP requests for this phone number. Please wait before retrying.',
      );
    }

    // 2. IP rate limit: max 20 requests per 10 minutes
    if (clientIp) {
      const ipLimitKey = `auth:otp:ratelimit:ip:${clientIp}`;
      const ipCount = await this.redis.incr(ipLimitKey);
      if (ipCount === 1) {
        await this.redis.expire(ipLimitKey, 600);
      }
      if (ipCount > 20) {
        throw new AppError(
          429,
          'RATE_LIMITED',
          'Too many OTP requests from this IP address. Please wait before retrying.',
        );
      }
    }

    // 3. Installation ID rate limit: max 10 requests per 10 minutes
    if (installationId) {
      const instLimitKey = `auth:otp:ratelimit:inst:${installationId}`;
      const instCount = await this.redis.incr(instLimitKey);
      if (instCount === 1) {
        await this.redis.expire(instLimitKey, 600);
      }
      if (instCount > 10) {
        throw new AppError(
          429,
          'RATE_LIMITED',
          'Too many OTP requests from this device. Please wait before retrying.',
        );
      }
    }
  }

  /**
   * Request / issue a new OTP challenge.
   */
  async requestOtp(params: RequestOtpParams): Promise<{ challengeId: string; resendAvailableInSeconds: number }> {
    const { phone, audience, installationId } = params;

    if (!isE164Phone(phone)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Phone number must be in valid E.164 international format (e.g. +6281234567890)',
        { field: 'phone' },
      );
    }

    const challengeKey = this.getChallengeKey(audience, phone);
    const existingRaw = await this.redis.get(challengeKey);

    const now = Date.now();

    if (existingRaw) {
      try {
        const existing: OtpChallenge = JSON.parse(existingRaw);
        const resendAvailableAt = new Date(existing.resendAvailableAt).getTime();
        if (now < resendAvailableAt) {
          const secondsRemaining = Math.ceil((resendAvailableAt - now) / 1000);
          throw new AppError(
            429,
            'OTP_RESEND_COOLDOWN',
            `Please wait ${secondsRemaining} seconds before requesting a new OTP code.`,
            { seconds_remaining: secondsRemaining },
          );
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
      }
    }

    // Enforce overall rate limits
    await this.enforceRateLimits(params);

    // Cryptographically secure 6-digit numeric generation
    const otp = crypto.randomInt(100000, 1000000).toString();
    const challengeId = generateUuidV7();
    const hmacVerifier = this.computeHmac(otp, challengeId);

    const expiresAt = new Date(now + this.config.otpTtlSeconds * 1000).toISOString();
    const resendAvailableAt = new Date(now + this.config.otpResendCooldownSeconds * 1000).toISOString();

    const challenge: OtpChallenge = {
      challengeId,
      phone,
      audience,
      hmacVerifier,
      expiresAt,
      attemptsRemaining: this.config.otpMaxAttempts,
      installationId,
      resendAvailableAt,
      createdAt: new Date(now).toISOString(),
    };

    // Store HMAC verifier (NEVER plaintext OTP) in Redis
    await this.redis.set(challengeKey, JSON.stringify(challenge), this.config.otpTtlSeconds);

    // Dispatch via replaceable OtpProvider
    await this.otpProvider.sendOtp(phone, otp, { audience, challengeId });

    return {
      challengeId,
      resendAvailableInSeconds: this.config.otpResendCooldownSeconds,
    };
  }

  /**
   * Verify and consume OTP challenge. Single-use: invalidates on success.
   */
  async verifyOtp(params: VerifyOtpParams): Promise<OtpVerificationResult> {
    const { phone, audience, otp, installationId } = params;

    if (!isE164Phone(phone)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Phone number must be in valid E.164 international format',
        { field: 'phone' },
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      throw new AppError(400, 'OTP_INVALID', 'OTP must be exactly 6 numeric digits');
    }

    const challengeKey = this.getChallengeKey(audience, phone);
    const challengeRaw = await this.redis.get(challengeKey);

    if (!challengeRaw) {
      throw new AppError(400, 'OTP_EXPIRED', 'OTP challenge has expired or does not exist');
    }

    let challenge: OtpChallenge;
    try {
      challenge = JSON.parse(challengeRaw);
    } catch {
      await this.redis.del(challengeKey);
      throw new AppError(400, 'OTP_EXPIRED', 'OTP challenge state corrupted or expired');
    }

    // Check expiration
    if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
      await this.redis.del(challengeKey);
      throw new AppError(400, 'OTP_EXPIRED', 'OTP code has expired. Please request a new one.');
    }

    // Check attempts limit
    if (challenge.attemptsRemaining <= 0) {
      await this.redis.del(challengeKey);
      throw new AppError(
        400,
        'OTP_ATTEMPTS_EXCEEDED',
        'Maximum verification attempts exceeded. Please request a new OTP code.',
      );
    }

    // Timing-safe HMAC verification
    const expectedHmac = challenge.hmacVerifier;
    const actualHmac = this.computeHmac(otp, challenge.challengeId);

    const expectedBuffer = Buffer.from(expectedHmac, 'hex');
    const actualBuffer = Buffer.from(actualHmac, 'hex');

    const isValid =
      expectedBuffer.length === actualBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, actualBuffer);

    if (!isValid) {
      challenge.attemptsRemaining -= 1;

      if (challenge.attemptsRemaining <= 0) {
        await this.redis.del(challengeKey);
        throw new AppError(
          400,
          'OTP_ATTEMPTS_EXCEEDED',
          'Maximum verification attempts exceeded. Please request a new OTP code.',
        );
      }

      // Update remaining attempts in Redis
      const remainingTtl = await this.redis.ttl(challengeKey);
      if (remainingTtl > 0) {
        await this.redis.set(challengeKey, JSON.stringify(challenge), remainingTtl);
      }

      throw new AppError(400, 'OTP_INVALID', 'Invalid OTP code. Please check and try again.', {
        attempts_remaining: challenge.attemptsRemaining,
      });
    }

    // Successful OTP verification: CONSUME and delete challenge immediately (cannot replay)
    await this.redis.del(challengeKey);

    this.logger.log(
      {
        event: 'OTP_VERIFICATION_SUCCESS',
        phone,
        audience,
        challenge_id: challenge.challengeId,
        message: 'OTP verified and consumed successfully',
      },
      'OtpService',
    );

    return {
      verified: true,
      phone,
      audience,
      installationId: installationId ?? challenge.installationId,
    };
  }
}
