import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { AppDataSource } from '../../config/database.config';
import { hashPassword, comparePassword } from '../../common/utils/hash.util';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../common/utils/token.util';
import { ConflictError, AuthError } from '../../common/errors/AppError';

export class AuthService {
  private userRepo: Repository<User>;

  constructor() {
    this.userRepo = AppDataSource.getRepository(User);
  }

  async register(data: { firstName: string; lastName: string; email: string; password: string; role?: string }) {
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
    return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role };
  }

  async login(email: string, password: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new AuthError('Invalid email or password');
    }
    const valid = await comparePassword(password, user.password);
    if (!valid) {
      throw new AuthError('Invalid email or password');
    }
    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      const accessToken = signAccessToken({ userId: payload.userId, role: payload.role });
      return { accessToken };
    } catch {
      throw new AuthError('Invalid or expired refresh token');
    }
  }
}
