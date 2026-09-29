import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import {
  Screen,
  AppText,
  Input,
  Button,
  Card,
  spacing,
  colors,
  radius,
} from '@platform/mobile-ui';
import { generateUuidV7 } from '@platform/utils';
import { merchantApiClient } from '../api';
import type {
  BusinessSetupDraftDto,
  OperatingHourItemDto,
} from '@platform/api-client';

import { MERCHANT_BUSINESS_CATEGORIES } from '@platform/shared-types';

const BUSINESS_CATEGORIES = MERCHANT_BUSINESS_CATEGORIES;

const TIMEZONES = [
  { code: 'Asia/Jakarta', label: 'WIB — Asia/Jakarta' },
  { code: 'Asia/Makassar', label: 'WITA — Asia/Makassar' },
  { code: 'Asia/Jayapura', label: 'WIT — Asia/Jayapura' },
];

const DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const INITIAL_OPERATING_HOURS: OperatingHourItemDto[] = [
  { dayOfWeek: 1, isClosed: false, openTime: '08:00', closeTime: '21:00' },
  { dayOfWeek: 2, isClosed: false, openTime: '08:00', closeTime: '21:00' },
  { dayOfWeek: 3, isClosed: false, openTime: '08:00', closeTime: '21:00' },
  { dayOfWeek: 4, isClosed: false, openTime: '08:00', closeTime: '21:00' },
  { dayOfWeek: 5, isClosed: false, openTime: '08:00', closeTime: '21:00' },
  { dayOfWeek: 6, isClosed: false, openTime: '08:00', closeTime: '21:00' },
  { dayOfWeek: 7, isClosed: false, openTime: '08:00', closeTime: '21:00' },
];

interface BusinessSetupScreenProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export function BusinessSetupScreen({ onComplete, onCancel }: BusinessSetupScreenProps) {
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');

