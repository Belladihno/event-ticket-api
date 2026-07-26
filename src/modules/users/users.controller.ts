import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';

const usersService = new UsersService();

export class UsersController {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.getProfile(req.user!.userId);
      res.json({ status: 'success', data: user });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.updateProfile(req.user!.userId, req.body);
      res.json({ status: 'success', data: user });
    } catch (err) {
      next(err);
    }
  }

  async getMyEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await usersService.getMyEvents(req.user!.userId);
      res.json({ status: 'success', data: events });
    } catch (err) {
      next(err);
    }
  }
}
