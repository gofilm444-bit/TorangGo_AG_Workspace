/**
 * Utility to mask NIK numbers to protect personal data.
 * Standard format: ************1234 (retains only last 4 digits).
 */
export function maskNik(nik?: string | null): string {
  if (!nik || typeof nik !== 'string') {
    return '****************';
  }
  const clean = nik.trim();
  if (clean.length <= 4) {
    return '****************';
  }
  return '*'.repeat(clean.length - 4) + clean.slice(-4);
}
