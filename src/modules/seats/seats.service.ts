import { Repository } from 'typeorm';
import { Seat, SeatStatus } from './seat.entity';
import { Section } from '../sections/section.entity';
import { AppDataSource } from '../../config/database.config';
import { NotFoundError, ForbiddenError } from '../../common/errors/AppError';
import type { CreateSeatsDto, UpdateSeatDto } from './seats.schema';

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
  }
}
