import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AdminVerificationController } from './admin-verification.controller.js';
import { AdminVerificationService } from './admin-verification.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminController, AdminVerificationController],
  providers: [AdminService, AdminVerificationService],
  exports: [AdminService, AdminVerificationService],
})
export class AdminModule {}
