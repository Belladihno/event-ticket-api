import { Request, Response, NextFunction } from 'express';
import { ReservationsService } from './reservations.service';

const reservationsService = new ReservationsService();

export class ReservationsController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const reservations = await reservationsService.create(req.user!.userId, req.body);
      res.status(201).json({ status: 'success', data: reservations });
    } catch (err) {
      next(err);
    }
  }

  async myReservations(req: Request, res: Response, next: NextFunction) {
    try {
      const reservations = await reservationsService.myReservations(req.user!.userId);
      res.json({ status: 'success', data: reservations });
    } catch (err) {
      next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await reservationsService.cancel(req.user!.userId, req.params.id as string);
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }
}
