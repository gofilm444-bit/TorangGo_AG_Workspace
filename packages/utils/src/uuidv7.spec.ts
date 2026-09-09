import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateUuidV7, isValidUuidV7, extractUuidV7Timestamp } from './uuidv7.js';
import { isValidRupiah, formatRupiah } from './money.js';

describe('UUIDv7 Suite', () => {
  test('should generate a valid RFC 9562 UUIDv7', () => {
    const id = generateUuidV7();
    assert.equal(typeof id, 'string');
    assert.equal(id.length, 36);
    assert.ok(isValidUuidV7(id));
  });

  test('should encode accurate millisecond timestamp', () => {
    const before = Date.now();
    const id = generateUuidV7();
    const after = Date.now();
    const extracted = extractUuidV7Timestamp(id);

    assert.ok(extracted >= before, `Extracted ${extracted} should be >= ${before}`);
    assert.ok(extracted <= after, `Extracted ${extracted} should be <= ${after}`);
  });

  test('should generate time-sortable IDs', async () => {
    const id1 = generateUuidV7();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const id2 = generateUuidV7();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const id3 = generateUuidV7();

    assert.ok(id1 < id2, `Expected ${id1} < ${id2}`);
    assert.ok(id2 < id3, `Expected ${id2} < ${id3}`);
  });

  test('should reject invalid UUIDs', () => {
    assert.equal(isValidUuidV7('not-a-uuid'), false);
    assert.equal(isValidUuidV7('c3b4a2f8-9a67-4b12-8822-6b99786a4211'), false); // v4, not v7
    assert.equal(isValidUuidV7(''), false);
  });
});

describe('Money Foundation Suite', () => {
  test('validates whole integer Rupiah', () => {
    assert.equal(isValidRupiah(50000), true);
    assert.equal(isValidRupiah(0), true);
    assert.equal(isValidRupiah(1000000000n), true);
    assert.equal(isValidRupiah(50.5), false); // No fractional cents
    assert.equal(isValidRupiah(-100), false);
    assert.equal(isValidRupiah(NaN), false);
  });

  test('formats whole Rupiah', () => {
    assert.equal(formatRupiah(50000), 'Rp 50.000');
    assert.equal(formatRupiah(1250500), 'Rp 1.250.500');
    assert.equal(formatRupiah(0), 'Rp 0');
  });
});
