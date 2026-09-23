import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import {
  Screen,
  AppText,
  Button,
  Card,
  StatusBadge,
  LoadingState,
  ErrorState,
  spacing,
  colors,
} from '@platform/mobile-ui';
import { useOnboarding } from './onboarding-context';
import { MerchantOnboardingScreen } from './onboarding-screen';
import { useMerchantAuth } from '../auth/auth-context';

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { statusData, loading, error, refreshStatus, startOnboarding, repairOnboarding } = useOnboarding();
  const { logout } = useMerchantAuth();

  if (loading && !statusData) {
    return (
      <Screen padding="md">
        <View style={styles.centerContainer}>
          <LoadingState message="Memeriksa status pendaftaran mitra..." />
        </View>
      </Screen>
    );
  }

  if (error && !statusData) {
    return (
      <Screen padding="md">
        <View style={styles.centerContainer}>
          <ErrorState
            title="Gagal Memuat Status"
            message={error}
            onRetry={refreshStatus}
            retryLabel="Coba Lagi"
          />
          <TouchableOpacity onPress={() => logout()} style={{ marginTop: spacing.lg }}>
            <AppText variant="bodySmall" color="error">
              Keluar Akun
            </AppText>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  const state = statusData?.state ?? 'NOT_STARTED';
  // 1. APPROVED: Explicit Phase 2B Approved View
  if (state === 'APPROVED') {
    return (
      <Screen padding="md">
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <View>
              <AppText variant="caption" color="textSecondary">
                Status Pendaftaran
              </AppText>
              <AppText variant="h2" color="text">
                Pendaftaran Merchant Disetujui
              </AppText>
            </View>
            <TouchableOpacity onPress={() => logout()}>
              <AppText variant="caption" color="error">
                Keluar
              </AppText>
            </TouchableOpacity>
          </View>

          <Card variant="subtle" style={styles.approvedCard}>
            <StatusBadge label="DISETUJUI (APPROVED)" variant="success" />
            <AppText variant="h3" color="text" style={{ marginTop: spacing.md, marginBottom: 4 }}>
              Identitas Merchant Anda telah diverifikasi.
            </AppText>
            <AppText variant="bodySmall" color="textSecondary" style={{ lineHeight: 20 }}>
              Selamat! Profil merchant Anda telah berhasil diverifikasi oleh tim TorangGo. Tahap selanjutnya adalah pengaturan profil usaha dan outlet (Fase 2C).
            </AppText>

            {statusData?.currentSubmission && (
              <View style={styles.submissionSnapshot}>
                <AppText variant="label" color="textSecondary">
                  DETAIL MERCHANT TERVERIFIKASI
                </AppText>
                <AppText variant="bodySmall" color="text">
                  Usaha: {statusData.currentSubmission.proposedBusinessName}
                </AppText>
                <AppText variant="bodySmall" color="text">
                  Pemilik: {statusData.currentSubmission.fullName}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  Disetujui: {statusData.currentSubmission.submittedAt ? new Date(statusData.currentSubmission.submittedAt).toLocaleDateString('id-ID') : '—'}
                </AppText>
              </View>
            )}
          </Card>

          <View style={styles.ctaRow}>
            <Button
              title="Lanjutkan Setup Usaha"
              variant="primary"
              onPress={() => {
                Alert.alert(
                  'Setup Usaha (Fase Selanjutnya)',
                  'Fase 2C (Setup Usaha & Outlet) akan segera dibuka untuk melengkapi profil operasional toko Anda.',
                );
              }}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  // 2. DRAFT: Show 5-step form wizard
  if (state === 'DRAFT') {
    return <MerchantOnboardingScreen />;
  }

  // 3. NOT_STARTED: Welcome & Start Screen
  if (state === 'NOT_STARTED') {
    return (
      <Screen padding="md">
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <View>
              <AppText variant="caption" color="textSecondary">
                TorangGo Mitra
              </AppText>
              <AppText variant="h2" color="text">
                Daftar Sebagai Mitra Usaha
              </AppText>
            </View>
            <TouchableOpacity onPress={() => logout()}>
              <AppText variant="caption" color="error">
                Keluar
              </AppText>
            </TouchableOpacity>
          </View>

          <Card variant="subtle" style={styles.heroCard}>
            <AppText variant="h3" color="primary" style={{ marginBottom: 6 }}>
              Mulai Langkah Usaha Anda
            </AppText>
            <AppText variant="bodySmall" color="textSecondary">
              Bergabunglah dengan jaringan Mitra TorangGo untuk menjangkau pelanggan lebih luas.
              Proses pendaftaran cepat dan terstruktur dalam 5 langkah sederhana:
            </AppText>

            <View style={styles.stepsList}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><AppText variant="caption" color="surface">1</AppText></View>
                <AppText variant="bodySmall" color="text">Data Diri Pemilik Usaha</AppText>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><AppText variant="caption" color="surface">2</AppText></View>
                <AppText variant="bodySmall" color="text">Informasi Calon Usaha</AppText>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><AppText variant="caption" color="surface">3</AppText></View>
                <AppText variant="bodySmall" color="text">Alamat Korespondensi</AppText>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><AppText variant="caption" color="surface">4</AppText></View>
                <AppText variant="bodySmall" color="text">Dokumen Identitas (KTP)</AppText>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><AppText variant="caption" color="surface">5</AppText></View>
                <AppText variant="bodySmall" color="text">Persetujuan & Pengiriman</AppText>
              </View>
            </View>
          </Card>

          <View style={styles.ctaRow}>
            <Button
              title={loading ? 'Memulai...' : 'Mulai Pendaftaran'}
              variant="primary"
              onPress={startOnboarding}
              disabled={loading}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  // 4. PENDING: Under Review Informational View
  if (state === 'PENDING') {
    return (
      <Screen padding="md">
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <View>
              <AppText variant="caption" color="textSecondary">
                Status Pendaftaran
              </AppText>
              <AppText variant="h2" color="text">
                Sedang Ditinjau
              </AppText>
            </View>
            <TouchableOpacity onPress={() => logout()}>
              <AppText variant="caption" color="error">
                Keluar
              </AppText>
            </TouchableOpacity>
          </View>

          <Card variant="subtle" style={styles.pendingCard}>
            <StatusBadge label="SEDANG DITINJAU (PENDING)" variant="warning" />
            <AppText variant="h3" color="text" style={{ marginTop: spacing.md, marginBottom: 4 }}>
              Pendaftaran Anda Telah Diterima
            </AppText>
            <AppText variant="bodySmall" color="textSecondary" style={{ lineHeight: 20 }}>
              Tim administratif TorangGo sedang meninjau dokumen identitas dan kesesuaian data calon
              usaha Anda. Mohon menunggu proses verifikasi selesai.
            </AppText>

            {statusData?.currentSubmission && (
              <View style={styles.submissionSnapshot}>
                <AppText variant="label" color="textSecondary">
                  RINGKASAN PENGAJUAN
                </AppText>
                <AppText variant="bodySmall" color="text">
                  Usaha: {statusData.currentSubmission.proposedBusinessName}
                </AppText>
                <AppText variant="bodySmall" color="text">
                  Pemilik: {statusData.currentSubmission.fullName}
                </AppText>
                <AppText variant="bodySmall" color="text">
                  Revisi Ke: #{statusData.currentSubmission.revisionNumber}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  Waktu Pengiriman: {new Date(statusData.currentSubmission.submittedAt).toLocaleString('id-ID')}
                </AppText>
              </View>
            )}

            <View style={styles.lockNotice}>
              <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
                🔒 Data formulir tidak dapat diubah selama proses peninjauan berlangsung.
              </AppText>
            </View>
          </Card>

          <View style={styles.ctaRow}>
            <Button
              title="Segarkan Status"
              variant="outline"
              onPress={refreshStatus}
              disabled={loading}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  // 5. REJECTED: Needs Repair View
  if (state === 'REJECTED') {
    const reason =
      statusData?.rejectionReason ??
      statusData?.currentSubmission?.rejectionReason ??
      'Silakan periksa kembali kelengkapan dan kejelasan data dokumen identitas Anda.';

    return (
      <Screen padding="md">
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <View>
              <AppText variant="caption" color="textSecondary">
                Status Pendaftaran
              </AppText>
              <AppText variant="h2" color="text">
                Perlu Perbaikan
              </AppText>
            </View>
            <TouchableOpacity onPress={() => logout()}>
              <AppText variant="caption" color="error">
                Keluar
              </AppText>
            </TouchableOpacity>
          </View>

          <Card variant="outlined" style={styles.rejectedCard}>
            <StatusBadge label="PERLU PERBAIKAN (REJECTED)" variant="error" />
            <AppText variant="h3" color="text" style={{ marginTop: spacing.md, marginBottom: 4 }}>
              Pendaftaran Memerlukan Koreksi
            </AppText>
            <AppText variant="bodySmall" color="textSecondary" style={{ lineHeight: 20 }}>
              Pengajuan Anda belum dapat disetujui. Tim verifikasi telah menyertakan catatan perbaikan di bawah ini.
            </AppText>

            {statusData?.currentSubmission && (
              <View style={styles.metadataRow}>
                <AppText variant="caption" color="textSecondary">
                  Revisi Pengajuan: #{statusData.currentSubmission.revisionNumber}
                </AppText>
                {statusData.rejectionDate && (
                  <AppText variant="caption" color="textSecondary">
                    Waktu Penolakan: {new Date(statusData.rejectionDate).toLocaleString('id-ID')}
                  </AppText>
                )}
              </View>
            )}

            <View style={styles.reasonBox}>
              <AppText variant="label" color="error">
                ALASAN DARI TIM VERIFIKASI:
              </AppText>
              <AppText variant="bodySmall" color="text" style={styles.reasonText}>
                &ldquo;{reason}&rdquo;
              </AppText>
            </View>

            <AppText variant="bodySmall" color="textSecondary" style={{ marginTop: spacing.sm }}>
              Klik tombol di bawah untuk membuka draft perbaikan dan memperbarui data atau dokumen Anda.
            </AppText>
          </Card>

          <View style={styles.ctaRow}>
            <Button
              title={loading ? 'Mempersiapkan...' : 'Perbaiki Pengajuan'}
              variant="primary"
              onPress={repairOnboarding}
              disabled={loading}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  // 6. SUSPENDED: Suspension View
  if (state === 'SUSPENDED') {
    return (
      <Screen padding="md">
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <View>
              <AppText variant="caption" color="textSecondary">
                Status Akun Mitra
              </AppText>
              <AppText variant="h2" color="text">
                Ditangguhkan
              </AppText>
            </View>
            <TouchableOpacity onPress={() => logout()}>
              <AppText variant="caption" color="error">
                Keluar
              </AppText>
            </TouchableOpacity>
          </View>

          <Card variant="outlined" style={styles.suspendedCard}>
            <StatusBadge label="AKUN DITANGGUHKAN (SUSPENDED)" variant="neutral" />
            <AppText variant="h3" color="text" style={{ marginTop: spacing.md, marginBottom: 4 }}>
              Akses Operasional Dinonaktifkan
            </AppText>
            <AppText variant="bodySmall" color="textSecondary" style={{ lineHeight: 20 }}>
              Akun profil mitra Anda saat ini sedang ditangguhkan oleh tim operasional TorangGo.
              Silakan hubungi layanan bantuan atau operasional kantor cabang terdekat untuk prosedur pengaktifan kembali.
            </AppText>

            {statusData?.suspensionDate && (
              <AppText variant="caption" color="textSecondary" style={{ marginTop: spacing.sm }}>
                Waktu Penangguhan: {new Date(statusData.suspensionDate).toLocaleString('id-ID')}
              </AppText>
            )}

            {statusData?.suspensionReason && (
              <View style={styles.reasonBox}>
                <AppText variant="label" color="error">
                  ALASAN PENANGGUHAN:
                </AppText>
                <AppText variant="bodySmall" color="text" style={styles.reasonText}>
                  &ldquo;{statusData.suspensionReason}&rdquo;
                </AppText>
              </View>
            )}
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  return <>{children}</>;
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
  heroCard: {
    marginBottom: spacing.lg,
  },
  stepsList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaRow: {
    marginTop: spacing.md,
  },
  pendingCard: {
    marginBottom: spacing.lg,
  },
  submissionSnapshot: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 6,
    backgroundColor: colors.surface,
    gap: 4,
  },
  lockNotice: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 6,
  },
  rejectedCard: {
    marginBottom: spacing.lg,
    borderColor: colors.error,
  },
  reasonBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.errorLight ?? '#fee2e2',
    borderRadius: 6,
    gap: 4,
  },
  reasonText: {
    fontStyle: 'italic',
    fontWeight: '500',
  },
  suspendedCard: {
    marginBottom: spacing.lg,
    borderColor: colors.border,
  },
  approvedCard: {
    marginBottom: spacing.lg,
  },
  metadataRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.md,
  },
});
