import { Request, Response, NextFunction } from 'express';
import { VenuesService } from './venues.service';

const venuesService = new VenuesService();

export class VenuesController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const venue = await venuesService.create(req.body);
      res.status(201).json({ status: 'success', data: venue });
    } catch (err) {
      next(err);
    }
  }

  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const venues = await venuesService.list();
      res.json({ status: 'success', data: venues });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const venue = await venuesService.update(req.params.id as string, req.body);
      res.json({ status: 'success', data: venue });
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await venuesService.remove(req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}
