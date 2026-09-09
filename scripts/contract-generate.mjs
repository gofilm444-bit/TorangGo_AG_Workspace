import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

console.log('Generating shared contract artifacts...');

// 1. Build backend and export OpenAPI
console.log('1. Building backend and exporting OpenAPI specification...');
execSync('pnpm --filter backend build', { cwd: rootDir, stdio: 'inherit' });
execSync('node apps/backend/dist/scripts/export-openapi.js', { cwd: rootDir, stdio: 'inherit' });

// 2. Generate TypeScript types from OpenAPI
console.log('2. Generating TypeScript client contracts from OpenAPI...');
execSync('pnpm exec openapi-typescript docs/api/openapi.json -o packages/api-client/src/generated/schema.ts', {
  cwd: rootDir,
  stdio: 'inherit',
});

// 3. Build shared packages
console.log('3. Compiling shared packages...');
execSync('pnpm --filter @platform/shared-types build', { cwd: rootDir, stdio: 'inherit' });
execSync('pnpm --filter @platform/validation build', { cwd: rootDir, stdio: 'inherit' });
execSync('pnpm --filter @platform/api-client build', { cwd: rootDir, stdio: 'inherit' });

console.log('✔ Contract generation complete.');

