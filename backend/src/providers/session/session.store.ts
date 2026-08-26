import { RedisSessionStore } from './redis-session.store';
import type { SessionStore } from './session-store.interface';

export const sessionStore: SessionStore = new RedisSessionStore();
