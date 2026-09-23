import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AdminModule } from './admin/admin.module.js';
import { StorageModule } from './storage/storage.module.js';
import { MerchantOnboardingModule } from './merchant-onboarding/merchant-onboarding.module.js';
import { StructuredLogger } from './common/logging/logger.service.js';
import {
  IDEMPOTENCY_STORE_TOKEN,
} from './common/idempotency/idempotency-store.interface.js';
import { PostgresIdempotencyStore } from './database/idempotency/postgres-idempotency.store.js';
import { DatabaseModule } from './database/database.module.js';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor.js';
import { loadAppConfig } from './config/app-config.js';

const config = loadAppConfig();

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: config.rateLimitTtl,
        limit: config.rateLimitLimit,
      },
    ]),
    HealthModule,
    AuthModule,
    AdminModule,
    MerchantOnboardingModule,
  ],
  providers: [
    StructuredLogger,
    {
      provide: IDEMPOTENCY_STORE_TOKEN,
      useClass: PostgresIdempotencyStore,
    },
    IdempotencyInterceptor,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  exports: [
    StructuredLogger,
    IDEMPOTENCY_STORE_TOKEN,
    IdempotencyInterceptor,
  ],
})
export class AppModule {}
