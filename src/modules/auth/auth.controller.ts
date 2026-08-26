import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { config } from '../../config/app.config';
import { REFRESH_TOKEN_TTL_MS } from '../../common/constants/token.constants';

const REFRESH_COOKIE = 'refreshToken';

const refreshCookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: REFRESH_TOKEN_TTL_MS,
};

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.register(req.body);
      res.status(201).json({ status: 'success', data: user });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
      res.json({
        status: 'success',
        data: {
          accessToken: result.accessToken,
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.[REFRESH_COOKIE];
      if (!token) {
        res.status(401).json({
          status: 'error',
          message: 'No refresh token',
          code: 'AUTH_REQUIRED',
        });
        return;
      }
      const result = await authService.refresh(token);
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
      if (req.user) {
        await authService.logout(req.user.userId);
      }
      res.json({
        status: 'success',
        data: { message: 'Logged out successfully' },
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyEmail(req.body);
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.resendVerification(req.body);
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.forgotPassword(req.body);
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.resetPassword(req.body);
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }
}
