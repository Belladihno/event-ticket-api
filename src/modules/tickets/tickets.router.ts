import { Router } from 'express';
import { TicketsController } from './tickets.controller';
import { jwtGuard } from '../../common/guards/jwt.guard';
import { rolesGuard } from '../../common/guards/roles.guard';
import { validate } from '../../common/pipes/zod-validation.pipe';
import { validateTicketSchema } from './tickets.schema';
import { UserRole } from '../users/user.entity';

const router = Router();
const controller = new TicketsController();

router.get('/me', jwtGuard, controller.myTickets);
router.get('/:id', jwtGuard, controller.getTicket);
router.post(
  '/validate',
  jwtGuard,
  rolesGuard(UserRole.ORGANIZER),
  validate(validateTicketSchema),
  controller.validate,
);

export default router;
