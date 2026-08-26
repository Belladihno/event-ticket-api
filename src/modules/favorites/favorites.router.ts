import { Router } from 'express';
import { FavoritesController } from './favorites.controller';
import { jwtGuard } from '../../common/guards/jwt.guard';

const router = Router();
const controller = new FavoritesController();

router.get('/', jwtGuard, controller.list);
router.post('/:eventId', jwtGuard, controller.add);
router.delete('/:eventId', jwtGuard, controller.remove);

export default router;