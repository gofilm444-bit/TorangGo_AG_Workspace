import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useCustomerAuth } from './auth-context';
import { colors, spacing, radius, typography } from '@platform/mobile-ui';

export function CustomerAuthScreen() {
  const {
    status,
    phone,
    error,
    cooldownSeconds,
    requestOtp,
    verifyOtp,
    clearError,
  } = useCustomerAuth();

  const [inputPhone, setInputPhone] = useState(phone || '+628');
  const [otpCode, setOtpCode] = useState('');

  const handleRequestOtp = async () => {
    if (!inputPhone || inputPhone.length < 10) return;
    await requestOtp(inputPhone.trim());
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    await verifyOtp(otpCode.trim());
  };

  const isLoading = status === 'loading';
  const isOtpSent = status === 'otp_sent';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>TorangGo</Text>
          <Text style={styles.subtitle}>
            {isOtpSent
              ? `Masukkan 6 digit kode OTP yang dikirim ke ${phone}`
              : 'Masuk atau Daftar dengan nomor handphone'}
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!isOtpSent ? (
          <View style={styles.form}>
            <Text style={styles.label}>Nomor Handphone (Format E.164)</Text>
            <TextInput
              style={styles.input}
              placeholder="+6281234567890"
              placeholderTextColor={colors.textMuted}
              value={inputPhone}
              onChangeText={(val) => {
                clearError();
                setInputPhone(val);
              }}
              keyboardType="phone-pad"
              autoCapitalize="none"
              editable={!isLoading}
            />

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleRequestOtp}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.buttonText}>Kirim Kode OTP</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Kode OTP (6 Digit)</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="123456"
              placeholderTextColor={colors.textMuted}
              value={otpCode}
              onChangeText={(val) => {
                clearError();
                setOtpCode(val.replace(/\D/g, '').slice(0, 6));
              }}
              keyboardType="number-pad"
              maxLength={6}
              editable={!isLoading}
            />

            <TouchableOpacity
              style={[
                styles.button,
                (isLoading || otpCode.length !== 6) && styles.buttonDisabled,
              ]}
              onPress={handleVerifyOtp}
              disabled={isLoading || otpCode.length !== 6}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.buttonText}>Verifikasi OTP</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              {cooldownSeconds > 0 ? (
                <Text style={styles.cooldownText}>
                  Kirim ulang kode dalam {cooldownSeconds}s
                </Text>
              ) : (
                <TouchableOpacity onPress={() => requestOtp(phone)}>
                  <Text style={styles.resendLink}>Kirim Ulang Kode OTP</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: typography.h1.fontSize,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: colors.errorLight,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.bodySmall.fontSize,
    textAlign: 'center',
  },
  form: {
    gap: spacing.md,
  },
  label: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  otpInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: typography.h1.fontSize,
    fontWeight: '700',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.textInverse,
    fontSize: typography.button.fontSize,
    fontWeight: '700',
  },
  footerRow: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  cooldownText: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  resendLink: {
    fontSize: typography.caption.fontSize,
    color: colors.primary,
    fontWeight: '600',
  },
});
