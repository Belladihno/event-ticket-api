import crypto from 'crypto';
import { redis } from '../../config/redis.config';
import type { SessionStore } from './session-store.interface';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class RedisSessionStore implements SessionStore {
  async saveRefresh(userId: string, refreshToken: string, ttlSeconds: number): Promise<void> {
    await redis.set(`auth:refresh:${userId}`, hashToken(refreshToken), 'EX', ttlSeconds);
  }

  async isRefreshValid(userId: string, refreshToken: string): Promise<boolean> {
    const stored = await redis.get(`auth:refresh:${userId}`);
    return !!stored && stored === hashToken(refreshToken);
  }

  async deleteRefresh(userId: string): Promise<void> {
    await redis.del(`auth:refresh:${userId}`);
  }
}
