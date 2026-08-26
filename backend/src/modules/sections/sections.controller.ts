import { Request, Response, NextFunction } from 'express';
import { SectionsService } from './sections.service';

const sectionsService = new SectionsService();

export class SectionsController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const section = await sectionsService.create(req.params.eventId as string, req.user!.userId, req.body);
      res.status(201).json({ status: 'success', data: section });
    } catch (err) {
      next(err);
    }
  }

  async listByEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const sections = await sectionsService.listByEvent(req.params.eventId as string);
      res.json({ status: 'success', data: sections });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const section = await sectionsService.getById(req.params.id as string);
      res.json({ status: 'success', data: section });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const section = await sectionsService.update(req.params.id as string, req.user!.userId, req.body);
      res.json({ status: 'success', data: section });
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await sectionsService.remove(req.params.id as string, req.user!.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}
