import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AdminCryptoService } from './admin-crypto.service.js';

describe('AdminCryptoService Unit Test Suite', () => {
  const service = new AdminCryptoService();

  describe('Argon2id Password Hashing', () => {
    it('hashes passwords using Argon2id and verifies valid password', async () => {
      const password = 'SuperSecretAdminPassword123!';
      const hash = await service.hashPassword(password);

      assert.ok(hash.startsWith('$argon2id$'), 'Hash must use argon2id algorithm');
      const isValid = await service.verifyPassword(hash, password);
      assert.equal(isValid, true, 'Valid password must verify successfully');
    });

    it('rejects incorrect password without throwing', async () => {
      const password = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword456!';
      const hash = await service.hashPassword(password);

      const isValid = await service.verifyPassword(hash, wrongPassword);
      assert.equal(isValid, false, 'Wrong password must be rejected');
    });
  });

  describe('AES-256-GCM Encryption for TOTP Secrets', () => {
    it('encrypts and decrypts secrets with integrity tag', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = service.encryptSecret(secret);

      assert.ok(encrypted.includes(':'), 'Encrypted payload must contain iv, authTag, and ciphertext');
      const parts = encrypted.split(':');
      assert.equal(parts.length, 3, 'Payload must have 3 segments');

      const decrypted = service.decryptSecret(encrypted);
      assert.equal(decrypted, secret, 'Decrypted secret must match original plain text');
    });

    it('fails decryption if ciphertext or auth tag is tampered', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = service.encryptSecret(secret);
      const [iv, authTag, ciphertext] = encrypted.split(':');

      // Tamper ciphertext while keeping even hex length
      const tamperedCipher = ciphertext.slice(0, -1) + (ciphertext.endsWith('0') ? '1' : '0');
      assert.throws(
        () => service.decryptSecret(`${iv}:${authTag}:${tamperedCipher}`),
        /Unsupported state or unable to authenticate data/,
      );
    });
  });

  describe('RFC 6238 TOTP Engine', () => {
    it('generates valid base32 TOTP secrets', () => {
      const secret = service.generateTotpSecret();
      assert.ok(secret.length >= 26, 'Base32 secret should have sufficient entropy');
      assert.ok(/^[A-Z2-7]+$/.test(secret), 'Secret must be valid RFC 4648 Base32');
    });

    it('computes 6-digit TOTP and verifies within valid time window', () => {
      const secret = service.generateTotpSecret();
      const code = service.generateTotpCode(secret);

      assert.equal(code.length, 6, 'TOTP code must be 6 digits');
      assert.ok(/^\d{6}$/.test(code), 'TOTP code must be numeric');

      const isValid = service.verifyTotpCode(secret, code);
      assert.equal(isValid, true, 'Freshly generated TOTP code must verify as valid');
    });

    it('rejects invalid or wrong-length TOTP codes', () => {
      const secret = service.generateTotpSecret();
      assert.equal(service.verifyTotpCode(secret, '000000'), false);
      assert.equal(service.verifyTotpCode(secret, '12345'), false);
      assert.equal(service.verifyTotpCode(secret, 'invalid'), false);
    });
  });

  describe('Backup Recovery Codes', () => {
    it('generates recovery codes and SHA-256 hashes', () => {
      const { rawCodes, hashedCodes } = service.generateRecoveryCodes(5);
      assert.equal(rawCodes.length, 5);
      assert.equal(hashedCodes.length, 5);

      for (let i = 0; i < rawCodes.length; i++) {
        assert.ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(rawCodes[i]), 'Code must match format');
        const hash = service.hashRecoveryCode(rawCodes[i]);
        assert.equal(hash, hashedCodes[i], 'Hash must match computed SHA-256');
        assert.equal(hash.length, 64, 'SHA-256 hash must be 64 hex characters');
      }
    });

    it('verifies recovery code hash matching with normalization', () => {
      const code = 'A1B2-C3D4-E5F6';
      const hash = service.hashRecoveryCode(code);

      assert.equal(service.hashRecoveryCode(code) === hash, true);
      assert.equal(service.hashRecoveryCode('a1b2c3d4e5f6') === hash, true, 'Should normalize casing and hyphens');
      assert.equal(service.hashRecoveryCode('W9X8-Y7Z6-A1B2') === hash, false);
    });
  });
});
