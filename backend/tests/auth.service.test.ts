import { AuthService } from '../src/modules/auth/auth.service';
import { ConflictError, AuthError, RateLimitError } from '../src/common/errors/AppError';

jest.mock('../src/config/database.config', () => {
  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ ...x, id: 'u-1' })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  return {
    AppDataSource: {
      getRepository: jest.fn(() => mockRepo),
      transaction: jest.fn(),
    },
  };
});

jest.mock('../src/providers/session/session.store', () => ({
  sessionStore: {
    saveRefresh: jest.fn().mockResolvedValue(undefined),
    isRefreshValid: jest.fn().mockResolvedValue(true),
    deleteRefresh: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../src/providers/otp/otp.store', () => ({
  otpStore: {
    save: jest.fn().mockResolvedValue(undefined),
    claim: jest.fn().mockResolvedValue('ok'),
  },
}));

jest.mock('../src/config/redis.config', () => ({
  redis: {
    ttl: jest.fn().mockResolvedValue(-2),
    set: jest.fn().mockResolvedValue('OK'),
  },
}));

jest.mock('../src/modules/notifications/mail.service', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/common/utils/hash.util', () => ({
  hashPassword: jest.fn(async (p: string) => `hashed:${p}`),
  comparePassword: jest.fn(),
}));

import { AppDataSource } from '../src/config/database.config';
import { sessionStore } from '../src/providers/session/session.store';
import { otpStore } from '../src/providers/otp/otp.store';
import { redis } from '../src/config/redis.config';
import { sendEmail } from '../src/modules/notifications/mail.service';
import { comparePassword } from '../src/common/utils/hash.util';

describe('AuthService', () => {
  let service: AuthService;
  let mockRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = (AppDataSource.getRepository as unknown as jest.Mock)();
    service = new AuthService();
    (service as any).userRepo = mockRepo;
  });

  describe('register', () => {
    it('creates a user and sends OTP', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockImplementation((x: any) => x);
      mockRepo.save.mockResolvedValue({ id: 'u-1', email: 'a@b.com', isVerified: false } as any);

      const res = await service.register({
        firstName: 'Ade',
        lastName: 'Oka',
        email: 'a@b.com',
        password: 'password123',
      } as any);

      expect(mockRepo.save).toHaveBeenCalled();
      expect(otpStore.save).toHaveBeenCalled();
      expect(sendEmail).toHaveBeenCalled();
      expect(res.user).toBeDefined();
    });

    it('throws 409 when email already registered', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'existing' } as any);
      await expect(
        service.register({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'password123' } as any),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('throws ValidationError for short password', async () => {
      await expect(
        service.register({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'short' } as any),
      ).rejects.toThrow('Password must be between');
    });

    it('handles ER_DUP_ENTRY race on save', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const dupErr: any = new Error('dup');
      dupErr.code = 'ER_DUP_ENTRY';
      mockRepo.save.mockRejectedValue(dupErr);
      await expect(
        service.register({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'password123' } as any),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('login', () => {
    it('returns tokens for verified user with correct password', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'u-1', email: 'a@b.com', password: 'hashed', isVerified: true, role: 'customer' } as any);
      (comparePassword as unknown as jest.Mock).mockResolvedValue(true);

      const res = await service.login({ email: 'a@b.com', password: 'password123' } as any);
      expect(res.accessToken).toBeDefined();
      expect(res.refreshToken).toBeDefined();
      expect(sessionStore.saveRefresh).toHaveBeenCalled();
    });

    it('throws 401 for unverified email', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'u-1', password: 'hashed', isVerified: false } as any);
      (comparePassword as unknown as jest.Mock).mockResolvedValue(true);
      await expect(service.login({ email: 'a@b.com', password: 'password123' } as any)).rejects.toBeInstanceOf(AuthError);
    });

    it('throws 401 for wrong password', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'u-1', password: 'hashed', isVerified: true } as any);
      (comparePassword as unknown as jest.Mock).mockResolvedValue(false);
      await expect(service.login({ email: 'a@b.com', password: 'wrong' } as any)).rejects.toBeInstanceOf(AuthError);
    });

    it('throws 401 for unknown email', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.login({ email: 'no@b.com', password: 'x' } as any)).rejects.toBeInstanceOf(AuthError);
    });
  });

  describe('verifyEmail', () => {
    it('claims OTP and marks verified', async () => {
      (otpStore.claim as unknown as jest.Mock).mockResolvedValue('ok');
      mockRepo.findOne.mockResolvedValue({ id: 'u-1', isVerified: false } as any);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const res = await service.verifyEmail({ email: 'a@b.com', code: '123456' } as any);
      expect(res.message).toMatch(/verified successfully/);
    });

    it('returns already verified when update affected 0', async () => {
      (otpStore.claim as unknown as jest.Mock).mockResolvedValue('ok');
      mockRepo.findOne.mockResolvedValue({ id: 'u-1', isVerified: true } as any);
      mockRepo.update.mockResolvedValue({ affected: 0 } as any);

      const res = await service.verifyEmail({ email: 'a@b.com', code: '123456' } as any);
      expect(res.message).toMatch(/already verified/);
    });

    it('throws 401 for invalid OTP claim', async () => {
      (otpStore.claim as unknown as jest.Mock).mockResolvedValue('invalid');
      await expect(service.verifyEmail({ email: 'a@b.com', code: '000000' } as any)).rejects.toBeInstanceOf(AuthError);
    });
  });

  describe('resendVerification / forgotPassword cooldown', () => {
    it('throws 429 when cooldown active', async () => {
      (redis.ttl as unknown as jest.Mock).mockResolvedValue(50);
      mockRepo.findOne.mockResolvedValue({ id: 'u-1', isVerified: false, email: 'a@b.com' } as any);

      await expect(service.resendVerification({ email: 'a@b.com' } as any)).rejects.toBeInstanceOf(RateLimitError);
    });

    it('sends email when no cooldown', async () => {
      (redis.ttl as unknown as jest.Mock).mockResolvedValue(-2);
      mockRepo.findOne.mockResolvedValue({ id: 'u-1', isVerified: false, email: 'a@b.com' } as any);

      const res = await service.resendVerification({ email: 'a@b.com' } as any);
      expect(res.message).toMatch(/Verification code sent/);
      expect(otpStore.save).toHaveBeenCalled();
    });

    it('forgotPassword always returns neutral message', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const res = await service.forgotPassword({ email: 'unknown@b.com' } as any);
      expect(res.message).toMatch(/If an account/);
      expect(otpStore.save).not.toHaveBeenCalled();
    });
  });

  describe('refresh / logout', () => {
    it('refresh returns new access token when session valid', async () => {
      (sessionStore.isRefreshValid as unknown as jest.Mock).mockResolvedValue(true);
      // need a real refresh token signed with test secret
      const { signRefreshToken } = await import('../src/common/utils/token.util');
      const token = signRefreshToken({ userId: 'u-1', role: 'customer' });

      const res = await service.refresh(token);
      expect(res.accessToken).toBeDefined();
    });

    it('refresh throws 401 for revoked token', async () => {
      (sessionStore.isRefreshValid as unknown as jest.Mock).mockResolvedValue(false);
      const { signRefreshToken } = await import('../src/common/utils/token.util');
      const token = signRefreshToken({ userId: 'u-1', role: 'customer' });

      await expect(service.refresh(token)).rejects.toBeInstanceOf(AuthError);
    });

    it('logout deletes refresh hash', async () => {
      await service.logout('u-1');
      expect(sessionStore.deleteRefresh).toHaveBeenCalledWith('u-1');
    });
  });
});
