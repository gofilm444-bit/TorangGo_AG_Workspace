import 'reflect-metadata';
import { createApp } from './bootstrap/create-app.js';

async function bootstrap() {
  const { app, config, logger } = await createApp();

  await app.listen(config.port, config.host);

  logger.log(
    {
      message: 'TorangGo Backend started',
      env: config.nodeEnv,
      port: config.port,
      host: config.host,
      prefix: `/${config.apiPrefix}`,
      docs_enabled: config.apiDocsEnabled,
      docs_url: config.apiDocsEnabled ? `http://${config.host}:${config.port}/api/docs` : undefined,
    },
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});