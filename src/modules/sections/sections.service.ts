import { Repository } from 'typeorm';
import { Section } from './section.entity';
import { Event } from '../events/event.entity';
import { AppDataSource } from '../../config/database.config';
import { redis } from '../../config/redis.config';
import { NotFoundError, ForbiddenError } from '../../common/errors/AppError';
import type { CreateSectionDto, UpdateSectionDto } from './sections.schema';

export class SectionsService {
  private sectionRepo: Repository<Section>;
  private eventRepo: Repository<Event>;

  constructor() {
    this.sectionRepo = AppDataSource.getRepository(Section);
    this.eventRepo = AppDataSource.getRepository(Event);
  }
  
  async create(eventId: string, organizerId: string, data: CreateSectionDto) {
    const event = await this.eventRepo.findOne({ where: { id: eventId }, relations: ['organizer'] });
    if (!event) {
      throw new NotFoundError('Event not found');
    }
    if (event.organizer.id !== organizerId) {
      throw new ForbiddenError('Not your event');
    }
    const section = this.sectionRepo.create({ event, name: data.name, price: data.price, totalSeats: data.totalSeats });
    await this.sectionRepo.save(section);
    await redis.del(`sections:${eventId}`);
    return section;
  }

  async listByEvent(eventId: string) {
    const cacheKey = `sections:${eventId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    const sections = await this.sectionRepo.find({
      where: { event: { id: eventId } },
      order: { name: 'ASC' },
    });
    await redis.setex(cacheKey, 600, JSON.stringify(sections));
    return sections;
  }

  async getById(id: string) {
    const section = await this.sectionRepo.findOne({ where: { id }, relations: ['event'] });
    if (!section) {
      throw new NotFoundError('Section not found');
    }
    return section;
  }

  async update(id: string, organizerId: string, data: UpdateSectionDto) {
    const section = await this.sectionRepo.findOne({ where: { id }, relations: ['event', 'event.organizer'] });
    if (!section) {
      throw new NotFoundError('Section not found');
    }
    if (section.event.organizer.id !== organizerId) {
      throw new ForbiddenError('Not your event');
    }
    if (data.name !== undefined) section.name = data.name;
    if (data.price !== undefined) section.price = data.price;
    if (data.totalSeats !== undefined) section.totalSeats = data.totalSeats;
    await this.sectionRepo.save(section);
    await redis.del(`sections:${section.event.id}`);
    return section;
  }

  async remove(id: string, organizerId: string) {
    const section = await this.sectionRepo.findOne({ where: { id }, relations: ['event', 'event.organizer'] });
    if (!section) {
      throw new NotFoundError('Section not found');
    }
    if (section.event.organizer.id !== organizerId) {
      throw new ForbiddenError('Not your event');
    }
    await this.sectionRepo.remove(section);
    await redis.del(`sections:${section.event.id}`);
  }
}
