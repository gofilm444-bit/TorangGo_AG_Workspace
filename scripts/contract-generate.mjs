import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

console.log('Generating shared contract artifacts...');

// 1. Build compile-time workspace prerequisites for backend
console.log('1. Building shared workspace prerequisites...');
execSync('pnpm --filter @platform/shared-types build', { cwd: rootDir, stdio: 'inherit' });
execSync('pnpm --filter @platform/config build', { cwd: rootDir, stdio: 'inherit' });
execSync('pnpm --filter @platform/utils build', { cwd: rootDir, stdio: 'inherit' });
execSync('pnpm --filter @platform/validation build', { cwd: rootDir, stdio: 'inherit' });

// 2. Build backend and export OpenAPI specification
console.log('2. Building backend and exporting OpenAPI specification...');
execSync('pnpm --filter backend build', { cwd: rootDir, stdio: 'inherit' });
execSync('node apps/backend/dist/scripts/export-openapi.js', { cwd: rootDir, stdio: 'inherit' });

// 3. Generate TypeScript types from OpenAPI
console.log('3. Generating TypeScript client contracts from OpenAPI...');
execSync('pnpm exec openapi-typescript docs/api/openapi.json -o packages/api-client/src/generated/schema.ts', {
  cwd: rootDir,
  stdio: 'inherit',
});

// 4. Build generated-client dependent package
console.log('4. Compiling API client package...');
execSync('pnpm --filter @platform/api-client build', { cwd: rootDir, stdio: 'inherit' });

console.log('✔ Contract generation complete.');

