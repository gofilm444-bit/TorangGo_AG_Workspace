import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const openApiPath = resolve(rootDir, 'docs/api/openapi.json');
const tempOpenApiPath = resolve(rootDir, 'docs/api/openapi.temp.json');
const schemaPath = resolve(rootDir, 'packages/api-client/src/generated/schema.ts');
const tempSchemaPath = resolve(rootDir, 'packages/api-client/src/generated/schema.temp.ts');

export function checkDrift() {
  console.log('Running contract drift check...');

  // 1. Export fresh OpenAPI to temporary file
  try {
    execSync('node apps/backend/dist/scripts/export-openapi.js', {
      cwd: rootDir,
      stdio: 'pipe',
      env: { ...process.env, EXPORT_OPENAPI_PATH: tempOpenApiPath },
    });
  } catch (err) {
    console.error('Failed to export OpenAPI during check:', err.stderr?.toString() || err.stdout?.toString() || err.message);
    cleanup();
    process.exit(1);
  }

  if (!existsSync(openApiPath)) {
    console.error(`❌ Missing OpenAPI document at: ${openApiPath}`);
    cleanup();
    process.exit(1);
  }

  const existingOpenApi = readFileSync(openApiPath, 'utf8').trim();
  const freshOpenApi = readFileSync(tempOpenApiPath, 'utf8').trim();

  if (existingOpenApi !== freshOpenApi) {
    console.error('❌ Contract drift detected: docs/api/openapi.json is out of sync with backend implementation.');
    console.error('Run "pnpm contract:generate" to synchronize OpenAPI specification.');
    cleanup();
    return false;
  }

  // 2. Generate schema from fresh OpenAPI to temp file
  try {
    execSync(`pnpm exec openapi-typescript "${tempOpenApiPath}" -o "${tempSchemaPath}"`, {
      cwd: rootDir,
      stdio: 'pipe',
    });
  } catch (err) {
    console.error('Failed to generate schema during drift check:', err);
    cleanup();
    process.exit(1);
  }

  const existingSchema = existsSync(schemaPath) ? readFileSync(schemaPath, 'utf8').trim() : '';
  const freshSchema = readFileSync(tempSchemaPath, 'utf8').trim();

  cleanup();

  if (existingSchema !== freshSchema) {
    console.error('❌ Contract drift detected: packages/api-client/src/generated/schema.ts is out of sync with exported OpenAPI.');
    console.error('Run "pnpm contract:generate" to regenerate client contracts.');
    return false;
  }

  console.log('✔ OpenAPI specification and generated client contracts are fully synchronized.');
  return true;
}

function cleanup() {
  if (existsSync(tempOpenApiPath)) {
    try { unlinkSync(tempOpenApiPath); } catch {}
  }
  if (existsSync(tempSchemaPath)) {
    try { unlinkSync(tempSchemaPath); } catch {}
  }
}

// Standalone CLI execution
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const isClean = checkDrift();
  process.exit(isClean ? 0 : 1);
}
