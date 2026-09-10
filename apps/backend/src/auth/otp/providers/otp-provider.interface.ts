export const OTP_PROVIDER_TOKEN = Symbol('OTP_PROVIDER_TOKEN');

export interface SendOtpContext {
  audience: string;
  challengeId: string;
}

export interface OtpProvider {
  sendOtp(phone: string, otp: string, context: SendOtpContext): Promise<void>;
}
