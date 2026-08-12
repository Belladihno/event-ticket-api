import ms from 'ms';
import { config } from '../../config/app.config';

export const ACCESS_TOKEN_TTL_MS = ms(config.jwt.accessExpiresIn as ms.StringValue) ?? 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = ms(config.jwt.refreshExpiresIn as ms.StringValue) ?? 7 * 24 * 3600 * 1000;
export const REFRESH_TOKEN_TTL_SECONDS = Math.floor(REFRESH_TOKEN_TTL_MS / 1000);