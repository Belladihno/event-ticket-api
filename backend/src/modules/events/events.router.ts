import { Router } from 'express';
import multer from 'multer';
import { EventsController } from './events.controller';
import { jwtGuard } from '../../common/guards/jwt.guard';
import { rolesGuard } from '../../common/guards/roles.guard';
import { validate } from '../../common/pipes/zod-validation.pipe';
import { createEventSchema, listEventsQuerySchema } from './events.schema';
import { UserRole } from '../users/user.entity';

const router = Router();
const controller = new EventsController();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', validate(listEventsQuerySchema), controller.listPublished);
router.get('/:id', controller.getById);
router.post('/', jwtGuard, rolesGuard(UserRole.ORGANIZER), validate(createEventSchema), controller.create);
router.post('/:id/banner', jwtGuard, rolesGuard(UserRole.ORGANIZER), upload.single('banner'), controller.uploadBanner);
router.patch('/:id/publish', jwtGuard, rolesGuard(UserRole.ORGANIZER), controller.publish);
router.patch('/:id/cancel', jwtGuard, rolesGuard(UserRole.ORGANIZER), controller.cancel);

export default router;
