import { Injectable } from '@nestjs/common';
import type { OtpProvider, SendOtpContext } from './otp-provider.interface.js';
import { loadAppConfig } from '../../../config/app-config.js';
import { StructuredLogger } from '../../../common/logging/logger.service.js';

@Injectable()
export class DevelopmentOtpProvider implements OtpProvider {
  // In-memory registry for development inspection/test hooks (NEVER in production)
  private readonly dispatchedCodes = new Map<string, { otp: string; timestamp: number }>();

  constructor(private readonly logger: StructuredLogger) {
    const config = loadAppConfig();
    if (config.isProduction) {
      throw new Error(
        'CRITICAL SECURITY ERROR: DevelopmentOtpProvider is strictly prohibited in production mode!',
      );
    }
  }

  async sendOtp(phone: string, otp: string, context: SendOtpContext): Promise<void> {
    const config = loadAppConfig();
    if (config.isProduction) {
      throw new Error(
        'CRITICAL SECURITY ERROR: DevelopmentOtpProvider cannot dispatch OTP in production mode!',
      );
    }

    // Record in-memory for testing without logging raw OTP
    this.dispatchedCodes.set(phone, { otp, timestamp: Date.now() });

    // Safe security log: NEVER log the raw OTP value!
    this.logger.log(
      {
        event: 'OTP_DISPATCHED',
        phone,
        audience: context.audience,
        challenge_id: context.challengeId,
        provider: 'DevelopmentOtpProvider',
        message: 'Development OTP dispatched successfully (code hidden for security)',
      },
      'DevelopmentOtpProvider',
    );
  }

  /**
   * Test hook strictly for unit/integration tests to verify OTP delivery in testing environment.
   */
  getLastDispatchedOtp(phone: string): string | undefined {
    const config = loadAppConfig();
    if (config.isProduction) return undefined;
    return this.dispatchedCodes.get(phone)?.otp;
  }

  clear(): void {
    this.dispatchedCodes.clear();
  }
}
