import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import argon2 from 'argon2';
import { loadAppConfig } from '../../config/app-config.js';

export interface GeneratedMfaEnrollment {
  totpSecret: string;
  totpSecretEncrypted: string;
  recoveryCodes: string[];
  recoveryCodeHashes: string[];
}

@Injectable()
export class AdminCryptoService {
  private readonly encryptionKey: Buffer;

  constructor() {
    const config = loadAppConfig();
    // 32-byte hex key for AES-256-GCM
    this.encryptionKey = Buffer.from(config.adminMfaEncryptionKey, 'hex');
    if (this.encryptionKey.length !== 32) {
      throw new Error(
        'ADMIN_MFA_ENCRYPTION_KEY must be a valid 32-byte hexadecimal string (64 characters)',
      );
    }
  }

  // ── ARGON2ID PASSWORDS ───────────────────────────────────────────────────────

  /**
   * Hash a password using Argon2id.
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verify an Argon2id password hash.
   */
  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  // ── AES-256-GCM ENCRYPTION FOR TOTP SECRETS ──────────────────────────────────

  /**
   * Encrypt sensitive string (e.g. TOTP secret) using AES-256-GCM.
   * Format: iv.authTag.ciphertext (hex)
   */
  encryptSecret(plainSecret: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(plainSecret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt secret encrypted with AES-256-GCM.
   */
  decryptSecret(encryptedPayload: string): string {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format');
    }
    const [ivHex, authTagHex, cipherTextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(cipherTextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // ── RFC 6238 TOTP ────────────────────────────────────────────────────────────

  /**
   * Generate a random 20-byte base32 TOTP secret.
   */
  generateTotpSecret(): string {
    const bytes = crypto.randomBytes(20);
    return this.base32Encode(bytes);
  }

  /**
   * Compute RFC 6238 6-digit TOTP code for a given timestamp and secret.
   */
  generateTotpCode(secretBase32: string, timestampMs = Date.now(), stepSeconds = 30): string {
    const key = this.base32Decode(secretBase32);
    const epoch = Math.floor(timestampMs / 1000);
    const timeStep = Math.floor(epoch / stepSeconds);

    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(timeStep), 0);

    const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    return (code % 1000000).toString().padStart(6, '0');
  }

  /**
   * Verify TOTP code with +/- 1 step window for clock drift tolerance.
   */
  verifyTotpCode(secretBase32: string, code: string, timestampMs = Date.now()): boolean {
    if (!/^\d{6}$/.test(code)) return false;

    const stepSeconds = 30;
    // Check current step, -1 step, +1 step
    for (const delta of [0, -1, 1]) {
      const checkTime = timestampMs + delta * stepSeconds * 1000;
      const expected = this.generateTotpCode(secretBase32, checkTime, stepSeconds);
      if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
        return true;
      }
    }
    return false;
  }

  // ── RECOVERY CODES ───────────────────────────────────────────────────────────

  /**
   * Generate high-entropy one-time recovery codes (e.g. 8 codes formatted ABCD-EFGH-1234).
   */
  generateRecoveryCodes(count = 8): { rawCodes: string[]; hashedCodes: string[] } {
    const rawCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const code = `${part1}-${part2}-${part3}`;
      rawCodes.push(code);
      hashedCodes.push(this.hashRecoveryCode(code));
    }

    return { rawCodes, hashedCodes };
  }

  /**
   * SHA-256 hash of a recovery code for secure database storage.
   */
  hashRecoveryCode(code: string): string {
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  // ── BASE32 HELPERS ───────────────────────────────────────────────────────────

  private base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  private base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += this.base32Chars[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += this.base32Chars[(value << (5 - bits)) & 31];
    }

    return output;
  }

  private base32Decode(base32: string): Buffer {
    const cleaned = base32.toUpperCase().replace(/=+$/, '');
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (let i = 0; i < cleaned.length; i++) {
      const idx = this.base32Chars.indexOf(cleaned[i]);
      if (idx === -1) continue;

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }
}
