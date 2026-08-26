import { redis } from '../../config/redis.config';

const INCR_WINDOW_SCRIPT = `
local current = redis.call('GET', KEYS[1])
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local count
if not current then
  count = 1
  redis.call('SET', KEYS[1], count, 'EX', window)
else
  count = redis.call('INCR', KEYS[1])
  redis.call('EXPIRE', KEYS[1], window)
end
if count > limit then
  return 0
end
return 1
`;

export async function isRateLimited(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const result = (await redis.eval(INCR_WINDOW_SCRIPT, 1, key, limit, windowSeconds)) as number;
  return result !== 1;
}