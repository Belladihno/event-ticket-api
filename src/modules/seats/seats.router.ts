import { Router } from 'express';
import { SeatsController } from './seats.controller';
import { jwtGuard } from '../../common/guards/jwt.guard';
import { rolesGuard } from '../../common/guards/roles.guard';
import { validate } from '../../common/pipes/zod-validation.pipe';
import { createSeatsSchema, updateSeatSchema } from './seats.schema';
import { UserRole } from '../users/user.entity';

const router = Router();
const controller = new SeatsController();

router.get('/sections/:sectionId/seats', controller.listBySection);
router.get('/seats/:id', controller.getById);
router.post('/sections/:sectionId/seats', jwtGuard, rolesGuard(UserRole.ORGANIZER), validate(createSeatsSchema), controller.bulkCreate);
router.patch('/seats/:id', jwtGuard, rolesGuard(UserRole.ORGANIZER), validate(updateSeatSchema), controller.update);
router.delete('/seats/:id', jwtGuard, rolesGuard(UserRole.ORGANIZER), controller.remove);

export default router;
