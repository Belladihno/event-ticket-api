import { redis } from '../../config/redis.config';
import { OTP_TTL_SECONDS } from '../../common/constants/otp.constants';
import type { OtpClaimResult, OtpStore } from './otp-store.interface';

const CLAIM_SCRIPT = `
local codeKey = KEYS[1]
local attemptsKey = KEYS[2]
local supplied = ARGV[1]
local maxAttempts = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local stored = redis.call('GET', codeKey)
if not stored then
  return 0
end

local attempts = redis.call('INCR', attemptsKey)
if attempts == 1 then
  redis.call('EXPIRE', attemptsKey, ttl)
end

if attempts > maxAttempts then
  redis.call('DEL', codeKey)
  redis.call('DEL', attemptsKey)
  return 3
end

if stored == supplied then
  redis.call('DEL', codeKey)
  redis.call('DEL', attemptsKey)
  return 1
end

return 2
`;

export class RedisOtpStore implements OtpStore {
  private codeKey(scope: string, email: string): string {
    return `auth:otp:${scope}:${email.toLowerCase()}`;
  }

  private attemptsKey(scope: string, email: string): string {
    return `auth:otp:attempts:${scope}:${email.toLowerCase()}`;
  }

  async save(scope: string, email: string, code: string, ttlSeconds: number): Promise<void> {
    await redis.set(this.codeKey(scope, email), code, 'EX', ttlSeconds);
  }

  async claim(scope: string, email: string, code: string, maxAttempts: number): Promise<OtpClaimResult> {
    const result = (await redis.eval(
      CLAIM_SCRIPT,
      2,
      this.codeKey(scope, email),
      this.attemptsKey(scope, email),
      code,
      maxAttempts,
      OTP_TTL_SECONDS,
    )) as number;

    switch (result) {
      case 1:
        return 'ok';
      case 2:
        return 'wrong';
      case 3:
        return 'max_attempts';
      default:
        return 'expired';
    }
  }
}