import { Router } from 'express';
import { SectionsController } from './sections.controller';
import { jwtGuard } from '../../common/guards/jwt.guard';
import { rolesGuard } from '../../common/guards/roles.guard';
import { validate } from '../../common/pipes/zod-validation.pipe';
import { createSectionSchema, updateSectionSchema } from './sections.schema';
import { UserRole } from '../users/user.entity';

const router = Router();
const controller = new SectionsController();

router.get('/events/:eventId/sections', controller.listByEvent);
router.get('/sections/:id', controller.getById);
router.post('/events/:eventId/sections', jwtGuard, rolesGuard(UserRole.ORGANIZER), validate(createSectionSchema), controller.create);
router.patch('/sections/:id', jwtGuard, rolesGuard(UserRole.ORGANIZER), validate(updateSectionSchema), controller.update);
router.delete('/sections/:id', jwtGuard, rolesGuard(UserRole.ORGANIZER), controller.remove);

export default router;
