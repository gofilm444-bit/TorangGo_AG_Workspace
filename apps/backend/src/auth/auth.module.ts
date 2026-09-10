import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { OtpService } from './otp/otp.service.js';
import { OTP_PROVIDER_TOKEN } from './otp/providers/otp-provider.interface.js';
import { DevelopmentOtpProvider } from './otp/providers/development-otp.provider.js';
import { MockOtpProvider } from './otp/providers/mock-otp.provider.js';
import { TokenService } from './tokens/token.service.js';
import { SessionService } from './session/session.service.js';
import { AdminCryptoService } from './admin/admin-crypto.service.js';
import { AdminAuthService } from './admin/admin-auth.service.js';
import { AuthSessionGuard } from './guards/auth-session.guard.js';
import { AudienceGuard } from './guards/audience.guard.js';
import { ActiveUserGuard } from './guards/active-user.guard.js';
import { ApprovedMerchantGuard } from './guards/approved-merchant.guard.js';
import { ApprovedDriverGuard } from './guards/approved-driver.guard.js';
import { AdminPermissionGuard } from './guards/admin-permission.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { RedisModule } from '../database/redis/redis.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { StructuredLogger } from '../common/logging/logger.service.js';
import { loadAppConfig } from '../config/app-config.js';

@Global()
@Module({
  imports: [RedisModule, DatabaseModule],
  controllers: [AuthController],
  providers: [
    StructuredLogger,
    {
      provide: OTP_PROVIDER_TOKEN,
      useFactory: (logger: StructuredLogger) => {
        const config = loadAppConfig();
        if (config.otpProvider === 'mock') {
          return new MockOtpProvider();
        }
        return new DevelopmentOtpProvider(logger);
      },
      inject: [StructuredLogger],
    },
    OtpService,
    TokenService,
    SessionService,
    AdminCryptoService,
    AdminAuthService,
    AuthSessionGuard,
    AudienceGuard,
    ActiveUserGuard,
    ApprovedMerchantGuard,
    ApprovedDriverGuard,
    AdminPermissionGuard,
    CsrfGuard,
  ],
  exports: [
    OtpService,
    TokenService,
    SessionService,
    AdminCryptoService,
    AdminAuthService,
    AuthSessionGuard,
    AudienceGuard,
    ActiveUserGuard,
    ApprovedMerchantGuard,
    ApprovedDriverGuard,
    AdminPermissionGuard,
    CsrfGuard,
    OTP_PROVIDER_TOKEN,
  ],
})
export class AuthModule {}
