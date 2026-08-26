export type OtpClaimResult = 'ok' | 'wrong' | 'expired' | 'max_attempts';

export interface OtpStore {
  save(scope: string, email: string, code: string, ttlSeconds: number): Promise<void>;
  claim(scope: string, email: string, code: string, maxAttempts: number): Promise<OtpClaimResult>;
}