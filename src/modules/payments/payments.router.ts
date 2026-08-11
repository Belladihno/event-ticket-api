import { Router } from 'express';
import { PaymentsController } from './payments.controller';
import { jwtGuard } from '../../common/guards/jwt.guard';
import { validate } from '../../common/pipes/zod-validation.pipe';
import { createCheckoutSchema } from './payments.schema';

const router = Router();
const controller = new PaymentsController();

router.post('/checkout', jwtGuard, validate(createCheckoutSchema), controller.createCheckout);

export default router;
