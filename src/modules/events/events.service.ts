import { Repository } from 'typeorm';
import { Event, EventStatus } from './event.entity';
import { User } from '../users/user.entity';
import { Venue } from '../venues/venue.entity';
import { AppDataSource } from '../../config/database.config';
import { redis } from '../../config/redis.config';
import { storageProvider } from '../../providers/storage/storage.provider';
import { config } from '../../config/app.config';
import { NotFoundError, ForbiddenError } from '../../common/errors/AppError';
import { generateId } from '../../common/utils/uuid.util';

const EVENTS_CACHE_KEY = 'events:published';
const EVENTS_CACHE_TTL = 600;

export class EventsService {
  private eventRepo: Repository<Event>;
  private venueRepo: Repository<Venue>;

  constructor() {
    this.eventRepo = AppDataSource.getRepository(Event);
    this.venueRepo = AppDataSource.getRepository(Venue);
  }

  async create(
    organizerId: string,
    data: {
      venueId: string;
      title: string;
      description: string;
      startTime: string;
      endTime: string;
    },
  ) {
    const venue = await this.venueRepo.findOne({ where: { id: data.venueId } });
    if (!venue) {
      throw new NotFoundError('Venue not found');
    }
    const event = this.eventRepo.create({
      organizer: { id: organizerId } as User,
      venue,
      title: data.title,
      description: data.description,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      status: EventStatus.DRAFT,
    });
    await this.eventRepo.save(event);
    await redis.del(EVENTS_CACHE_KEY);
    return event;
  }

  async uploadBanner(
    eventId: string,
    organizerId: string,
    file: Express.Multer.File,
  ) {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });
    if (!event) {
      throw new NotFoundError('Event not found');
    }
    if (event.organizer.id !== organizerId) {
      throw new ForbiddenError('Not your event');
    }
    const path = `event-banners/${eventId}/${generateId()}-${file.originalname}`;
    const publicUrl = await storageProvider.upload(config.supabase.eventBannersBucket, file.buffer, path, file.mimetype);
    event.bannerImageUrl = publicUrl;
    await this.eventRepo.save(event);
    await redis.del(EVENTS_CACHE_KEY);
    return event;
  }

  async publish(eventId: string, organizerId: string) {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });
    if (!event) {
      throw new NotFoundError('Event not found');
    }
    if (event.organizer.id !== organizerId) {
      throw new ForbiddenError('Not your event');
    }
    if (event.status !== EventStatus.DRAFT) {
      throw new ForbiddenError('Only draft events can be published');
    }
    event.status = EventStatus.PUBLISHED;
    await this.eventRepo.save(event);
    await redis.del(EVENTS_CACHE_KEY);
    return event;
  }

  async cancel(eventId: string, organizerId: string) {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });
    if (!event) {
      throw new NotFoundError('Event not found');
    }
    if (event.organizer.id !== organizerId) {
      throw new ForbiddenError('Not your event');
    }
    event.status = EventStatus.CANCELLED;
    await this.eventRepo.save(event);
    await redis.del(EVENTS_CACHE_KEY);
    return event;
  }

  async listPublished() {
    const cached = await redis.get(EVENTS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
    const events = await this.eventRepo.find({
      where: { status: EventStatus.PUBLISHED },
      relations: ['venue'],
      order: { startTime: 'ASC' },
    });
    await redis.setex(
      EVENTS_CACHE_KEY,
      EVENTS_CACHE_TTL,
      JSON.stringify(events),
    );
    return events;
  }

  async getById(id: string) {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['venue', 'organizer'],
    });
    if (!event) {
      throw new NotFoundError('Event not found');
    }
    return event;
  }
}
