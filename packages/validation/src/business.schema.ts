import { z } from 'zod';
import { isValidMerchantBusinessCategory } from '@platform/shared-types';

export function isValidIanaTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string' || tz.trim() === '') {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

export const ianaTimezoneSchema = z
  .string()
  .min(1, { message: 'Zona waktu wajib dipilih' })
  .refine(isValidIanaTimezone, {
    message: 'Zona waktu IANA tidak valid (contoh: Asia/Jakarta, Asia/Makassar, Asia/Jayapura)',
  });

export const operatingHourItemSchema = z
  .object({
    dayOfWeek: z
      .number()
      .int()
      .min(1, { message: 'Hari dalam seminggu harus bernilai 1 (Senin) hingga 7 (Minggu)' })
      .max(7, { message: 'Hari dalam seminggu harus bernilai 1 (Senin) hingga 7 (Minggu)' }),
    isClosed: z.boolean(),
    openTime: z.string().nullable(),
    closeTime: z.string().nullable(),
  })
  .refine(
    (val) => {
      if (val.isClosed) {
        return val.openTime === null && val.closeTime === null;
      }
      if (!val.openTime || !val.closeTime) {
        return false;
      }
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
      if (!timeRegex.test(val.openTime) || !timeRegex.test(val.closeTime)) {
        return false;
      }
      return val.openTime < val.closeTime;
    },
    {
      message: 'Jadwal operasional tidak valid: hari buka harus memiliki jam buka dan tutup (HH:mm) dengan jam buka < jam tutup; hari tutup harus memiliki jam kosong.',
    },
  );

export const sevenDayOperatingHoursSchema = z
  .array(operatingHourItemSchema)
  .length(7, { message: 'Jadwal operasional harus mencakup tepat 7 hari (Senin s/d Minggu)' })
  .refine(
    (items) => {
      const days = items.map((i) => i.dayOfWeek);
      const uniqueDays = new Set(days);
      return uniqueDays.size === 7 && [1, 2, 3, 4, 5, 6, 7].every((d) => uniqueDays.has(d));
    },
    {
      message: 'Jadwal operasional harus berisi tepat 1 entri untuk setiap hari dari Senin (1) hingga Minggu (7)',
    },
  );

export const businessPayloadSchema = z.object({
  name: z.string().min(2, { message: 'Nama usaha minimal 2 karakter' }).max(255),
  categoryCode: z
    .string()
    .min(2, { message: 'Kategori usaha wajib dipilih' })
    .max(64)
    .refine(isValidMerchantBusinessCategory, {
      message: 'Kategori usaha tidak valid atau tidak didukung',
    }),
  description: z.string().nullable().optional(),
});

export const outletPayloadSchema = z.object({
  name: z.string().min(2, { message: 'Nama outlet minimal 2 karakter' }).max(255),
  contactPhone: z
    .string()
    .min(8, { message: 'Nomor kontak outlet minimal 8 digit' })
    .max(32, { message: 'Nomor kontak outlet maksimal 32 karakter' }),
  province: z.string().min(1, { message: 'Provinsi outlet wajib diisi' }).max(128),
  regencyOrCity: z.string().min(1, { message: 'Kabupaten/Kota outlet wajib diisi' }).max(128),
  district: z.string().min(1, { message: 'Kecamatan outlet wajib diisi' }).max(128),
  villageOrSubdistrict: z.string().min(1, { message: 'Kelurahan/Desa outlet wajib diisi' }).max(128),
  addressDetail: z.string().min(5, { message: 'Detail alamat fisik outlet minimal 5 karakter' }),
  postalCode: z.string().max(16).nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: ianaTimezoneSchema,
});
