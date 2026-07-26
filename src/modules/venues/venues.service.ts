import { Repository } from 'typeorm';
import { Venue } from './venue.entity';
import { AppDataSource } from '../../config/database.config';
import { redis } from '../../config/redis.config';
import { NotFoundError } from '../../common/errors/AppError';

const VENUES_CACHE_KEY = 'venues:list';
const VENUES_CACHE_TTL = 600;

export class VenuesService {
  private venueRepo: Repository<Venue>;

  constructor() {
    this.venueRepo = AppDataSource.getRepository(Venue);
  }

  async create(data: { name: string; address: string; city: string; capacity: number }) {
    const venue = this.venueRepo.create(data);
    await this.venueRepo.save(venue);
    await redis.del(VENUES_CACHE_KEY);
    return venue;
  }

  async list() {
    const cached = await redis.get(VENUES_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
    const venues = await this.venueRepo.find({ order: { createdAt: 'DESC' } });
    await redis.setex(VENUES_CACHE_KEY, VENUES_CACHE_TTL, JSON.stringify(venues));
    return venues;
  }

  async update(id: string, data: { name?: string; address?: string; city?: string; capacity?: number }) {
    const venue = await this.venueRepo.findOne({ where: { id } });
    if (!venue) {
      throw new NotFoundError('Venue not found');
    }
    if (data.name !== undefined) venue.name = data.name;
    if (data.address !== undefined) venue.address = data.address;
    if (data.city !== undefined) venue.city = data.city;
    if (data.capacity !== undefined) venue.capacity = data.capacity;
    await this.venueRepo.save(venue);
    await redis.del(VENUES_CACHE_KEY);
    return venue;
  }

  async remove(id: string) {
    const venue = await this.venueRepo.findOne({ where: { id } });
    if (!venue) {
      throw new NotFoundError('Venue not found');
    }
    await this.venueRepo.remove(venue);
    await redis.del(VENUES_CACHE_KEY);
  }
}
