import { Repository } from 'typeorm';
import { Favorite } from './favorite.entity';
import { Event } from '../events/event.entity';
import { AppDataSource } from '../../config/database.config';
import { redis } from '../../config/redis.config';
import { ConflictError, NotFoundError } from '../../common/errors/AppError';

const FAVORITES_CACHE_TTL = 600;

export class FavoritesService {
  private favoriteRepo: Repository<Favorite>;
  private eventRepo: Repository<Event>;

  constructor() {
    this.favoriteRepo = AppDataSource.getRepository(Favorite);
    this.eventRepo = AppDataSource.getRepository(Event);
  }

  private cacheKey(userId: string): string {
    return `favorites:${userId}`;
  }

  async list(userId: string) {
    const key = this.cacheKey(userId);
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    const favorites = await this.favoriteRepo.find({
      where: { user: { id: userId } },
      relations: ['event', 'event.venue'],
      order: { createdAt: 'DESC' },
    });
    await redis.setex(key, FAVORITES_CACHE_TTL, JSON.stringify(favorites));
    return favorites;
  }

  async add(userId: string, eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundError('Event not found');
    }
    const existing = await this.favoriteRepo.findOne({
      where: { user: { id: userId }, event: { id: eventId } },
    });
    if (existing) {
      throw new ConflictError('Event already favorited');
    }
    const favorite = this.favoriteRepo.create({
      user: { id: userId } as Favorite['user'],
      event,
    });
    await this.favoriteRepo.save(favorite);
    await redis.del(this.cacheKey(userId));
    return favorite;
  }

  async remove(userId: string, eventId: string) {
    const favorite = await this.favoriteRepo.findOne({
      where: { user: { id: userId }, event: { id: eventId } },
    });
    if (!favorite) {
      throw new NotFoundError('Favorite not found');
    }
    await this.favoriteRepo.remove(favorite);
    await redis.del(this.cacheKey(userId));
  }
}