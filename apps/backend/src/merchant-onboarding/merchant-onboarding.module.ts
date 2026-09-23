import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { MerchantOnboardingController } from './merchant-onboarding.controller.js';
import { MerchantOnboardingService } from './merchant-onboarding.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, StorageModule],
  controllers: [MerchantOnboardingController],
  providers: [MerchantOnboardingService],
  exports: [MerchantOnboardingService],
})
export class MerchantOnboardingModule {}
