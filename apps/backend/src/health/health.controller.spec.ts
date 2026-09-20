import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  test('should return status ok', () => {
    const controller = new HealthController();
    assert.deepEqual(controller.getHealth(), { status: 'ok' });
  });
});