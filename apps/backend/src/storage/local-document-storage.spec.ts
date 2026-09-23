import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDocumentStorage } from './local-document-storage.js';

describe('LocalDocumentStorage Specification', () => {
  let tempDir: string;
  let storage: LocalDocumentStorage;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'toranggo-doc-storage-test-'));
    storage = new LocalDocumentStorage(tempDir);
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('stores and retrieves a document via opaque key', async () => {
    const key = 'merchant-onboarding/user-123/doc-456.jpg';
    const payload = Buffer.from('fake-image-bytes-content');

    await storage.put(key, payload, 'image/jpeg');

    const exists = await storage.exists(key);
    assert.equal(exists, true);

    const doc = await storage.get(key);
    assert.ok(doc);
    assert.equal(doc.sizeBytes, payload.length);

    // Read stream
    const chunks: Buffer[] = [];
    for await (const chunk of doc.stream) {
      chunks.push(Buffer.from(chunk));
    }
    const readBuffer = Buffer.concat(chunks);
    assert.deepEqual(readBuffer, payload);
  });

  it('returns null for non-existent key', async () => {
    const doc = await storage.get('merchant-onboarding/unknown/missing.jpg');
    assert.equal(doc, null);
    assert.equal(await storage.exists('merchant-onboarding/unknown/missing.jpg'), false);
  });

  it('deletes stored document safely', async () => {
    const key = 'merchant-onboarding/user-del/doc-del.jpg';
    await storage.put(key, Buffer.from('delete-me'), 'image/jpeg');
    assert.equal(await storage.exists(key), true);

    await storage.delete(key);
    assert.equal(await storage.exists(key), false);
  });

  it('rejects path traversal attempts', async () => {
    const maliciousKey = '../../etc/passwd';
    await assert.rejects(
      async () => storage.put(maliciousKey, Buffer.from('evil'), 'text/plain'),
      /traversal|escape/i,
    );
  });
});
