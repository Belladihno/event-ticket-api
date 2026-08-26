import { Repository } from 'typeorm';
import { REFRESH_TOKEN_TTL_SECONDS } from '../../common/constants/token.constants';
import {
  OTP_TTL_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_SCOPE_VERIFY,
  OTP_SCOPE_RESET,
} from '../../common/constants/otp.constants';
import { User } from '../users/user.entity';
import { toUserResponse } from '../users/user.mapper';
import { AppDataSource } from '../../config/database.config';
import { redis } from '../../config/redis.config';
import { sessionStore } from '../../providers/session/session.store';
import { otpStore } from '../../providers/otp/otp.store';
import { generateOtpCode } from '../../common/utils/code.util';
import { hashPassword, comparePassword } from '../../common/utils/hash.util';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../common/utils/token.util';
import { sendEmail } from '../notifications/mail.service';
import { verificationEmailHtml, passwordResetHtml } from '../notifications/notification.email';
import { ConflictError, AuthError, NotFoundError, ValidationError, RateLimitError } from '../../common/errors/AppError';
import { OTP_RESEND_COOLDOWN_SECONDS } from '../../common/constants/security.constants';
import type {
  RegisterDto,
  LoginDto,
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './auth.schema';

export class AuthService {
  private userRepo: Repository<User>;
  
  constructor() {
    this.userRepo = AppDataSource.getRepository(User);
  }

  async register(data: RegisterDto) {
    if (data.password.length < 8 || data.password.length > 128) {
      throw new ValidationError('Password must be between 8 and 128 characters');
    }
    const existing = await this.userRepo.findOne({ where: { email: data.email } });
    if (existing) {
      throw new ConflictError('Email already registered');
    }
    const hashedPassword = await hashPassword(data.password);
    const user = this.userRepo.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: hashedPassword,
      role: (data.role ?? 'customer') as User['role'],
    });
    try {
      await this.userRepo.save(user);
    } catch (err) {
      if (err instanceof Error && (err as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ConflictError('Email already registered');
      }
      throw err;
    }

    const code = generateOtpCode();
    await otpStore.save(OTP_SCOPE_VERIFY, user.email, code, OTP_TTL_SECONDS);
    await sendEmail(user.email, 'Verify your email address', verificationEmailHtml({ code }));

    return {
      message: 'Registration successful. Please verify your email to continue.',
      user: toUserResponse(user),
    };
  }

  async login(data: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: data.email } });
    if (!user) {
      throw new AuthError('Invalid email or password');
    }
    const valid = await comparePassword(data.password, user.password);
    if (!valid) {
      throw new AuthError('Invalid email or password');
    }
    if (!user.isVerified) {
      throw new AuthError('Email not verified. Please verify your email before logging in');
    }

    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    await sessionStore.saveRefresh(user.id, refreshToken, REFRESH_TOKEN_TTL_SECONDS);

    return {
      accessToken,
      refreshToken,
      user: toUserResponse(user),
    };
  }

  async refresh(refreshToken?: string) {
    try {
      if (!refreshToken) {
        throw new Error('Missing refresh token');
      }
      const payload = verifyRefreshToken(refreshToken);
      const valid = await sessionStore.isRefreshValid(payload.userId, refreshToken);
      if (!valid) {
        throw new Error('Refresh token revoked');
      }
      const accessToken = signAccessToken({ userId: payload.userId, role: payload.role });
      return { accessToken };
    } catch {
      throw new AuthError('Invalid or expired refresh token');
    }
  }

  async logout(userId: string) {
    await sessionStore.deleteRefresh(userId);
    return { message: 'Logged out successfully' };
  }

  async verifyEmail(data: VerifyEmailDto) {
    const result = await otpStore.claim(OTP_SCOPE_VERIFY, data.email, data.code, OTP_MAX_ATTEMPTS);
    if (result !== 'ok') {
      throw new AuthError('Invalid or expired verification code');
    }
    const user = await this.userRepo.findOne({ where: { email: data.email } });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const updated = await this.userRepo.update(
      { id: user.id, isVerified: false },
      { isVerified: true },
    );
    if (updated.affected === 0) {
      return { message: 'Email already verified' };
    }
    return { message: 'Email verified successfully' };
  }

  async resendVerification(data: ResendVerificationDto) {
    const user = await this.userRepo.findOne({ where: { email: data.email } });
    if (!user) {
      return { message: 'If an account with that email exists, a verification code has been sent' };
    }
    if (user.isVerified) {
      return { message: 'Email already verified' };
    }
    await this.assertResendCooldown(OTP_SCOPE_VERIFY, user.email);
    const code = generateOtpCode();
    await otpStore.save(OTP_SCOPE_VERIFY, user.email, code, OTP_TTL_SECONDS);
    await sendEmail(user.email, 'Verify your email address', verificationEmailHtml({ code }));
    await redis.set(
      this.cooldownKey(OTP_SCOPE_VERIFY, user.email),
      '1',
      'EX',
      OTP_RESEND_COOLDOWN_SECONDS,
    );
    return { message: 'Verification code sent' };
  }

  async forgotPassword(data: ForgotPasswordDto) {
    const user = await this.userRepo.findOne({ where: { email: data.email } });
    if (user) {
      await this.assertResendCooldown(OTP_SCOPE_RESET, user.email);
      const code = generateOtpCode();
      await otpStore.save(OTP_SCOPE_RESET, user.email, code, OTP_TTL_SECONDS);
      await sendEmail(user.email, 'Reset your password', passwordResetHtml({ code }));
      await redis.set(
        this.cooldownKey(OTP_SCOPE_RESET, user.email),
        '1',
        'EX',
        OTP_RESEND_COOLDOWN_SECONDS,
      );
    }
    return { message: 'If an account with that email exists, a password reset code has been sent' };
  }

  async resetPassword(data: ResetPasswordDto) {
    const claim = await otpStore.claim(OTP_SCOPE_RESET, data.email, data.code, OTP_MAX_ATTEMPTS);
    if (claim !== 'ok') {
      throw new AuthError('Invalid or expired reset code');
    }
    const user = await this.userRepo.findOne({ where: { email: data.email } });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    user.password = await hashPassword(data.newPassword);
    await this.userRepo.save(user);
    return { message: 'Password reset successfully' };
  }

  private cooldownKey(scope: string, email: string): string {
    return `auth:otp:cooldown:${scope}:${email.toLowerCase()}`;
  }

  private async assertResendCooldown(scope: string, email: string): Promise<void> {
    const remaining = await redis.ttl(this.cooldownKey(scope, email));
    if (remaining > 0) {
      throw new RateLimitError('Please wait before requesting another code');
    }
  }
}
