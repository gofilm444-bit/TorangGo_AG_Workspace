import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import express from 'express';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../app.module.js';
import { loadAppConfig, type AppConfig } from '../config/app-config.js';
import { StructuredLogger } from '../common/logging/logger.service.js';
import { RequestIdMiddleware } from '../common/middleware/request-id.middleware.js';
import { createValidationPipe } from '../common/pipes/validation.pipe.js';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter.js';
import { LoggingInterceptor } from '../common/logging/logging.interceptor.js';

export interface CreateAppOptions {
  config?: AppConfig;
  module?: Parameters<typeof NestFactory.create>[0];
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TorangGo API')
    .setDescription(
      'TorangGo backend API foundation. Standard headers: X-Request-ID (request correlation), Idempotency-Key (mutation deduplication), X-Idempotency-Replayed (replayed response indicator).',
    )
    .setVersion('0.1.0')
    .build();

  return SwaggerModule.createDocument(app, swaggerConfig);
}

export async function createApp(options?: CreateAppOptions): Promise<{ app: INestApplication; config: AppConfig; logger: StructuredLogger }> {
  const config = options?.config ?? loadAppConfig();
  const logger = new StructuredLogger();
  logger.setLogLevel(config.logLevel);

  const app = await NestFactory.create(options?.module ?? AppModule, {
    logger,
    bufferLogs: true,
  });

  // Global prefix
  // Nest 12 also mounts Express fallback handlers at this exact prefix.
  app.setGlobalPrefix(`/${config.apiPrefix.replace(/^\/+/, '')}`);

  // Security Headers (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: config.apiDocsEnabled ? false : undefined,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Request ID middleware
  const requestIdMiddleware = new RequestIdMiddleware();
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    requestIdMiddleware.use(req, res, next);
  });

  // Body parser limits
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));

  // CORS allowlist
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-ID', 'X-Idempotency-Replayed'],
  });

  // Global Pipes & Filters
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalInterceptors(new LoggingInterceptor(logger));

  // Swagger / OpenAPI
  if (config.apiDocsEnabled) {
    const document = buildOpenApiDocument(app);
    // UI available at /api/docs
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
    });
  }

  // Graceful shutdown hooks
  app.enableShutdownHooks();

  return { app, config, logger };
}
