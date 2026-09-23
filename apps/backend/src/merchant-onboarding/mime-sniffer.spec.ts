import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectAllowedKtpMime } from './mime-sniffer.js';

describe('detectAllowedKtpMime Specification', () => {
  it('detects valid JPEG magic bytes (FF D8 FF)', () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    assert.equal(detectAllowedKtpMime(jpegHeader), 'image/jpeg');
  });

  it('detects valid PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(detectAllowedKtpMime(pngHeader), 'image/png');
  });

  it('rejects non-image files with spoofed extension (e.g. PDF header)', () => {
    const pdfHeader = Buffer.from('%PDF-1.5 fake content');
    assert.equal(detectAllowedKtpMime(pdfHeader), null);
  });

  it('rejects short or empty buffers', () => {
    assert.equal(detectAllowedKtpMime(Buffer.from([])), null);
    assert.equal(detectAllowedKtpMime(Buffer.from([0xff, 0xd8])), null);
  });
});
