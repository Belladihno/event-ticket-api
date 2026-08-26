import { In, Repository } from 'typeorm';
import { Seat, SeatStatus } from './seat.entity';
import { Section } from '../sections/section.entity';
import { AppDataSource } from '../../config/database.config';
import { redis } from '../../config/redis.config';
import { NotFoundError, ForbiddenError } from '../../common/errors/AppError';
import type { CreateSeatsDto, UpdateSeatDto } from './seats.schema';

// Availability counts are read heavily (seat maps) but change on every
// reservation/expiry/booking, so keep the TTL short AND invalidate explicitly.
const SEAT_AVAILABILITY_TTL_SECONDS = 60;

export function seatAvailabilityKey(sectionId: string): string {
  return `seats:available:${sectionId}`;
}

export async function invalidateSeatAvailability(sectionIds: string[]): Promise<void> {
  const unique = [...new Set(sectionIds)].filter(Boolean);
  if (unique.length === 0) return;
  await redis.del(...unique.map((id) => seatAvailabilityKey(id)));
}

export async function invalidateSeatAvailabilityBySeatIds(seatIds: string[]): Promise<void> {
  if (seatIds.length === 0) return;
  const seats = await AppDataSource.getRepository(Seat).find({
    where: { id: In(seatIds) },
    relations: ['section'],
  });
  await invalidateSeatAvailability(seats.map((seat) => seat.section?.id ?? ''));
}

export class SeatsService {
  private seatRepo: Repository<Seat>;
  private sectionRepo: Repository<Section>;

  constructor() {
    this.seatRepo = AppDataSource.getRepository(Seat);
    this.sectionRepo = AppDataSource.getRepository(Section);
  }

  async bulkCreate(sectionId: string, organizerId: string, data: CreateSeatsDto) {
    const seatNumbers = data.seatNumbers;
    const section = await this.sectionRepo.findOne({ where: { id: sectionId }, relations: ['event', 'event.organizer'] });
    if (!section) {
      throw new NotFoundError('Section not found');
    }
    if (section.event.organizer.id !== organizerId) {
      throw new ForbiddenError('Not your event');
    }
    const existing = await this.seatRepo.count({ where: { section: { id: sectionId } } });
    if (existing + seatNumbers.length > section.totalSeats) {
      throw new ForbiddenError(`Section capacity is ${section.totalSeats} seats; ${existing} already exist`);
    }
    const seats = seatNumbers.map((seatNumber) =>
      this.seatRepo.create({ section, seatNumber, status: SeatStatus.AVAILABLE }),
    );
    await this.seatRepo.save(seats);
    await invalidateSeatAvailability([sectionId]);
    return seats;
  }

  async listBySection(sectionId: string) {
    const section = await this.sectionRepo.findOne({ where: { id: sectionId } });
    if (!section) {
      throw new NotFoundError('Section not found');
    }
    return this.seatRepo.find({
      where: { section: { id: sectionId } },
      order: { seatNumber: 'ASC' },
    });
  }

  async availableCount(sectionId: string) {
    const section = await this.sectionRepo.findOne({ where: { id: sectionId } });
    if (!section) {
      throw new NotFoundError('Section not found');
    }
    const key = seatAvailabilityKey(sectionId);
    const cached = await redis.get(key);
    if (cached !== null) {
      return { sectionId, available: parseInt(cached, 10) };
    }
    const available = await this.seatRepo.count({
      where: { section: { id: sectionId }, status: SeatStatus.AVAILABLE },
    });
    await redis.setex(key, SEAT_AVAILABILITY_TTL_SECONDS, String(available));
    return { sectionId, available };
  }

  async getById(id: string) {
    const seat = await this.seatRepo.findOne({ where: { id }, relations: ['section'] });
    if (!seat) {
      throw new NotFoundError('Seat not found');
    }
    return seat;
  }

  async update(id: string, organizerId: string, data: UpdateSeatDto) {
    const seat = await this.seatRepo.findOne({ where: { id }, relations: ['section', 'section.event', 'section.event.organizer'] });
    if (!seat) {
      throw new NotFoundError('Seat not found');
    }
    if (seat.section.event.organizer.id !== organizerId) {
      throw new ForbiddenError('Not your event');
    }
    if (data.seatNumber !== undefined) seat.seatNumber = data.seatNumber;
    await this.seatRepo.save(seat);
    await invalidateSeatAvailability([seat.section.id]);
    return seat;
  }

  async remove(id: string, organizerId: string) {
    const seat = await this.seatRepo.findOne({ where: { id }, relations: ['section', 'section.event', 'section.event.organizer'] });
    if (!seat) {
      throw new NotFoundError('Seat not found');
    }
    if (seat.section.event.organizer.id !== organizerId) {
      throw new ForbiddenError('Not your event');
    }
    await this.seatRepo.remove(seat);
    await invalidateSeatAvailability([seat.section.id]);
  }
}
