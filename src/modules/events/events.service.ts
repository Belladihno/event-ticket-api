import { Repository } from 'typeorm';
import { Event, EventStatus } from './event.entity';
import { User } from '../users/user.entity';
import { toUserResponse } from '../users/user.mapper';
import { Venue } from '../venues/venue.entity';
import { AppDataSource } from '../../config/database.config';
import { redis } from '../../config/redis.config';
import { storageProvider } from '../../providers/storage/storage.provider';
import { config } from '../../config/app.config';
import { NotFoundError, ForbiddenError } from '../../common/errors/AppError';
import { generateId } from '../../common/utils/uuid.util';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateEventDto, ListEventsQuery } from './events.schema';

const EVENTS_VERSION_KEY = 'events:cache:version';
const EVENTS_CACHE_TTL = 600;

export class EventsService {
  private eventRepo: Repository<Event>;
  private venueRepo: Repository<Venue>;
  private notificationsService: NotificationsService;

  constructor() {
    this.eventRepo = AppDataSource.getRepository(Event);
    this.venueRepo = AppDataSource.getRepository(Venue);
    this.notificationsService = new NotificationsService();
  }

  async create(
    organizerId: string,
    data: CreateEventDto,
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
    await this.bumpEventsCache();
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
    await this.bumpEventsCache();
    event.organizer = toUserResponse(event.organizer) as User;
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
    await this.bumpEventsCache();
    try {
      await this.notificationsService.scheduleEventReminder(event.id, event.startTime);
    } catch (err) {
      console.error('[events] Failed to schedule event reminder:', err);
    }
    event.organizer = toUserResponse(event.organizer) as User;
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
    await this.bumpEventsCache();
    event.organizer = toUserResponse(event.organizer) as User;
    return event;
  }

  async listPublished(query: ListEventsQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const cacheKey = await this.buildListCacheKey(query);
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const qb = this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.venue', 'venue')
      .where('event.status = :status', { status: EventStatus.PUBLISHED });

    if (query.q) {
      qb.andWhere("MATCH(event.`title`, event.`description`) AGAINST (:q)", { q: query.q });
    }
    if (query.venueId) {
      qb.andWhere('event.venue_id = :venueId', { venueId: query.venueId });
    }
    if (query.city) {
      qb.andWhere('venue.city = :city', { city: query.city });
    }
    if (query.startDate) {
      qb.andWhere('event.startTime >= :startDate', { startDate: new Date(query.startDate) });
    }
    if (query.endDate) {
      qb.andWhere('event.startTime <= :endDate', { endDate: new Date(query.endDate) });
    }

    const [items, total] = await qb
      .orderBy('event.startTime', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const result = {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
    await redis.setex(cacheKey, EVENTS_CACHE_TTL, JSON.stringify(result));
    return result;
  }

  async getById(id: string) {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['venue', 'organizer'],
    });
    if (!event) {
      throw new NotFoundError('Event not found');
    }
    event.organizer = toUserResponse(event.organizer) as User;
    return event;
  }

  private async bumpEventsCache(): Promise<void> {
    await redis.incr(EVENTS_VERSION_KEY);
  }

  private async buildListCacheKey(query: ListEventsQuery): Promise<string> {
    const version = await redis.get(EVENTS_VERSION_KEY);
    const currentVersion = version ?? '1';
    const filters = JSON.stringify({
      q: query.q,
      startDate: query.startDate,
      endDate: query.endDate,
      city: query.city,
      venueId: query.venueId,
    });
    const hash = Buffer.from(filters).toString('base64url');
    return `events:list:v${currentVersion}:${hash}:${query.page ?? 1}:${query.limit ?? 20}`;
  }
}
