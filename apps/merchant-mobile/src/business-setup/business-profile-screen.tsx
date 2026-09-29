import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import {
  Screen,
  AppText,
  Input,
  Button,
  Card,
  StatusBadge,
  LoadingState,
  spacing,
  colors,
  radius,
} from '@platform/mobile-ui';
import { merchantApiClient } from '../api';
import type {
  BusinessDto,
  PrimaryOutletDetailResponseDto,
  OperatingHourItemDto,
} from '@platform/api-client';
import {
  MERCHANT_BUSINESS_CATEGORIES,
  isValidMerchantBusinessCategory,
} from '@platform/shared-types';

const DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const TIMEZONES = [
  { code: 'Asia/Jakarta', label: 'WIB — Asia/Jakarta' },
  { code: 'Asia/Makassar', label: 'WITA — Asia/Makassar' },
  { code: 'Asia/Jayapura', label: 'WIT — Asia/Jayapura' },
];

interface BusinessProfileScreenProps {
  onBack: () => void;
}

export function BusinessProfileScreen({ onBack }: BusinessProfileScreenProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Business state
  const [business, setBusiness] = useState<BusinessDto | null>(null);
  const [outletDetail, setOutletDetail] = useState<PrimaryOutletDetailResponseDto | null>(null);

  // Edit form state
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editCategoryCode, setEditCategoryCode] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [editOutletName, setEditOutletName] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editProvince, setEditProvince] = useState('');
  const [editRegencyOrCity, setEditRegencyOrCity] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editVillageOrSubdistrict, setEditVillageOrSubdistrict] = useState('');
  const [editAddressDetail, setEditAddressDetail] = useState('');
  const [editPostalCode, setEditPostalCode] = useState('');

  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');
  const [editTimezone, setEditTimezone] = useState('');
  const [editOperatingHours, setEditOperatingHours] = useState<OperatingHourItemDto[]>([]);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const loadOperationalProfile = useCallback(async () => {
    try {
      setLoading(true);
      const [busData, outletData] = await Promise.all([
        merchantApiClient.getBusiness(),
        merchantApiClient.getPrimaryOutlet(),
      ]);

      setBusiness(busData);
      setOutletDetail(outletData);

      // Populate edit fields
      setEditBusinessName(busData.name || '');
      setEditCategoryCode(busData.categoryCode || '');
      setEditDescription(busData.description || '');

      setEditOutletName(outletData.outlet.name || '');
      setEditContactPhone(outletData.outlet.contactPhone || '');
      setEditProvince(outletData.outlet.province || '');
      setEditRegencyOrCity(outletData.outlet.regencyOrCity || '');
      setEditDistrict(outletData.outlet.district || '');
      setEditVillageOrSubdistrict(outletData.outlet.villageOrSubdistrict || '');
      setEditAddressDetail(outletData.outlet.addressDetail || '');
      setEditPostalCode(outletData.outlet.postalCode || '');

      setEditLatitude(
        outletData.outlet.latitude !== undefined && outletData.outlet.latitude !== null
          ? String(outletData.outlet.latitude)
          : '',
      );
      setEditLongitude(
        outletData.outlet.longitude !== undefined && outletData.outlet.longitude !== null
          ? String(outletData.outlet.longitude)
          : '',
      );
      setEditTimezone(outletData.outlet.timezone || '');

      setEditOperatingHours(
        (outletData.operatingHours || []).map((h) => ({
          dayOfWeek: h.dayOfWeek,
          isClosed: h.isClosed,
          openTime: h.openTime ? h.openTime.slice(0, 5) : null,
          closeTime: h.closeTime ? h.closeTime.slice(0, 5) : null,
        })),
      );
    } catch (err: any) {
      Alert.alert('Gagal Memuat Profil', err?.message || 'Tidak dapat memuat profil operasional.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOperationalProfile();
  }, [loadOperationalProfile]);

  const updateEditDaySchedule = (dayOfWeek: number, patch: Partial<OperatingHourItemDto>) => {
    setEditOperatingHours((prev) =>
      prev.map((item) => {
        if (item.dayOfWeek === dayOfWeek) {
          const updated = { ...item, ...patch };
          if (updated.isClosed) {
            updated.openTime = null;
            updated.closeTime = null;
          } else {
            if (!updated.openTime) updated.openTime = '08:00';
            if (!updated.closeTime) updated.closeTime = '21:00';
          }
          return updated;
        }
        return item;
      }),
    );
  };

  const handleToggleEdit = () => {
    if (isEditing) {
      // Revert to loaded data
      if (business) {
        setEditBusinessName(business.name || '');
        setEditCategoryCode(business.categoryCode || '');
        setEditDescription(business.description || '');
      }
      if (outletDetail) {
        const o = outletDetail.outlet;
        setEditOutletName(o.name || '');
        setEditContactPhone(o.contactPhone || '');
        setEditProvince(o.province || '');
        setEditRegencyOrCity(o.regencyOrCity || '');
        setEditDistrict(o.district || '');
        setEditVillageOrSubdistrict(o.villageOrSubdistrict || '');
        setEditAddressDetail(o.addressDetail || '');
        setEditPostalCode(o.postalCode || '');
        setEditLatitude(o.latitude !== undefined && o.latitude !== null ? String(o.latitude) : '');
        setEditLongitude(o.longitude !== undefined && o.longitude !== null ? String(o.longitude) : '');
        setEditTimezone(o.timezone || '');
        setEditOperatingHours(
          (outletDetail.operatingHours || []).map((h) => ({
            dayOfWeek: h.dayOfWeek,
            isClosed: h.isClosed,
            openTime: h.openTime ? h.openTime.slice(0, 5) : null,
            closeTime: h.closeTime ? h.closeTime.slice(0, 5) : null,
          })),
        );
      }
      setEditErrors({});
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    const errors: Record<string, string> = {};

    if (!editBusinessName.trim() || editBusinessName.trim().length < 2) {
      errors.businessName = 'Nama usaha wajib diisi (minimal 2 karakter)';
    }
    if (!editCategoryCode.trim()) {
      errors.categoryCode = 'Kategori usaha wajib dipilih';
    } else if (!isValidMerchantBusinessCategory(editCategoryCode.trim())) {
      errors.categoryCode = 'Kategori usaha tidak valid atau tidak didukung';
    }

    if (!editOutletName.trim() || editOutletName.trim().length < 2) {
      errors.outletName = 'Nama outlet utama wajib diisi (minimal 2 karakter)';
    }
    if (!editContactPhone.trim() || editContactPhone.trim().length < 8) {
      errors.contactPhone = 'Nomor telepon outlet minimal 8 digit';
    }
    if (!editProvince.trim()) {
      errors.province = 'Provinsi wajib diisi';
    }
    if (!editRegencyOrCity.trim()) {
      errors.regencyOrCity = 'Kabupaten/Kota wajib diisi';
    }
    if (!editDistrict.trim()) {
      errors.district = 'Kecamatan wajib diisi';
    }
    if (!editVillageOrSubdistrict.trim()) {
      errors.villageOrSubdistrict = 'Kelurahan/Desa wajib diisi';
    }
    if (!editAddressDetail.trim() || editAddressDetail.trim().length < 5) {
      errors.addressDetail = 'Detail alamat fisik wajib diisi (minimal 5 karakter)';
    }

    const trimmedLat = editLatitude.trim();
    const latNum = parseFloat(trimmedLat);
    if (!trimmedLat || isNaN(latNum) || latNum < -90 || latNum > 90) {
      errors.latitude = 'Latitude harus bernilai antara -90 dan 90';
    }

    const trimmedLon = editLongitude.trim();
    const lonNum = parseFloat(trimmedLon);
    if (!trimmedLon || isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      errors.longitude = 'Longitude harus bernilai antara -180 dan 180';
    }

    if (!editTimezone.trim()) {
      errors.timezone = 'Zona waktu wajib dipilih';
    }

    for (const oh of editOperatingHours) {
      if (!oh.isClosed) {
        if (!oh.openTime || !oh.closeTime) {
          errors.operatingHours = `Hari ${DAY_NAMES[oh.dayOfWeek]} buka wajib mengisi jam buka dan tutup`;
          break;
        }
        if (oh.openTime >= oh.closeTime) {
          errors.operatingHours = `Hari ${DAY_NAMES[oh.dayOfWeek]}: jam buka harus lebih awal dari jam tutup`;
          break;
        }
      }
    }

    setEditErrors(errors);
    if (Object.keys(errors).length > 0) {
      Alert.alert('Validasi Gagal', Object.values(errors)[0]!);
      return;
    }

    try {
      setSaving(true);
      await Promise.all([
        merchantApiClient.updateBusiness({
          name: editBusinessName.trim(),
          categoryCode: editCategoryCode.trim(),
          description: editDescription.trim() || null,
        }),
        merchantApiClient.updatePrimaryOutlet({
          name: editOutletName.trim(),
          contactPhone: editContactPhone.trim(),
          province: editProvince.trim(),
          regencyOrCity: editRegencyOrCity.trim(),
          district: editDistrict.trim(),
          villageOrSubdistrict: editVillageOrSubdistrict.trim(),
          addressDetail: editAddressDetail.trim(),
          postalCode: editPostalCode.trim() || null,
          latitude: latNum,
          longitude: lonNum,
          timezone: editTimezone.trim(),
          operatingHours: editOperatingHours.map((oh) => ({
            dayOfWeek: oh.dayOfWeek,
            isClosed: oh.isClosed,
            openTime: oh.isClosed ? null : oh.openTime,
            closeTime: oh.isClosed ? null : oh.closeTime,
          })),
        }),
      ]);

      setIsEditing(false);
      await loadOperationalProfile();
      Alert.alert('Berhasil', 'Profil usaha dan outlet utama berhasil diperbarui.');
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err?.message || 'Gagal memperbarui profil operasional.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen padding="md">
        <View style={styles.centerContainer}>
          <LoadingState message="Memuat profil usaha & outlet utama..." />
        </View>
      </Screen>
    );
  }

  const outlet = outletDetail?.outlet;
  const hours = outletDetail?.operatingHours ?? [];

  return (
    <Screen padding="md">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <AppText variant="caption" color="textSecondary">
              Profil Operasional
            </AppText>
            <AppText variant="h2" color="text">
              Usaha & Outlet Utama
            </AppText>
          </View>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <AppText variant="bodySmall" color="primary">
              ← Kembali
            </AppText>
          </TouchableOpacity>
        </View>

        {/* Status Card */}
        <Card variant="subtle" style={styles.card}>
          <View style={styles.statusRow}>
            <StatusBadge label="PROFIL SIAP" variant="success" />
            <TouchableOpacity onPress={handleToggleEdit}>
              <AppText variant="caption" color="primary" style={{ fontWeight: '600' }}>
                {isEditing ? 'Batal Ubah' : '✎ Ubah Profil'}
              </AppText>
            </TouchableOpacity>
          </View>

          {isEditing ? (
            /* ================= EDIT MODE ================= */
            <View style={{ marginTop: spacing.md }}>
              <AppText variant="h3" color="text" style={{ marginBottom: spacing.sm }}>
                Edit Profil Usaha
              </AppText>
              <Input
                label="Nama Usaha *"
                value={editBusinessName}
                onChangeText={setEditBusinessName}
                error={editErrors.businessName}
              />
              <AppText variant="label" color="text" style={{ marginTop: spacing.sm, marginBottom: 4 }}>
                Kategori Usaha *
              </AppText>
              <View style={styles.chipRow}>
                {MERCHANT_BUSINESS_CATEGORIES.map((cat) => {
                  const isSelected = editCategoryCode === cat.code;
                  return (
                    <TouchableOpacity
                      key={cat.code}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => setEditCategoryCode(cat.code)}
                    >
                      <AppText
                        variant="caption"
                        color={isSelected ? 'surface' : 'text'}
                        style={isSelected ? { fontWeight: 'bold' } : undefined}
                      >
                        {cat.label}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {editErrors.categoryCode && (
                <AppText variant="caption" color="error" style={styles.errorText}>
                  {editErrors.categoryCode}
                </AppText>
              )}
              <Input
                label="Deskripsi Usaha"
                value={editDescription}
                onChangeText={setEditDescription}
                style={{ marginTop: spacing.sm }}
              />

              <AppText variant="h3" color="text" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
                Edit Outlet Utama
              </AppText>
              <Input
                label="Nama Outlet *"
                value={editOutletName}
                onChangeText={setEditOutletName}
                error={editErrors.outletName}
              />
              <Input
                label="Nomor Telepon Kontak *"
                value={editContactPhone}
                onChangeText={setEditContactPhone}
                keyboardType="phone-pad"
                error={editErrors.contactPhone}
                style={{ marginTop: spacing.sm }}
              />
              <Input
                label="Provinsi *"
                value={editProvince}
                onChangeText={setEditProvince}
                error={editErrors.province}
                style={{ marginTop: spacing.sm }}
              />
              <Input
                label="Kabupaten / Kota *"
                value={editRegencyOrCity}
                onChangeText={setEditRegencyOrCity}
                error={editErrors.regencyOrCity}
                style={{ marginTop: spacing.sm }}
              />
              <Input
                label="Kecamatan *"
                value={editDistrict}
                onChangeText={setEditDistrict}
                error={editErrors.district}
                style={{ marginTop: spacing.sm }}
              />
              <Input
                label="Kelurahan / Desa *"
                value={editVillageOrSubdistrict}
                onChangeText={setEditVillageOrSubdistrict}
                error={editErrors.villageOrSubdistrict}
                style={{ marginTop: spacing.sm }}
              />
              <Input
                label="Detail Alamat Fisik *"
                value={editAddressDetail}
                onChangeText={setEditAddressDetail}
                multiline
                numberOfLines={2}
                error={editErrors.addressDetail}
                style={{ marginTop: spacing.sm }}
              />
              <Input
                label="Kode Pos (Opsional)"
                value={editPostalCode}
                onChangeText={setEditPostalCode}
                keyboardType="numeric"
                style={{ marginTop: spacing.sm }}
              />

              {/* Titik Koordinat & Zona Waktu */}
              <AppText variant="h3" color="text" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
                Titik Koordinat & Zona Waktu
              </AppText>
              <View style={styles.twoCol}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Input
                    label="Latitude *"
                    placeholder="1.474830"
                    value={editLatitude}
                    onChangeText={setEditLatitude}
                    keyboardType="numeric"
                    error={editErrors.latitude}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Input
                    label="Longitude *"
                    placeholder="124.842079"
                    value={editLongitude}
                    onChangeText={setEditLongitude}
                    keyboardType="numeric"
                    error={editErrors.longitude}
                  />
                </View>
              </View>

              <AppText variant="label" color="text" style={{ marginTop: spacing.sm, marginBottom: 4 }}>
                Zona Waktu Outlet *
              </AppText>
              <View style={styles.chipsContainer}>
                {TIMEZONES.map((tz) => {
                  const isSelected = editTimezone === tz.code;
                  return (
                    <TouchableOpacity
                      key={tz.code}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => setEditTimezone(tz.code)}
                    >
                      <AppText
                        variant="caption"
                        color={isSelected ? 'surface' : 'text'}
                        style={isSelected ? { fontWeight: 'bold' } : undefined}
                      >
                        {tz.label}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {editErrors.timezone && (
                <AppText variant="caption" color="error" style={styles.errorText}>
                  {editErrors.timezone}
                </AppText>
              )}

              {/* Jadwal Operasional (7 Hari) */}
              <AppText variant="h3" color="text" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
                Jadwal Operasional (7 Hari)
              </AppText>
              {editErrors.operatingHours && (
                <AppText variant="caption" color="error" style={{ marginBottom: 8 }}>
                  {editErrors.operatingHours}
                </AppText>
              )}
              {editOperatingHours.map((oh) => {
                const dayName = DAY_NAMES[oh.dayOfWeek];
                return (
                  <View key={oh.dayOfWeek} style={styles.dayRow}>
                    <View style={styles.dayInfo}>
                      <AppText variant="body" color="text" style={{ fontWeight: '600' }}>
                        {dayName}
                      </AppText>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Switch
                          value={!oh.isClosed}
                          onValueChange={(val) => updateEditDaySchedule(oh.dayOfWeek, { isClosed: !val })}
                          trackColor={{ false: '#d1d5db', true: colors.primary }}
                        />
                        <AppText
                          variant="caption"
                          color={oh.isClosed ? 'error' : 'success'}
                          style={{ marginLeft: 8 }}
                        >
                          {oh.isClosed ? 'Tutup' : 'Buka'}
                        </AppText>
                      </View>
                    </View>

                    {!oh.isClosed && (
                      <View style={styles.timeInputsRow}>
                        <Input
                          placeholder="08:00"
                          value={oh.openTime || ''}
                          onChangeText={(val) => updateEditDaySchedule(oh.dayOfWeek, { openTime: val })}
                          style={styles.timeInput}
                        />
                        <AppText variant="body" color="textSecondary" style={{ marginHorizontal: 4 }}>
                          -
                        </AppText>
                        <Input
                          placeholder="21:00"
                          value={oh.closeTime || ''}
                          onChangeText={(val) => updateEditDaySchedule(oh.dayOfWeek, { closeTime: val })}
                          style={styles.timeInput}
                        />
                      </View>
                    )}
                  </View>
                );
              })}

              <View style={{ marginTop: spacing.xl }}>
                <Button
                  title={saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                  variant="primary"
                  onPress={handleSaveEdit}
                  disabled={saving}
                />
              </View>
            </View>
          ) : (
            /* ================= VIEW MODE ================= */
            <View style={{ marginTop: spacing.md }}>
              <AppText variant="h3" color="text" style={{ marginBottom: 2 }}>
                {business?.name}
              </AppText>
              <AppText variant="bodySmall" color="textSecondary" style={{ marginBottom: 12 }}>
                Kategori: {business?.categoryCode} • {business?.description || 'Tidak ada deskripsi'}
              </AppText>

              {/* Outlet Summary */}
              {outlet && (
                <View style={styles.detailBox}>
                  <AppText variant="label" color="textSecondary">
                    OUTLET UTAMA (PRIMARY)
                  </AppText>
                  <AppText variant="bodySmall" color="text" style={{ fontWeight: '600', marginTop: 4 }}>
                    {outlet.name}
                  </AppText>
                  <AppText variant="bodySmall" color="textSecondary">
                    Telepon: {outlet.contactPhone}
                  </AppText>
                  <AppText variant="bodySmall" color="textSecondary">
                    {outlet.addressDetail}
                  </AppText>
                  <AppText variant="caption" color="textSecondary">
                    Kel. {outlet.villageOrSubdistrict}, Kec. {outlet.district}, {outlet.regencyOrCity}, {outlet.province} {outlet.postalCode ? `(${outlet.postalCode})` : ''}
                  </AppText>
                  <AppText variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
                    Koordinat: {outlet.latitude.toFixed(6)}, {outlet.longitude.toFixed(6)} • Zona: {outlet.timezone}
                  </AppText>
                </View>
              )}

              {/* Operating Hours Table */}
              <View style={[styles.detailBox, { marginTop: spacing.md }]}>
                <AppText variant="label" color="textSecondary" style={{ marginBottom: 6 }}>
                  JADWAL OPERASIONAL MINGGUAN (7 HARI)
                </AppText>
                {hours.map((oh: OperatingHourItemDto) => (
                  <View key={oh.dayOfWeek} style={styles.scheduleRow}>
                    <AppText variant="caption" color="text" style={{ width: 60, fontWeight: '600' }}>
                      {DAY_NAMES[oh.dayOfWeek]}
                    </AppText>
                    <AppText
                      variant="caption"
                      color={oh.isClosed ? 'error' : 'success'}
                      style={{ fontWeight: oh.isClosed ? 'normal' : '600' }}
                    >
                      {oh.isClosed ? 'Tutup' : `${oh.openTime} – ${oh.closeTime}`}
                    </AppText>
                  </View>
                ))}
              </View>

              <View style={styles.nextStageNotice}>
                <AppText variant="caption" color="success" style={{ lineHeight: 18 }}>
                  ✓ Profil usaha dan outlet utama telah terdaftar. Tahap berikutnya: Pengaturan katalog & menu produk.
                </AppText>
              </View>
            </View>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl * 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: '#f1f5f9',
  },
  card: {
    marginBottom: spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailBox: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  nextStageNotice: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: '#f0fdf4',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  twoCol: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dayInfo: {
    flexDirection: 'column',
  },
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    width: 72,
    textAlign: 'center',
  },
  errorText: {
    marginTop: 4,
  },
});
