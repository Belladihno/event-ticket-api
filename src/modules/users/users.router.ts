import { Router } from 'express';
import { UsersController } from './users.controller';
import { jwtGuard } from '../../common/guards/jwt.guard';
import { rolesGuard } from '../../common/guards/roles.guard';
import { validate } from '../../common/pipes/zod-validation.pipe';
import { updateProfileSchema } from './users.schema';
import { UserRole } from './user.entity';

const router = Router();
const controller = new UsersController();

router.get('/me', jwtGuard, controller.getProfile);
router.patch('/me', jwtGuard, validate(updateProfileSchema), controller.updateProfile);
router.get('/me/events', jwtGuard, rolesGuard(UserRole.ORGANIZER), controller.getMyEvents);

export default router;
