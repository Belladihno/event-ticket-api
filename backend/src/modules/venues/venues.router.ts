import { Router } from 'express';
import { VenuesController } from './venues.controller';
import { jwtGuard } from '../../common/guards/jwt.guard';
import { rolesGuard } from '../../common/guards/roles.guard';
import { validate } from '../../common/pipes/zod-validation.pipe';
import { createVenueSchema, updateVenueSchema } from './venues.schema';
import { UserRole } from '../users/user.entity';

const router = Router();
const controller = new VenuesController();

router.get('/', controller.list);
router.post('/', jwtGuard, rolesGuard(UserRole.ORGANIZER), validate(createVenueSchema), controller.create);
router.patch('/:id', jwtGuard, rolesGuard(UserRole.ORGANIZER), validate(updateVenueSchema), controller.update);
router.delete('/:id', jwtGuard, rolesGuard(UserRole.ORGANIZER), controller.remove);

export default router;
