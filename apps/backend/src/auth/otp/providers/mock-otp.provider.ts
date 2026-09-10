import { Injectable } from '@nestjs/common';
import type { OtpProvider, SendOtpContext } from './otp-provider.interface.js';

@Injectable()
export class MockOtpProvider implements OtpProvider {
  public dispatched: Array<{ phone: string; otp: string; context: SendOtpContext }> = [];

  async sendOtp(phone: string, otp: string, context: SendOtpContext): Promise<void> {
    this.dispatched.push({ phone, otp, context });
  }

  getLastOtp(phone: string): string | undefined {
    const records = this.dispatched.filter((d) => d.phone === phone);
    return records[records.length - 1]?.otp;
  }

  clear(): void {
    this.dispatched = [];
  }
}