  const [outletName, setOutletName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [province, setProvince] = useState('');
  const [regencyOrCity, setRegencyOrCity] = useState('');
  const [district, setDistrict] = useState('');
  const [villageOrSubdistrict, setVillageOrSubdistrict] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [timezone, setTimezone] = useState('');
  const [operatingHours, setOperatingHours] = useState<OperatingHourItemDto[]>(INITIAL_OPERATING_HOURS);

  const isInitialLoad = useRef(true);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Fetch or initialize server draft
  const loadDraft = useCallback(async () => {
    try {
      setLoading(true);
      const draft: BusinessSetupDraftDto = await merchantApiClient.getOrCreateBusinessSetupDraft();

      if (draft.business) {
        if (draft.business.name) setBusinessName(draft.business.name);
        if (draft.business.categoryCode) setBusinessCategory(draft.business.categoryCode);
        if (draft.business.description) setBusinessDescription(draft.business.description);
      }

      if (draft.outlet) {
        if (draft.outlet.name) setOutletName(draft.outlet.name);
        if (draft.outlet.contactPhone) setContactPhone(draft.outlet.contactPhone);
        if (draft.outlet.province) setProvince(draft.outlet.province);
        if (draft.outlet.regencyOrCity) setRegencyOrCity(draft.outlet.regencyOrCity);
        if (draft.outlet.district) setDistrict(draft.outlet.district);
        if (draft.outlet.villageOrSubdistrict) setVillageOrSubdistrict(draft.outlet.villageOrSubdistrict);
        if (draft.outlet.addressDetail) setAddressDetail(draft.outlet.addressDetail);
        if (draft.outlet.postalCode) setPostalCode(draft.outlet.postalCode);
        if (draft.outlet.latitude !== undefined && draft.outlet.latitude !== null) {
          setLatitude(String(draft.outlet.latitude));
        } else {
          setLatitude('');
        }
        if (draft.outlet.longitude !== undefined && draft.outlet.longitude !== null) {
          setLongitude(String(draft.outlet.longitude));
        } else {
          setLongitude('');
        }
        if (draft.outlet.timezone) setTimezone(draft.outlet.timezone);
      }

      if (draft.operatingHours && Array.isArray(draft.operatingHours) && draft.operatingHours.length === 7) {
        setOperatingHours(draft.operatingHours);
      }

      if (draft.currentStep && draft.currentStep >= 1 && draft.currentStep <= 4) {
        setCurrentStep(draft.currentStep);
      }
    } catch (err: any) {
      Alert.alert('Gagal Memuat Data', err?.message || 'Tidak dapat memuat draft setup usaha.');
    } finally {
      setLoading(false);
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 500);
    }
  }, []);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  // 2. Autosave triggers on state change (debounced 1000ms)
  const triggerAutosave = useCallback(async () => {
    if (isInitialLoad.current) return;

    try {
      setAutosaveStatus('saving');
      const trimmedLat = latitude.trim();
      const trimmedLon = longitude.trim();
      const parsedLat = trimmedLat !== '' ? parseFloat(trimmedLat) : undefined;
      const parsedLon = trimmedLon !== '' ? parseFloat(trimmedLon) : undefined;
      const validLat = parsedLat !== undefined && !isNaN(parsedLat) ? parsedLat : undefined;
      const validLon = parsedLon !== undefined && !isNaN(parsedLon) ? parsedLon : undefined;

      await merchantApiClient.saveBusinessSetupDraft({
        currentStep,
        business: {
          name: businessName,
          categoryCode: businessCategory,
          description: businessDescription || null,
        },
        outlet: {
          name: outletName,
          contactPhone,
          province,
          regencyOrCity,
          district,
          villageOrSubdistrict,
          addressDetail,
          postalCode: postalCode || null,
          latitude: validLat,
          longitude: validLon,
          timezone,
        },
        operatingHours,
      });

      setAutosaveStatus('saved');
    } catch {
      setAutosaveStatus('error');
    }
  }, [
    currentStep,
    businessName,
    businessCategory,
    businessDescription,
    outletName,
    contactPhone,
    province,
    regencyOrCity,
    district,
    villageOrSubdistrict,
    addressDetail,
    postalCode,
    latitude,
    longitude,
    timezone,
    operatingHours,
  ]);

