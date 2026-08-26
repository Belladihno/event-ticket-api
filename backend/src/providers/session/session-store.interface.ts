export interface SessionStore {
  saveRefresh(userId: string, refreshToken: string, ttlSeconds: number): Promise<void>;
  isRefreshValid(userId: string, refreshToken: string): Promise<boolean>;
  deleteRefresh(userId: string): Promise<void>;
}
