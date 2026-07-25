import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../common/pipes/zod-validation.pipe';
import { registerSchema, loginSchema, refreshSchema, verifyEmailSchema } from './auth.schema';

const router = Router();
const controller = new AuthController();

router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshSchema), controller.refresh);
router.post('/verify-email', validate(verifyEmailSchema), controller.verifyEmail);

export default router;
