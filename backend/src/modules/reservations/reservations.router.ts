import { Router } from 'express';
import { ReservationsController } from './reservations.controller';
import { jwtGuard } from '../../common/guards/jwt.guard';
import { validate } from '../../common/pipes/zod-validation.pipe';
import { createReservationSchema } from './reservations.schema';

const router = Router();
const controller = new ReservationsController();

router.post('/', jwtGuard, validate(createReservationSchema), controller.create);
router.get('/me', jwtGuard, controller.myReservations);
router.post('/:id/cancel', jwtGuard, controller.cancel);

export default router;
