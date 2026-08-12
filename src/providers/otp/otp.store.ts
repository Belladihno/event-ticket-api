import { RedisOtpStore } from './redis-otp.store';
import type { OtpStore } from './otp-store.interface';

export const otpStore: OtpStore = new RedisOtpStore();