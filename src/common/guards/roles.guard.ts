import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../modules/users/user.entity';

export function rolesGuard(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role as UserRole)) {
      res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
