import { In, LessThan, Repository } from 'typeorm';
import { Reservation, ReservationStatus } from './reservation.entity';
import { Seat, SeatStatus } from '../seats/seat.entity';
import { User } from '../users/user.entity';
import { EventStatus } from '../events/event.entity';
import { AppDataSource } from '../../config/database.config';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/AppError';
import type { CreateReservationDto } from './reservations.schema';

const RESERVATION_TTL_MINUTES = 10;

export class ReservationsService {
  private reservationRepo: Repository<Reservation>;
  private seatRepo: Repository<Seat>;

  constructor() {
    this.reservationRepo = AppDataSource.getRepository(Reservation);
    this.seatRepo = AppDataSource.getRepository(Seat);
  }

  async create(userId: string, data: CreateReservationDto) {
    const seatIds = [...new Set(data.seatIds)];
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

    return AppDataSource.transaction(async (manager) => {
      const seats = await manager.find(Seat, {
        where: { id: In(seatIds) },
        lock: { mode: 'pessimistic_write' },
      });
      if (seats.length !== seatIds.length) {
        throw new NotFoundError('One or more seats not found');
      }
      const taken = seats.find((seat) => seat.status !== SeatStatus.AVAILABLE);
      if (taken) {
        throw new ConflictError(`Seat ${taken.seatNumber} is not available`);
      }
      const withDetails = await manager.find(Seat, {
        where: { id: In(seatIds) },
        relations: ['section', 'section.event'],
      });
      const unpublished = withDetails.find((seat) => seat.section.event.status !== EventStatus.PUBLISHED);
      if (unpublished) {
        throw new ConflictError('Seats can only be reserved for published events');
      }
      for (const seat of seats) {
        seat.status = SeatStatus.RESERVED;
        await manager.save(seat);
      }
      const reservations = withDetails.map((seat) => {
        const reservation = manager.create(Reservation, {
          seat,
          status: ReservationStatus.PENDING,
          expiresAt,
        });
        reservation.user = { id: userId } as User;
        return reservation;
      });
      await manager.save(reservations);
      return reservations;
    });
  }

  async myReservations(userId: string) {
    await this.expireOverdue();
    return this.reservationRepo.find({
      where: { user: { id: userId } },
      relations: ['seat', 'seat.section', 'seat.section.event'],
      order: { createdAt: 'DESC' },
    });
  }

  async cancel(userId: string, reservationId: string) {
    const reservation = await this.reservationRepo.findOne({
      where: { id: reservationId },
      relations: ['user', 'seat'],
    });
    if (!reservation) {
      throw new NotFoundError('Reservation not found');
    }
    if (reservation.user.id !== userId) {
      throw new ForbiddenError('Not your reservation');
    }
    if (reservation.status !== ReservationStatus.PENDING) {
      throw new ConflictError('Only pending reservations can be cancelled');
    }
    await AppDataSource.transaction(async (manager) => {
      const locked = await manager.findOne(Reservation, {
        where: { id: reservationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.status !== ReservationStatus.PENDING) {
        throw new ConflictError('Reservation is no longer pending');
      }
      locked.status = ReservationStatus.EXPIRED;
      await manager.save(locked);
      const seat = await manager.findOne(Seat, { where: { id: reservation.seat.id } });
      if (seat && seat.status === SeatStatus.RESERVED) {
        seat.status = SeatStatus.AVAILABLE;
        await manager.save(seat);
      }
    });
    return { message: 'Reservation cancelled' };
  }

  async expireOverdue() {
    const overdue = await this.reservationRepo.find({
      where: { status: ReservationStatus.PENDING, expiresAt: LessThan(new Date()) },
      relations: ['seat'],
    });
    if (overdue.length === 0) {
      return;
    }
    await AppDataSource.transaction(async (manager) => {
      for (const reservation of overdue) {
        reservation.status = ReservationStatus.EXPIRED;
        await manager.save(reservation);
        if (reservation.seat && reservation.seat.status === SeatStatus.RESERVED) {
          reservation.seat.status = SeatStatus.AVAILABLE;
          await manager.save(reservation.seat);
        }
      }
    });
  }
}
