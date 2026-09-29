import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MerchantBusinessController } from './merchant-business.controller.js';
import { MerchantBusinessService } from './merchant-business.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [MerchantBusinessController],
  providers: [MerchantBusinessService],
  exports: [MerchantBusinessService],
})
export class MerchantBusinessModule {}
