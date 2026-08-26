import { Request, Response, NextFunction } from 'express';
import { FavoritesService } from './favorites.service';

const favoritesService = new FavoritesService();

export class FavoritesController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const favorites = await favoritesService.list(req.user!.userId);
      res.json({ status: 'success', data: favorites });
    } catch (err) {
      next(err);
    }
  }

  async add(req: Request, res: Response, next: NextFunction) {
    try {
      const favorite = await favoritesService.add(req.user!.userId, req.params.eventId as string);
      res.status(201).json({ status: 'success', data: favorite });
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await favoritesService.remove(req.user!.userId, req.params.eventId as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}