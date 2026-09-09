/**
 * Money utilities for TorangGo.
 * Monetary values represent whole Indonesian Rupiah (IDR) without fractional cents/sen.
 * Stored in PostgreSQL as BIGINT integers.
 */

/**
 * Validates that an amount is a non-negative, whole integer Rupiah value.
 */
export function isValidRupiah(amount: number | bigint): boolean {
  if (typeof amount === 'bigint') {
    return amount >= 0n;
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return false;
  }
  return Number.isInteger(amount) && amount >= 0 && amount <= Number.MAX_SAFE_INTEGER;
}

/**
 * Formats a Rupiah integer into standard Indonesian Rupiah display format (e.g. Rp 50.000).
 */
export function formatRupiah(amount: number | bigint): string {
  if (!isValidRupiah(amount)) {
    throw new Error(`Invalid Rupiah amount: ${amount}`);
  }
  const str = amount.toString();
  const formatted = str.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${formatted}`;
}
