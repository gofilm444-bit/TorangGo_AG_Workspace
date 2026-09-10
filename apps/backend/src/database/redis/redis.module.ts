import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service.js';
import { StructuredLogger } from '../../common/logging/logger.service.js';

@Global()
@Module({
  providers: [StructuredLogger, RedisService],
  exports: [RedisService],
})
export class RedisModule {}
