import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const openApiPath = resolve(rootDir, 'docs/api/openapi.json');
const schemaPath = resolve(rootDir, 'packages/api-client/src/generated/schema.ts');

describe('Contract Drift Detection Verification Suite', () => {
  it('passes when OpenAPI specification and generated client are in sync (positive test)', () => {
    const res = spawnSync('node', ['scripts/contract-drift-check.mjs'], {
      cwd: rootDir,
      encoding: 'utf8',
    });

    assert.equal(
      res.status,
      0,
      `Expected drift check to succeed, got exit code ${res.status}: ${res.stderr || res.stdout}`,
    );
    assert.ok(
      res.stdout.includes('fully synchronized'),
      'Expected confirmation that contracts are synchronized',
    );
  });

  it('proves negative drift detection: fails when schema.ts is tampered or out of sync', () => {
    assert.ok(existsSync(schemaPath), 'schema.ts must exist');
    const originalContent = readFileSync(schemaPath, 'utf8');

    try {
      // Intentionally introduce drift by tampering with the generated schema
      writeFileSync(schemaPath, `${originalContent}\n// SYNTHETIC_DRIFT_COMMENT\n`);

      const res = spawnSync('node', ['scripts/contract-drift-check.mjs'], {
        cwd: rootDir,
        encoding: 'utf8',
      });

      // Assert that drift check MUST fail with non-zero exit code
      assert.notEqual(res.status, 0, 'Drift check must fail when schema.ts has drifted');
      assert.ok(
        res.stderr.includes('Contract drift detected') || res.stdout.includes('Contract drift detected'),
        'Expected error message indicating contract drift',
      );
    } finally {
      // Restore original file
      writeFileSync(schemaPath, originalContent);
    }
  });

  it('proves negative drift detection: fails when openapi.json is tampered or out of sync with backend', () => {
    assert.ok(existsSync(openApiPath), 'openapi.json must exist');
    const originalContent = readFileSync(openApiPath, 'utf8');

    try {
      // Intentionally introduce drift by tampering with openapi.json
      const json = JSON.parse(originalContent);
      json.info.description = 'DRIFTED_DESCRIPTION_FOR_NEGATIVE_TEST';
      writeFileSync(openApiPath, JSON.stringify(json, null, 2) + '\n');

      const res = spawnSync('node', ['scripts/contract-drift-check.mjs'], {
        cwd: rootDir,
        encoding: 'utf8',
      });

      // Assert that drift check MUST fail with non-zero exit code
      assert.notEqual(res.status, 0, 'Drift check must fail when openapi.json has drifted');
      assert.ok(
        res.stderr.includes('Contract drift detected') || res.stdout.includes('Contract drift detected'),
        'Expected error message indicating contract drift',
      );
    } finally {
      // Restore original file
      writeFileSync(openApiPath, originalContent);
    }
  });

  it('restores and confirms zero drift after negative tests', () => {
    const res = spawnSync('node', ['scripts/contract-drift-check.mjs'], {
      cwd: rootDir,
      encoding: 'utf8',
    });

    assert.equal(res.status, 0, 'Drift check must pass once clean state is restored');
  });
});

