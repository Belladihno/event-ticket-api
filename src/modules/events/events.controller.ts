import { Request, Response, NextFunction } from 'express';
import { EventsService } from './events.service';

const eventsService = new EventsService();

export class EventsController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.create(req.user!.userId, req.body);
      res.status(201).json({ status: 'success', data: event });
    } catch (err) {
      next(err);
    }
  }

  async uploadBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.uploadBanner(req.params.id as string, req.user!.userId, req.file!);
      res.json({ status: 'success', data: event });
    } catch (err) {
      next(err);
    }
  }

  async publish(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.publish(req.params.id as string, req.user!.userId);
      res.json({ status: 'success', data: event });
    } catch (err) {
      next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.cancel(req.params.id as string, req.user!.userId);
      res.json({ status: 'success', data: event });
    } catch (err) {
      next(err);
    }
  }

  async listPublished(_req: Request, res: Response, next: NextFunction) {
    try {
      const events = await eventsService.listPublished();
      res.json({ status: 'success', data: events });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.getById(req.params.id as string);
      res.json({ status: 'success', data: event });
    } catch (err) {
      next(err);
    }
  }
}
