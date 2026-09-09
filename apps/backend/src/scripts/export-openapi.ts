import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppModule } from '../app.module.js';
import { buildOpenApiDocument } from '../bootstrap/create-app.js';
import { StructuredLogger } from '../common/logging/logger.service.js';

async function exportOpenApi() {
  const logger = new StructuredLogger();
  logger.setLogLevel('warn');
  const app = await NestFactory.create(AppModule, {
    logger,
    bufferLogs: true,
  });

  app.setGlobalPrefix('api/v1');

  const document = buildOpenApiDocument(app);
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');
  const outputPath = process.env.EXPORT_OPENAPI_PATH
    ? resolve(process.cwd(), process.env.EXPORT_OPENAPI_PATH)
    : resolve(rootDir, 'docs/api/openapi.json');

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(document, null, 2) + '\n', 'utf8');

  console.log(`OpenAPI specification exported successfully to: ${outputPath}`);
  await app.close();
}

exportOpenApi().catch((err) => {
  console.error('Failed to export OpenAPI document:', err);
  process.exit(1);
});