import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token.util';

export function jwtGuard(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 'error',
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({
      status: 'error',
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch {
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token',
      code: 'AUTH_REQUIRED',
    });
  }
}