  useEffect(() => {
    if (isInitialLoad.current) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      triggerAutosave();
    }, 1000);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [triggerAutosave]);

  // Step Validation
  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!businessName.trim()) errors.businessName = 'Nama usaha wajib diisi';
      if (!businessCategory.trim()) errors.businessCategory = 'Kategori usaha wajib dipilih';
    } else if (step === 2) {
      if (!outletName.trim()) errors.outletName = 'Nama outlet wajib diisi';
      if (!contactPhone.trim()) errors.contactPhone = 'Nomor telepon outlet wajib diisi';
      if (!province.trim()) errors.province = 'Provinsi wajib diisi';
      if (!regencyOrCity.trim()) errors.regencyOrCity = 'Kabupaten/Kota wajib diisi';
      if (!district.trim()) errors.district = 'Kecamatan wajib diisi';
      if (!villageOrSubdistrict.trim()) errors.villageOrSubdistrict = 'Kelurahan/Desa wajib diisi';
      if (!addressDetail.trim()) errors.addressDetail = 'Detail alamat fisik wajib diisi';
    } else if (step === 3) {
      const trimmedLat = latitude.trim();
      const trimmedLon = longitude.trim();
      if (!trimmedLat) {
        errors.latitude = 'Latitude wajib diisi';
      } else {
        const latNum = parseFloat(trimmedLat);
        if (isNaN(latNum) || latNum < -90 || latNum > 90) {
          errors.latitude = 'Latitude harus bernilai antara -90 dan 90';
        }
      }

      if (!trimmedLon) {
        errors.longitude = 'Longitude wajib diisi';
      } else {
        const lonNum = parseFloat(trimmedLon);
        if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
          errors.longitude = 'Longitude harus bernilai antara -180 dan 180';
        }
      }
      if (!timezone.trim()) {
        errors.timezone = 'Zona waktu wajib dipilih';
      }

      // Check operating hours
      for (const oh of operatingHours) {
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
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 4) {
        setCurrentStep((prev) => prev + 1);
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Complete Setup
  const handleCompleteSetup = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      Alert.alert('Data Belum Lengkap', 'Mohon lengkapi seluruh langkah formulir sebelum menyelesaikan setup.');
      return;
    }

    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const latNum = parseFloat(latitude);
      const lonNum = parseFloat(longitude);
      const idempotencyKey = generateUuidV7();

      await merchantApiClient.completeBusinessSetup(
        {
          business: {
            name: businessName.trim(),
            categoryCode: businessCategory.trim(),
            description: businessDescription.trim() || null,
          },
          outlet: {
            name: outletName.trim(),
            contactPhone: contactPhone.trim(),
            province: province.trim(),
            regencyOrCity: regencyOrCity.trim(),
            district: district.trim(),
            villageOrSubdistrict: villageOrSubdistrict.trim(),
            addressDetail: addressDetail.trim(),
            postalCode: postalCode.trim() || null,
            latitude: latNum,
            longitude: lonNum,
            timezone: timezone.trim(),
          },
          operatingHours,
        },
        idempotencyKey,
      );

      Alert.alert(
        'Setup Selesai',
        'Profil Usaha & Outlet Utama Anda telah berhasil didaftarkan.',
        [{ text: 'Lanjutkan', onPress: () => onComplete() }],
      );
    } catch (err: any) {
      Alert.alert('Gagal Menyelesaikan Setup', err?.message || 'Terjadi kesalahan saat memproses setup usaha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateDaySchedule = (dayOfWeek: number, patch: Partial<OperatingHourItemDto>) => {
    setOperatingHours((prev) =>
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

  if (loading) {
    return (
      <Screen padding="md">
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="body" color="textSecondary" style={{ marginTop: 12 }}>
            Memuat profil setup usaha...
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padding="md">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <AppText variant="caption" color="textSecondary">
              SETUP OPERASIONAL MITRA
            </AppText>
            <AppText variant="h2" color="text">
              Langkah {currentStep} dari 4
            </AppText>
          </View>
          <View style={styles.headerRight}>
            {autosaveStatus === 'saving' && (
              <AppText variant="caption" color="textSecondary">
                Menyimpan...
              </AppText>
            )}
            {autosaveStatus === 'saved' && (
              <AppText variant="caption" color="success">
                ✓ Tersimpan
              </AppText>
            )}
            {autosaveStatus === 'error' && (
              <AppText variant="caption" color="error">
                ! Gagal simpan
              </AppText>
            )}
            {onCancel && (
              <TouchableOpacity onPress={onCancel} style={{ marginLeft: 8 }}>
                <AppText variant="caption" color="error">
                  Tutup
                </AppText>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Step Indicator Progress Bar */}
        <View style={styles.stepBarContainer}>
          {[1, 2, 3, 4].map((step) => (
            <View
              key={step}
              style={[
                styles.stepBarSegment,
                step <= currentStep ? styles.stepBarActive : styles.stepBarInactive,
              ]}
            />
          ))}
        </View>

        {/* ================= STEP 1: INFORMASI USAHA ================= */}
        {currentStep === 1 && (
          <View style={styles.stepContainer}>
            <Card style={styles.card}>
              <AppText variant="h3" color="text" style={{ marginBottom: 4 }}>
                Informasi Usaha
              </AppText>
              <AppText variant="bodySmall" color="textSecondary" style={{ marginBottom: 16 }}>
                Masukkan identitas usaha komersial Anda. Nama usaha ini akan terhubung dengan profil merchant Anda.
              </AppText>

              <Input
                label="Nama Usaha *"
                placeholder="Contoh: RM Manado Mantap"
                value={businessName}
                onChangeText={setBusinessName}
                error={fieldErrors.businessName}
              />

              <AppText variant="label" color="text" style={{ marginTop: 12, marginBottom: 6 }}>
                Kategori Usaha *
              </AppText>
              <View style={styles.chipsContainer}>
                {BUSINESS_CATEGORIES.map((cat) => {
                  const isSelected = businessCategory === cat.code;
                  return (
                    <TouchableOpacity
                      key={cat.code}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => setBusinessCategory(cat.code)}
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
                {!BUSINESS_CATEGORIES.some((c) => c.code === businessCategory) && businessCategory ? (
                  <TouchableOpacity
                    key={businessCategory}
                    style={[styles.chip, styles.chipSelected]}
                    onPress={() => setBusinessCategory(businessCategory)}
                  >
                    <AppText variant="caption" color="surface" style={{ fontWeight: 'bold' }}>
                      {businessCategory}
                    </AppText>
                  </TouchableOpacity>
                ) : null}
              </View>
              {fieldErrors.businessCategory && (
                <AppText variant="caption" color="error" style={{ marginTop: 4 }}>
                  {fieldErrors.businessCategory}
                </AppText>
              )}

              <Input
                label="Deskripsi Usaha (Opsional)"
                placeholder="Penjelasan singkat mengenai menu andalan atau produk usaha Anda"
                value={businessDescription}
                onChangeText={setBusinessDescription}
                multiline
                numberOfLines={3}
                style={{ marginTop: 12 }}
              />
            </Card>
          </View>
        )}

        {/* ================= STEP 2: OUTLET UTAMA ================= */}
        {currentStep === 2 && (
          <View style={styles.stepContainer}>
            <Card style={styles.card}>
              <AppText variant="h3" color="text" style={{ marginBottom: 4 }}>
                Outlet Utama
              </AppText>
              <AppText variant="bodySmall" color="textSecondary" style={{ marginBottom: 16 }}>
                Tentukan lokasi fisik outlet utama untuk melayani pesanan pelanggan dan titik penjemputan mitra driver.
              </AppText>

              <Input
                label="Nama Outlet Utama *"
                placeholder="Contoh: Outlet Pusat Sam Ratulangi"
                value={outletName}
                onChangeText={setOutletName}
                error={fieldErrors.outletName}
              />

              <Input
                label="Nomor Telepon Outlet *"
                placeholder="08xxxxxxxxxx"
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
                error={fieldErrors.contactPhone}
                style={{ marginTop: 10 }}
              />

              <Input
                label="Provinsi *"
                value={province}
                onChangeText={setProvince}
                error={fieldErrors.province}
                style={{ marginTop: 10 }}
              />

              <Input
                label="Kabupaten / Kota *"
                value={regencyOrCity}
                onChangeText={setRegencyOrCity}
                error={fieldErrors.regencyOrCity}
                style={{ marginTop: 10 }}
              />

              <Input
                label="Kecamatan *"
                placeholder="Contoh: Wenang"
                value={district}
                onChangeText={setDistrict}
                error={fieldErrors.district}
                style={{ marginTop: 10 }}
              />

              <Input
                label="Kelurahan / Desa *"
                placeholder="Contoh: Calaca"
                value={villageOrSubdistrict}
                onChangeText={setVillageOrSubdistrict}
                error={fieldErrors.villageOrSubdistrict}
                style={{ marginTop: 10 }}
              />

              <Input
                label="Detail Alamat Fisik *"
                placeholder="Nama jalan, nomor bangunan, patokan lokasi"
                value={addressDetail}
                onChangeText={setAddressDetail}
                multiline
                numberOfLines={2}
                error={fieldErrors.addressDetail}
                style={{ marginTop: 10 }}
              />

              <Input
                label="Kode Pos (Opsional)"
                placeholder="Contoh: 95111"
                value={postalCode}
                onChangeText={setPostalCode}
                keyboardType="numeric"
                style={{ marginTop: 10 }}
              />
            </Card>
          </View>
        )}

        {/* ================= STEP 3: LOKASI & JAM OPERASIONAL ================= */}
        {currentStep === 3 && (
          <View style={styles.stepContainer}>
            <Card style={styles.card}>
              <AppText variant="h3" color="text" style={{ marginBottom: 4 }}>
                Titik Koordinat & Zona Waktu
              </AppText>
              <AppText variant="bodySmall" color="textSecondary" style={{ marginBottom: 16 }}>
                Koordinat spasial akurat (WGS84) diperlukan untuk penentuan jarak rute pengantaran driver.
              </AppText>

              <View style={styles.twoCol}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Input
                    label="Latitude *"
                    placeholder="1.474830"
                    value={latitude}
                    onChangeText={setLatitude}
                    keyboardType="numeric"
                    error={fieldErrors.latitude}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Input
                    label="Longitude *"
                    placeholder="124.842079"
                    value={longitude}
                    onChangeText={setLongitude}
                    keyboardType="numeric"
                    error={fieldErrors.longitude}
                  />
                </View>
              </View>

              <AppText variant="label" color="text" style={{ marginTop: 12, marginBottom: 6 }}>
                Zona Waktu Outlet *
              </AppText>
              <View style={styles.chipsContainer}>
                {TIMEZONES.map((tz) => {
                  const isSelected = timezone === tz.code;
                  return (
                    <TouchableOpacity
                      key={tz.code}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => {
                        setTimezone(tz.code);
                        if (fieldErrors.timezone) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.timezone;
                            return next;
                          });
                        }
                      }}
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
              {fieldErrors.timezone && (
                <AppText variant="caption" color="error" style={{ marginTop: 4 }}>
                  {fieldErrors.timezone}
                </AppText>
              )}
            </Card>

            <Card style={[styles.card, { marginTop: 16 }]}>
              <AppText variant="h3" color="text" style={{ marginBottom: 4 }}>
                Jadwal Operasional (7 Hari)
              </AppText>
              <AppText variant="bodySmall" color="textSecondary" style={{ marginBottom: 12 }}>
                Atur status buka/tutup serta jam buka dan tutup lokal gerai (Senin s/d Minggu).
              </AppText>

              {fieldErrors.operatingHours && (
                <AppText variant="caption" color="error" style={{ marginBottom: 8 }}>
                  {fieldErrors.operatingHours}
                </AppText>
              )}

              {operatingHours.map((oh) => {
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
                          onValueChange={(val) => updateDaySchedule(oh.dayOfWeek, { isClosed: !val })}
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
                          onChangeText={(val) => updateDaySchedule(oh.dayOfWeek, { openTime: val })}
                          style={styles.timeInput}
                        />
                        <AppText variant="body" color="textSecondary" style={{ marginHorizontal: 4 }}>
                          -
                        </AppText>
                        <Input
                          placeholder="21:00"
                          value={oh.closeTime || ''}
                          onChangeText={(val) => updateDaySchedule(oh.dayOfWeek, { closeTime: val })}
                          style={styles.timeInput}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        {/* ================= STEP 4: REVIEW & COMPLETE ================= */}
        {currentStep === 4 && (
          <View style={styles.stepContainer}>
            <Card style={styles.card}>
              <AppText variant="h3" color="text" style={{ marginBottom: 4 }}>
                Konfirmasi Data Usaha & Outlet
              </AppText>
              <AppText variant="bodySmall" color="textSecondary" style={{ marginBottom: 16 }}>
                Periksa kembali data Anda sebelum menyelesaikan setup. Setelah selesai, profil usaha dan outlet utama Anda akan tersimpan.
              </AppText>

              {/* Review Usaha */}
              <View style={styles.reviewSection}>
                <AppText variant="label" color="primary" style={{ marginBottom: 6 }}>
                  INFORMASI USAHA
                </AppText>
                <AppText variant="body" color="text" style={{ fontWeight: 'bold' }}>
                  {businessName}
                </AppText>
                <AppText variant="bodySmall" color="textSecondary">
                  Kategori: {BUSINESS_CATEGORIES.find((c) => c.code === businessCategory)?.label || businessCategory}
                </AppText>
                {businessDescription ? (
                  <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                    Deskripsi: {businessDescription}
                  </AppText>
                ) : null}
              </View>

              {/* Review Outlet */}
              <View style={styles.reviewSection}>
                <AppText variant="label" color="primary" style={{ marginBottom: 6 }}>
                  OUTLET UTAMA & ALAMAT
                </AppText>
                <AppText variant="body" color="text" style={{ fontWeight: 'bold' }}>
                  {outletName} (Telepon: {contactPhone})
                </AppText>
                <AppText variant="bodySmall" color="text">
                  {addressDetail}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  Kel. {villageOrSubdistrict}, Kec. {district}, {regencyOrCity}, {province}
                  {postalCode ? ` (${postalCode})` : ''}
                </AppText>
              </View>

              {/* Review Lokasi & Waktu */}
              <View style={styles.reviewSection}>
                <AppText variant="label" color="primary" style={{ marginBottom: 6 }}>
                  LOKASI & ZONA WAKTU
                </AppText>
                <AppText variant="bodySmall" color="text">
                  Koordinat: {latitude}, {longitude}
                </AppText>
                <AppText variant="bodySmall" color="textSecondary">
                  Zona Waktu: {timezone}
                </AppText>
              </View>

              {/* Review Jadwal Operasional */}
              <View style={styles.reviewSection}>
                <AppText variant="label" color="primary" style={{ marginBottom: 6 }}>
                  JADWAL OPERASIONAL (7 HARI)
                </AppText>
                {operatingHours.map((oh) => (
                  <View key={oh.dayOfWeek} style={styles.reviewScheduleRow}>
                    <AppText variant="caption" color="text" style={{ width: 70, fontWeight: '600' }}>
                      {DAY_NAMES[oh.dayOfWeek]}:
                    </AppText>
                    <AppText
                      variant="caption"
                      color={oh.isClosed ? 'error' : 'textSecondary'}
                    >
                      {oh.isClosed ? 'Tutup' : `${oh.openTime} - ${oh.closeTime}`}
                    </AppText>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        )}

        {/* Navigation Buttons */}
        <View style={styles.navButtonsRow}>
          {currentStep > 1 && (
            <Button
              title="Kembali"
              variant="outline"
              onPress={handlePrevStep}
              style={{ flex: 1, marginRight: 8 }}
              disabled={isSubmitting}
            />
          )}

          {currentStep < 4 ? (
            <Button
              title="Lanjutkan"
              variant="primary"
              onPress={handleNextStep}
              style={{ flex: 1 }}
            />
          ) : (
            <Button
              title={isSubmitting ? 'Memproses...' : 'Selesaikan Setup Usaha'}
              variant="primary"
              onPress={handleCompleteSetup}
              disabled={isSubmitting}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBarContainer: {
    flexDirection: 'row',
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: radius.full,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  stepBarSegment: {
    flex: 1,
    height: '100%',
  },
  stepBarActive: {
    backgroundColor: colors.primary,
  },
  stepBarInactive: {
    backgroundColor: '#e5e7eb',
  },
  stepContainer: {
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.md,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  twoCol: {
    flexDirection: 'row',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dayInfo: {
    flex: 1,
  },
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 160,
    justifyContent: 'flex-end',
  },
  timeInput: {
    width: 70,
    textAlign: 'center',
    paddingVertical: 4,
  },
  reviewSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 12,
    marginBottom: 12,
  },
  reviewScheduleRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  navButtonsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
});
