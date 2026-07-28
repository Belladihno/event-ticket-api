import jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { toUserResponse } from '../users/user.mapper';
import { AppDataSource } from '../../config/database.config';
import { config } from '../../config/app.config';
import { hashPassword, comparePassword } from '../../common/utils/hash.util';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../common/utils/token.util';
import { ConflictError, AuthError, NotFoundError } from '../../common/errors/AppError';
import type { RegisterDto, LoginDto, RefreshDto, VerifyEmailDto } from './auth.schema';

export class AuthService {
  private userRepo: Repository<User>;

  constructor() {
    this.userRepo = AppDataSource.getRepository(User);
  }

  async register(data: RegisterDto) {
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
    await this.userRepo.save(user);

    const verificationToken = jwt.sign({ email: user.email }, config.jwt.accessSecret, { expiresIn: '24h' });

    return {
      ...toUserResponse(user),
      verificationToken,
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
      throw new AuthError('Please verify your email before logging in');
    }
    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    return {
      accessToken,
      refreshToken,
      user: toUserResponse(user),
    };
  }

  async refresh(data: RefreshDto) {
    try {
      const payload = verifyRefreshToken(data.refreshToken);
      const accessToken = signAccessToken({ userId: payload.userId, role: payload.role });
      return { accessToken };
    } catch {
      throw new AuthError('Invalid or expired refresh token');
    }
  }

  async verifyEmail(data: VerifyEmailDto) {
    let email: string;
    try {
      const payload = jwt.verify(data.token, config.jwt.accessSecret) as { email: string };
      email = payload.email;
    } catch {
      throw new AuthError('Invalid or expired verification token');
    }
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    if (user.isVerified) {
      return { message: 'Email already verified' };
    }
    user.isVerified = true;
    await this.userRepo.save(user);
    return { message: 'Email verified successfully' };
  }
}
