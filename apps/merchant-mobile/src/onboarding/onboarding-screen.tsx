import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Screen,
  AppText,
  Input,
  Button,
  Card,
  StatusBadge,
  spacing,
  colors,
  radius,
} from '@platform/mobile-ui';
import { useOnboarding } from './onboarding-context';
import { useMerchantAuth } from '../auth/auth-context';
import { MERCHANT_TERMS_VERSION, PRIVACY_NOTICE_VERSION } from '@platform/shared-types';

const CATEGORIES = [
  'KULINER',
  'TOKO_KELONTONG',
  'FASHION',
  'ELEKTRONIK',
  'JASA',
  'LAINNYA',
];

export function MerchantOnboardingScreen() {
  const {
    draft,
    currentStep,
    setCurrentStep,
    updateDraftField,
    saveDraftImmediate,
    uploadKtpFile,
    submitOnboarding,
    autosaveStatus,
    loading,
    error,
  } = useOnboarding();
  const { logout } = useMerchantAuth();

  // Local step validation state
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  // Step 5: Consents
  const [dataAccuracyAccepted, setDataAccuracyAccepted] = useState(false);
  const [merchantTermsAccepted, setMerchantTermsAccepted] = useState(false);
  const [privacyConsentAccepted, setPrivacyConsentAccepted] = useState(false);

  // KTP Upload state
  const [uploadingKtp, setUploadingKtp] = useState(false);
  const [localKtpUri, setLocalKtpUri] = useState<string | null>(null);

  // Validate current step before moving forward
  const validateStep = (step: number): boolean => {
    const errs: Record<string, string> = {};

    if (step === 1) {
      if (!draft?.fullName || draft.fullName.trim().length < 2) {
        errs.fullName = 'Nama lengkap wajib diisi (minimal 2 karakter)';
      }
      if (!draft?.nik || !/^\d{16}$/.test(draft.nik.trim())) {
        errs.nik = 'NIK wajib 16 digit angka';
      }
    } else if (step === 2) {
      if (!draft?.proposedBusinessName || draft.proposedBusinessName.trim().length < 2) {
        errs.proposedBusinessName = 'Nama calon usaha wajib diisi (minimal 2 karakter)';
      }
      if (!draft?.businessCategory) {
        errs.businessCategory = 'Pilih salah satu kategori usaha';
      }
    } else if (step === 3) {
      if (!draft?.province || draft.province.trim().length < 2) {
        errs.province = 'Provinsi wajib diisi';
      }
      if (!draft?.regencyOrCity || draft.regencyOrCity.trim().length < 2) {
        errs.regencyOrCity = 'Kota/Kabupaten wajib diisi';
      }
      if (!draft?.district || draft.district.trim().length < 2) {
        errs.district = 'Kecamatan wajib diisi';
      }
      if (!draft?.villageOrSubdistrict || draft.villageOrSubdistrict.trim().length < 2) {
        errs.villageOrSubdistrict = 'Kelurahan/Desa wajib diisi';
      }
      if (!draft?.addressDetail || draft.addressDetail.trim().length < 5) {
        errs.addressDetail = 'Alamat lengkap wajib diisi (minimal 5 karakter)';
      }
    } else if (step === 4) {
      if (!draft?.ktpDocumentId) {
        errs.ktp = 'Foto KTP depan wajib diunggah untuk melanjutkan';
      }
    }

    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = async () => {
    if (validateStep(currentStep)) {
      await saveDraftImmediate();
      setCurrentStep(Math.min(5, currentStep + 1));
    }
  };

  const handlePrev = () => {
    setCurrentStep(Math.max(1, currentStep - 1));
  };

  const handlePickKtp = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Izin Diperlukan',
          'Izin akses galeri foto diperlukan untuk mengunggah dokumen KTP.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setUploadingKtp(true);
      setStepErrors((prev) => {
        const copy = { ...prev };
        delete copy.ktp;
        return copy;
      });

      setLocalKtpUri(asset.uri);
      const filename = asset.fileName || `ktp_${Date.now()}.${asset.mimeType === 'image/png' ? 'png' : 'jpg'}`;
      const mimeType = asset.mimeType || 'image/jpeg';

      await uploadKtpFile(
        {
          uri: asset.uri,
          name: filename,
          type: mimeType,
        },
        filename,
      );

      Alert.alert('Sukses', 'Foto KTP depan berhasil diunggah.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunggah foto KTP';
      Alert.alert('Gagal', msg);
    } finally {
      setUploadingKtp(false);
    }
  };

  const doSubmit = async () => {
    try {
      await submitOnboarding({
        dataAccuracyAccepted: true,
        merchantTermsAccepted: true,
        privacyConsentAccepted: true,
      });
      Alert.alert('Pendaftaran Berhasil Dikirim', 'Pendaftaran Anda sedang ditinjau oleh tim verifikasi TorangGo.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirimkan pendaftaran';
      Alert.alert('Pengiriman Gagal', msg);
    }
  };

  const handleSubmit = () => {
    if (!dataAccuracyAccepted || !merchantTermsAccepted || !privacyConsentAccepted) {
      Alert.alert('Persetujuan Wajib', 'Anda wajib mencentang ketiga persetujuan sebelum mengirim pendaftaran.');
      return;
    }

    Alert.alert(
      'Konfirmasi Pengiriman',
      'Setelah dikirim, data pengajuan tidak dapat diubah selama proses verifikasi. Apakah Anda yakin data sudah benar?',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Ya, Kirim', onPress: doSubmit },
      ],
    );
  };

  return (
    <Screen padding="md">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Header with Autosave Status and Logout */}
        <View style={styles.topBar}>
          <View>
            <AppText variant="caption" color="textSecondary">
              Pendaftaran Mitra TorangGo
            </AppText>
            <AppText variant="h3" color="text">
              Langkah {currentStep} dari 5
            </AppText>
          </View>
          <View style={styles.topBarRight}>
            <View style={styles.autosaveBadge}>
              {autosaveStatus === 'saving' && (
                <View style={styles.savingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <AppText variant="caption" color="textSecondary" style={styles.autosaveText}>
                    Menyimpan...
                  </AppText>
                </View>
              )}
              {autosaveStatus === 'saved' && (
                <AppText variant="caption" color="success">
                  ✓ Tersimpan
                </AppText>
              )}
              {autosaveStatus === 'error' && (
                <AppText variant="caption" color="error">
                  Gagal menyimpan
                </AppText>
              )}
            </View>
            <TouchableOpacity onPress={() => logout()} style={styles.logoutBtn}>
              <AppText variant="caption" color="error">
                Keluar
              </AppText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Step Progress Bar */}
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4, 5].map((s) => (
            <View
              key={s}
              style={[
                styles.progressSegment,
                s <= currentStep ? styles.progressSegmentActive : styles.progressSegmentInactive,
              ]}
            />
          ))}
        </View>

        {error && (
          <Card variant="outlined" style={styles.errorCard}>
            <AppText variant="bodySmall" color="error">
              {error}
            </AppText>
          </Card>
        )}

        {/* STEP 1: DATA PEMILIK */}
        {currentStep === 1 && (
          <Card variant="subtle" style={styles.formCard}>
            <AppText variant="h3" color="text" style={styles.stepTitle}>
              1. Data Diri Pemilik Usaha
            </AppText>
            <AppText variant="bodySmall" color="textSecondary" style={styles.stepDesc}>
              Pastikan data sesuai dengan Kartu Tanda Penduduk (KTP) yang sah.
            </AppText>

            <View style={styles.field}>
              <Input
                label="Nama Lengkap Pemilik (sesuai KTP)*"
                placeholder="Contoh: Budi Santoso"
                value={draft?.fullName ?? ''}
                onChangeText={(text) => updateDraftField({ fullName: text })}
                error={stepErrors.fullName}
              />
            </View>

            <View style={styles.field}>
              <Input
                label="Nomor Induk Kependudukan (NIK 16 Digit)*"
                placeholder="7171012345678901"
                keyboardType="numeric"
                maxLength={16}
                value={draft?.nik ?? ''}
                onChangeText={(text) => updateDraftField({ nik: text.replace(/\D/g, '') })}
                error={stepErrors.nik}
              />
            </View>

            <View style={styles.field}>
              <Input
                label="Nomor HP Akun (Terotentikasi)"
                value={draft?.accountPhone ?? ''}
                editable={false}
                helperText="Nomor telepon ini tersinkronisasi otomatis dengan akun Anda"
              />
            </View>

            <View style={styles.field}>
              <Input
                label="Alamat Email (Opsional)"
                placeholder="pemilik@usaha.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={draft?.email ?? ''}
                onChangeText={(text) => updateDraftField({ email: text.trim() })}
              />
            </View>

            <View style={styles.field}>
              <Input
                label="Nomor Kontak Alternatif (Opsional)"
                placeholder="Contoh: 08123456789"
                keyboardType="phone-pad"
                value={draft?.alternateContact ?? ''}
                onChangeText={(text) => updateDraftField({ alternateContact: text })}
              />
            </View>
          </Card>
        )}

        {/* STEP 2: CALON USAHA */}
        {currentStep === 2 && (
          <Card variant="subtle" style={styles.formCard}>
            <AppText variant="h3" color="text" style={styles.stepTitle}>
              2. Informasi Calon Usaha
            </AppText>
            <AppText variant="bodySmall" color="textSecondary" style={styles.stepDesc}>
              Masukkan identitas usaha yang akan Anda daftarkan sebagai Mitra TorangGo.
            </AppText>

            <View style={styles.field}>
              <Input
                label="Nama Calon Usaha / Toko*"
                placeholder="Contoh: Warung Kopi Torang Mantap"
                value={draft?.proposedBusinessName ?? ''}
                onChangeText={(text) => updateDraftField({ proposedBusinessName: text })}
                error={stepErrors.proposedBusinessName}
              />
            </View>

            <View style={styles.field}>
              <AppText variant="label" color="text" style={styles.fieldLabel}>
                Kategori Usaha*
              </AppText>
              <View style={styles.chipContainer}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.chip,
                      draft?.businessCategory === cat ? styles.chipActive : styles.chipInactive,
                    ]}
                    onPress={() => updateDraftField({ businessCategory: cat })}
                  >
                    <AppText
                      variant="bodySmall"
                      color={draft?.businessCategory === cat ? 'primary' : 'textSecondary'}
                    >
                      {cat.replace('_', ' ')}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </View>
              {stepErrors.businessCategory && (
                <AppText variant="caption" color="error" style={styles.errorText}>
                  {stepErrors.businessCategory}
                </AppText>
              )}
            </View>

            <View style={styles.field}>
              <Input
                label="Deskripsi Singkat Usaha (Opsional)"
                placeholder="Contoh: Menyediakan berbagai macam kuliner khas Minahasa dan kopi segar..."
                multiline
                numberOfLines={3}
                value={draft?.businessDescription ?? ''}
                onChangeText={(text) => updateDraftField({ businessDescription: text })}
              />
            </View>
          </Card>
        )}

        {/* STEP 3: ALAMAT KORESPONDENSI */}
        {currentStep === 3 && (
          <Card variant="subtle" style={styles.formCard}>
            <AppText variant="h3" color="text" style={styles.stepTitle}>
              3. Alamat Korespondensi Usaha
            </AppText>
            <AppText variant="bodySmall" color="textSecondary" style={styles.stepDesc}>
              Alamat korespondensi administratif untuk verifikasi awal.
            </AppText>

            <View style={styles.field}>
              <Input
                label="Provinsi*"
                placeholder="Contoh: Sulawesi Utara"
                value={draft?.province ?? ''}
                onChangeText={(text) => updateDraftField({ province: text })}
                error={stepErrors.province}
              />
            </View>

            <View style={styles.field}>
              <Input
                label="Kota / Kabupaten*"
                placeholder="Contoh: Kota Manado"
                value={draft?.regencyOrCity ?? ''}
                onChangeText={(text) => updateDraftField({ regencyOrCity: text })}
                error={stepErrors.regencyOrCity}
              />
            </View>

            <View style={styles.field}>
              <Input
                label="Kecamatan*"
                placeholder="Contoh: Wenang"
                value={draft?.district ?? ''}
                onChangeText={(text) => updateDraftField({ district: text })}
                error={stepErrors.district}
              />
            </View>

            <View style={styles.field}>
              <Input
                label="Kelurahan / Desa*"
                placeholder="Contoh: Tikala Baru"
                value={draft?.villageOrSubdistrict ?? ''}
                onChangeText={(text) => updateDraftField({ villageOrSubdistrict: text })}
                error={stepErrors.villageOrSubdistrict}
              />
            </View>

            <View style={styles.field}>
              <Input
                label="Alamat Lengkap & Patokan*"
                placeholder="Contoh: Jl. Sam Ratulangi No. 123, samping Gereja Sentrum"
                multiline
                numberOfLines={3}
                value={draft?.addressDetail ?? ''}
                onChangeText={(text) => updateDraftField({ addressDetail: text })}
                error={stepErrors.addressDetail}
              />
            </View>
          </Card>
        )}

        {/* STEP 4: DOKUMEN IDENTITAS (KTP) */}
        {currentStep === 4 && (
          <Card variant="subtle" style={styles.formCard}>
            <AppText variant="h3" color="text" style={styles.stepTitle}>
              4. Dokumen Identitas Pemilik
            </AppText>
            <AppText variant="bodySmall" color="textSecondary" style={styles.stepDesc}>
              Unggah foto tampak depan KTP pemilik yang jelas dan tidak terpotong (Format JPEG atau PNG, maksimal 5MB).
            </AppText>

            <View style={styles.ktpUploadBox}>
              {localKtpUri ? (
                <View style={styles.ktpPreviewBox}>
                  <Image source={{ uri: localKtpUri }} style={styles.ktpPreviewImage} resizeMode="contain" />
                  <StatusBadge label="KTP TERUNGGAH" variant="success" />
                </View>
              ) : draft?.ktpDocument ? (
                <View style={styles.ktpSuccessBox}>
                  <StatusBadge label="KTP TERUNGGAH" variant="success" />
                  <AppText variant="body" color="text" style={styles.ktpFilename}>
                    {draft.ktpDocument.sanitizedOriginalFilename}
                  </AppText>
                  <AppText variant="caption" color="textSecondary">
                    Ukuran: {(draft.ktpDocument.sizeBytes / 1024).toFixed(1)} KB • {draft.ktpDocument.mimeType}
                  </AppText>
                </View>
              ) : (
                <View style={styles.ktpPlaceholderBox}>
                  <AppText variant="bodySmall" color="textSecondary" style={styles.ktpPlaceholderText}>
                    Belum ada foto KTP yang diunggah
                  </AppText>
                </View>
              )}

              <View style={styles.ktpActionRow}>
                <Button
                  title={uploadingKtp ? 'Mengunggah...' : draft?.ktpDocument ? 'Ganti Foto KTP' : 'Unggah Foto KTP'}
                  variant="primary"
                  onPress={handlePickKtp}
                  disabled={uploadingKtp || loading}
                />
              </View>

              {stepErrors.ktp && (
                <AppText variant="caption" color="error" style={styles.errorText}>
                  {stepErrors.ktp}
                </AppText>
              )}
            </View>
          </Card>
        )}

        {/* STEP 5: REVIEW & PERSETUJUAN */}
        {currentStep === 5 && (
          <View>
            <Card variant="subtle" style={styles.formCard}>
              <AppText variant="h3" color="text" style={styles.stepTitle}>
                5. Tinjau & Kirim Pendaftaran
              </AppText>
              <AppText variant="bodySmall" color="textSecondary" style={styles.stepDesc}>
                Periksa kembali data pendaftaran Anda sebelum mengirimkannya kepada tim verifikasi.
              </AppText>

              {/* Review Summary */}
              <View style={styles.reviewSection}>
                <AppText variant="label" color="primary">
                  DATA PEMILIK
                </AppText>
                <View style={styles.reviewSectionHeader}>
                  <AppText variant="label" color="primary">
                    DATA PEMILIK
                  </AppText>
                  <TouchableOpacity onPress={() => setCurrentStep(1)}>
                    <AppText variant="caption" color="primary" style={styles.editLink}>
                      Ubah
                    </AppText>
                  </TouchableOpacity>
                </View>
                <AppText variant="bodySmall" color="text">
                  Nama: {draft?.fullName}
                </AppText>
                <AppText variant="bodySmall" color="text">
                  NIK: {draft?.nik ? `************${draft.nik.slice(-4)}` : '—'}
                </AppText>
                <AppText variant="bodySmall" color="text">
                  Telepon: {draft?.accountPhone}
                </AppText>
                {draft?.email && (
                  <AppText variant="bodySmall" color="text">
                    Email: {draft.email}
                  </AppText>
                )}
              </View>

              <View style={styles.reviewSection}>
                <AppText variant="label" color="primary">
                  CALON USAHA
                </AppText>
                <View style={styles.reviewSectionHeader}>
                  <AppText variant="label" color="primary">
                    CALON USAHA
                  </AppText>
                  <TouchableOpacity onPress={() => setCurrentStep(2)}>
                    <AppText variant="caption" color="primary" style={styles.editLink}>
                      Ubah
                    </AppText>
                  </TouchableOpacity>
                </View>
                <AppText variant="bodySmall" color="text">
                  Nama Usaha: {draft?.proposedBusinessName}
                </AppText>
                <AppText variant="bodySmall" color="text">
                  Kategori: {draft?.businessCategory}
                </AppText>
              </View>

              <View style={styles.reviewSection}>
                <AppText variant="label" color="primary">
                  ALAMAT
                </AppText>
                <View style={styles.reviewSectionHeader}>
                  <AppText variant="label" color="primary">
                    ALAMAT
                  </AppText>
                  <TouchableOpacity onPress={() => setCurrentStep(3)}>
                    <AppText variant="caption" color="primary" style={styles.editLink}>
                      Ubah
                    </AppText>
                  </TouchableOpacity>
                </View>
                <AppText variant="bodySmall" color="text">
                  {draft?.addressDetail}, {draft?.villageOrSubdistrict}, {draft?.district}, {draft?.regencyOrCity}, {draft?.province}
                </AppText>
              </View>

              <View style={styles.reviewSection}>
                <AppText variant="label" color="primary">
                  DOKUMEN KTP
                </AppText>
                <View style={styles.reviewSectionHeader}>
                  <AppText variant="label" color="primary">
                    DOKUMEN KTP
                  </AppText>
                  <TouchableOpacity onPress={() => setCurrentStep(4)}>
                    <AppText variant="caption" color="primary" style={styles.editLink}>
                      Ubah
                    </AppText>
                  </TouchableOpacity>
                </View>
                <AppText variant="bodySmall" color="text">
                  {draft?.ktpDocument?.sanitizedOriginalFilename ?? 'KTP Terhubung'}
                </AppText>
              </View>
            </Card>

            {/* Consents Checkboxes */}
            <Card variant="outlined" style={styles.consentCard}>
              <AppText variant="label" color="text" style={{ marginBottom: spacing.sm }}>
                Persetujuan & Kebijakan
              </AppText>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setDataAccuracyAccepted(!dataAccuracyAccepted)}
              >
                <View style={[styles.checkbox, dataAccuracyAccepted && styles.checkboxChecked]}>
                  {dataAccuracyAccepted && <AppText variant="caption" color="surface">✓</AppText>}
                </View>
                <AppText variant="bodySmall" color="text" style={styles.checkboxLabel}>
                  Saya menyatakan bahwa seluruh data dan dokumen yang saya berikan adalah benar, akurat, dan sah.*
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setMerchantTermsAccepted(!merchantTermsAccepted)}
              >
                <View style={[styles.checkbox, merchantTermsAccepted && styles.checkboxChecked]}>
                  {merchantTermsAccepted && <AppText variant="caption" color="surface">✓</AppText>}
                </View>
                <AppText variant="bodySmall" color="text" style={styles.checkboxLabel}>
                  Saya menyetujui Ketentuan Merchant TorangGo (v{MERCHANT_TERMS_VERSION}).*
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setPrivacyConsentAccepted(!privacyConsentAccepted)}
              >
                <View style={[styles.checkbox, privacyConsentAccepted && styles.checkboxChecked]}>
                  {privacyConsentAccepted && <AppText variant="caption" color="surface">✓</AppText>}
                </View>
                <AppText variant="bodySmall" color="text" style={styles.checkboxLabel}>
                  Saya menyetujui Kebijakan Privasi TorangGo (v{PRIVACY_NOTICE_VERSION}) mengenai pemrosesan data pribadi saya.*
                </AppText>
              </TouchableOpacity>
            </Card>
          </View>
        )}

        {/* Navigation Buttons */}
        <View style={styles.buttonRow}>
          {currentStep > 1 && (
            <Button
              title="Sebelumnya"
              variant="outline"
              onPress={handlePrev}
              style={styles.navBtn}
            />
          )}

          {currentStep < 5 ? (
            <Button
              title="Selanjutnya"
              variant="primary"
              onPress={handleNext}
              style={styles.navBtn}
            />
          ) : (
            <Button
              title={loading ? 'Mengirim...' : 'Kirim Pendaftaran'}
              variant="primary"
              onPress={handleSubmit}
              disabled={
                loading ||
                !dataAccuracyAccepted ||
                !merchantTermsAccepted ||
                !privacyConsentAccepted
              }
              style={styles.navBtn}
            />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl * 2,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  topBarRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  autosaveBadge: {
    minHeight: 20,
    justifyContent: 'center',
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  autosaveText: {
    fontSize: 11,
  },
  logoutBtn: {
    paddingVertical: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.lg,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },
  progressSegmentInactive: {
    backgroundColor: colors.border,
  },
  errorCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.errorLight ?? '#fee2e2',
    borderColor: colors.error,
  },
  formCard: {
    marginBottom: spacing.lg,
  },
  stepTitle: {
    marginBottom: 4,
  },
  stepDesc: {
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    marginBottom: 6,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: colors.primaryLight ?? '#eff6ff',
    borderColor: colors.primary,
  },
  chipInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  errorText: {
    marginTop: 4,
  },
  ktpUploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  ktpSuccessBox: {
    alignItems: 'center',
    gap: 6,
  },
  ktpFilename: {
    fontWeight: '600',
  },
  ktpPlaceholderBox: {
    paddingVertical: spacing.md,
  },
  ktpPlaceholderText: {
    textAlign: 'center',
  },
  ktpActionRow: {
    width: '100%',
  },
  reviewSection: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    gap: 2,
  },
  reviewSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  editLink: {
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ktpPreviewBox: {
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  ktpPreviewImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  consentCard: {
    marginBottom: spacing.lg,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  navBtn: {
    flex: 1,
  },
});
