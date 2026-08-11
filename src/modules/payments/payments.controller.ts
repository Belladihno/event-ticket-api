import { Request, Response, NextFunction } from 'express';
import { PaymentsService } from './payments.service';

const paymentsService = new PaymentsService();

export class PaymentsController {
  async createCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paymentsService.createCheckoutSession(req.user!.userId, req.body);
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }
}
