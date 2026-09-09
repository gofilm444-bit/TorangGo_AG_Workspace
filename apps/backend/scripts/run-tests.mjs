import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');
const entries = readdirSync(distDir, { recursive: true });
const files = entries
  .map(e => (typeof e === 'string' ? e : e.name))
  .filter(name => name && name.endsWith('.spec.js'))
  .map(name => resolve(distDir, name));

if (files.length === 0) {
  console.log('No test files found in dist');
  process.exit(0);
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
});

process.exit(result.status ?? 0);
