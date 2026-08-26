import { Request, Response, NextFunction } from 'express';
import { TicketsService } from './tickets.service';

const ticketsService = new TicketsService();

export class TicketsController {
  async myTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const tickets = await ticketsService.myTickets(req.user!.userId);
      res.json({ status: 'success', data: tickets });
    } catch (err) {
      next(err);
    }
  }

  async myTicketEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await ticketsService.myTicketEvents(req.user!.userId);
      res.json({ status: 'success', data: events });
    } catch (err) {
      next(err);
    }
  }

  async getTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await ticketsService.getTicket(req.user!.userId, req.params.id as string);
      res.json({ status: 'success', data: ticket });
    } catch (err) {
      next(err);
    }
  }

  async validate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ticketsService.validate(req.body.qrPayload, req.user!.userId);
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }
}
