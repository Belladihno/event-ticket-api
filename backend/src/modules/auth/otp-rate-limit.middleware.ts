import { Request, Response, NextFunction } from 'express';
import { isRateLimited } from '../../common/utils/rate-limit.util';
import {
  OTP_RATE_LIMIT_WINDOW_SECONDS,
  OTP_RATE_LIMIT_MAX_PER_IP,
  OTP_RATE_LIMIT_MAX_PER_EMAIL,
} from '../../common/constants/security.constants';

export function otpRateLimit() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
      const ipKey = `security:otp:ip:${ip.toLowerCase()}`;
      if (await isRateLimited(ipKey, OTP_RATE_LIMIT_MAX_PER_IP, OTP_RATE_LIMIT_WINDOW_SECONDS)) {
        res.status(429).json({
          status: 'error',
          message: 'Too many requests, please try again later',
          code: 'RATE_LIMITED',
        });
        return;
      }

      const email = (req.body?.email as string | undefined)?.toLowerCase();
      if (email) {
        const emailKey = `security:otp:email:${email}`;
        if (await isRateLimited(emailKey, OTP_RATE_LIMIT_MAX_PER_EMAIL, OTP_RATE_LIMIT_WINDOW_SECONDS)) {
          res.status(429).json({
            status: 'error',
            message: 'Too many requests, please try again later',
            code: 'RATE_LIMITED',
          });
          return;
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}