import { Request, Response, NextFunction } from 'express';
import { SeatsService } from './seats.service';

const seatsService = new SeatsService();

export class SeatsController {
  async bulkCreate(req: Request, res: Response, next: NextFunction) {
    try {
      const seats = await seatsService.bulkCreate(req.params.sectionId as string, req.user!.userId, req.body);
      res.status(201).json({ status: 'success', data: seats });
    } catch (err) {
      next(err);
    }
  }

  async listBySection(req: Request, res: Response, next: NextFunction) {
    try {
      const seats = await seatsService.listBySection(req.params.sectionId as string);
      res.json({ status: 'success', data: seats });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const seat = await seatsService.getById(req.params.id as string);
      res.json({ status: 'success', data: seat });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const seat = await seatsService.update(req.params.id as string, req.user!.userId, req.body);
      res.json({ status: 'success', data: seat });
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await seatsService.remove(req.params.id as string, req.user!.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}
