import { randomBytes } from 'node:crypto';

let lastTimestamp = -1;
let sequence = 0;

/**
 * Generates an RFC 9562 compliant UUIDv7.
 * Encodes a 48-bit millisecond timestamp followed by random bytes with monotonicity
 * guarantees within the same millisecond.
 */
export function generateUuidV7(timestampMs?: number): string {
  let now = timestampMs ?? Date.now();

  if (now === lastTimestamp) {
    sequence = (sequence + 1) & 0xfff;
    if (sequence === 0) {
      // Clock sequence rolled over in same millisecond, wait/bump timestamp
      now += 1;
    }
  } else {
    lastTimestamp = now;
    sequence = 0;
  }

  const bytes = randomBytes(16);
  const nowBig = BigInt(now);

  // 48-bit timestamp
  bytes[0] = Number((nowBig >> 40n) & 0xffn);
  bytes[1] = Number((nowBig >> 32n) & 0xffn);
  bytes[2] = Number((nowBig >> 24n) & 0xffn);
  bytes[3] = Number((nowBig >> 16n) & 0xffn);
  bytes[4] = Number((nowBig >> 8n) & 0xffn);
  bytes[5] = Number(nowBig & 0xffn);

  // Version 7 in bits 48..51 (high 4 bits of byte 6)
  // sequence counter in remaining 12 bits (low 4 bits of byte 6 + byte 7)
  bytes[6] = 0x70 | ((sequence >>> 8) & 0x0f);
  bytes[7] = sequence & 0xff;

  // Variant 10xx in bits 64..65 (high 2 bits of byte 8)
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);

  // Format as standard 8-4-4-4-12 hex string
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Validates whether a given string is a valid UUIDv7.
 */
export function isValidUuidV7(uuid: string): boolean {
  if (typeof uuid !== 'string' || uuid.length !== 36) return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

/**
 * Extracts the millisecond timestamp from an RFC 9562 UUIDv7.
 */
export function extractUuidV7Timestamp(uuid: string): number {
  if (!isValidUuidV7(uuid)) {
    throw new Error(`Invalid UUIDv7: ${uuid}`);
  }
  const cleanHex = uuid.replace(/-/g, '').slice(0, 12);
  return parseInt(cleanHex, 16);
}
