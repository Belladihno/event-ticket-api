import { isRateLimited } from '../src/common/utils/rate-limit.util';
import { redis } from '../src/config/redis.config';

// Mock the shared Redis client before importing anything that touches it.
jest.mock('../src/config/redis.config', () => ({
  redis: { eval: jest.fn() },
}));

const evalMock = redis.eval as unknown as jest.Mock;

describe('rate-limit.util.isRateLimited', () => {
  beforeEach(() => {
    evalMock.mockReset();
  });

  it('returns false (allowed) when the Lua script returns 1', async () => {
    evalMock.mockResolvedValue(1);

    await expect(isRateLimited('security:otp:ip:1.2.3.4', 5, 900)).resolves.toBe(false);
    expect(evalMock).toHaveBeenCalledWith(expect.any(String), 1, 'security:otp:ip:1.2.3.4', 5, 900);
  });

  it('returns true (limited) when the Lua script returns 0', async () => {
    evalMock.mockResolvedValue(0);

    await expect(isRateLimited('security:otp:email:a@b.com', 3, 900)).resolves.toBe(true);
  });

  it('treats unexpected script results as rate limited (fail closed)', async () => {
    evalMock.mockResolvedValue(null);

    await expect(isRateLimited('k', 5, 60)).resolves.toBe(true);
  });

  it('propagates Redis errors to the caller', async () => {
    evalMock.mockRejectedValue(new Error('connection refused'));

    await expect(isRateLimited('k', 5, 60)).rejects.toThrow('connection refused');
  });
});
