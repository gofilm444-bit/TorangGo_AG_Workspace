import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { colors, spacing, radius, typography } from './tokens/index.js';
import { createAppQueryClient } from './query/query-client.js';

describe('@platform/mobile-ui Foundation Suite', () => {
  describe('Design Tokens', () => {
    it('has valid color tokens with essential semantic roles', () => {
      assert.ok(colors.primary, 'primary color must be defined');
      assert.ok(colors.background, 'background color must be defined');
      assert.ok(colors.surface, 'surface color must be defined');
      assert.ok(colors.text, 'text color must be defined');
      assert.ok(colors.success, 'success color must be defined');
      assert.ok(colors.error, 'error color must be defined');
      assert.ok(colors.warning, 'warning color must be defined');
    });

    it('has monotonic spacing tokens', () => {
      assert.equal(spacing.none, 0);
      assert.ok(spacing.xs < spacing.sm);
      assert.ok(spacing.sm < spacing.md);
      assert.ok(spacing.md < spacing.lg);
      assert.ok(spacing.lg < spacing.xl);
      assert.ok(spacing.xl < spacing.xxl);
    });

    it('has valid typography scale with font sizes and line heights', () => {
      assert.ok(typography.h1.fontSize);
      assert.ok(typography.body.fontSize);
      assert.ok(typography.button.fontSize);
      assert.ok((typography.h1.fontSize ?? 0) > (typography.h2.fontSize ?? 0));
      assert.ok((typography.h2.fontSize ?? 0) > (typography.h3.fontSize ?? 0));
    });

    it('has standard radius tokens', () => {
      assert.equal(radius.none, 0);
      assert.equal(radius.sm, 4);
      assert.equal(radius.md, 8);
      assert.equal(radius.lg, 12);
      assert.equal(radius.full, 9999);
    });
  });

  describe('TanStack Query Configuration', () => {
    it('creates query client with production-safe defaults for mobile apps', () => {
      const client = createAppQueryClient();
      const defaultOptions = client.getDefaultOptions();

      assert.equal(defaultOptions.queries?.retry, 1, 'Queries must retry once');
      assert.equal(defaultOptions.queries?.staleTime, 1000 * 60 * 2, 'Stale time must be 2 minutes');
      assert.equal(defaultOptions.queries?.gcTime, 1000 * 60 * 10, 'GC time must be 10 minutes');
      assert.equal(defaultOptions.queries?.refetchOnWindowFocus, false, 'Window focus refetch disabled in RN');
      assert.equal(defaultOptions.queries?.refetchOnReconnect, true, 'Refetch on reconnect enabled');
      assert.equal(defaultOptions.mutations?.retry, false, 'Mutations must not retry automatically');
    });
  });
});
