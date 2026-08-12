import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../common/pipes/zod-validation.pipe';
import { jwtGuard } from '../../common/guards/jwt.guard';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema';

const router = Router();
const controller = new AuthController();

router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshSchema), controller.refresh);
router.post('/logout', jwtGuard, controller.logout);
router.post('/verify-email', validate(verifyEmailSchema), controller.verifyEmail);
router.post('/resend-verification', validate(resendVerificationSchema), controller.resendVerification);
router.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);

export default router;
