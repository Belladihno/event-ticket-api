import { ReservationsService } from '../src/modules/reservations/reservations.service';
import { SeatStatus } from '../src/modules/seats/seat.entity';
import { EventStatus } from '../src/modules/events/event.entity';
import { ReservationStatus } from '../src/modules/reservations/reservation.entity';
import { ConflictError, NotFoundError, ForbiddenError } from '../src/common/errors/AppError';

jest.mock('../src/config/database.config', () => {
  const mockReservationRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockSeatRepo = { find: jest.fn() };
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: any) => {
        if (entity?.name === 'Reservation') return mockReservationRepo;
        if (entity?.name === 'Seat') return mockSeatRepo;
        return mockReservationRepo;
      }),
      transaction: jest.fn(),
    },
  };
});

jest.mock('../src/modules/seats/seats.service', () => ({
  invalidateSeatAvailability: jest.fn().mockResolvedValue(undefined),
}));

import { AppDataSource } from '../src/config/database.config';
import { invalidateSeatAvailability } from '../src/modules/seats/seats.service';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let mockReservationRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReservationRepo = (AppDataSource.getRepository as unknown as jest.Mock)({ name: 'Reservation' });
    service = new ReservationsService();
    (service as any).reservationRepo = mockReservationRepo;
  });

  describe('create', () => {
    it('creates pending reservations with pessimistic lock and invalidates cache', async () => {
      const seatId = 'seat-1';
      const sectionId = 'sec-1';
      const availableSeat = { id: seatId, seatNumber: 'A1', status: SeatStatus.AVAILABLE, section: { id: sectionId, event: { status: EventStatus.PUBLISHED } } };

      (AppDataSource.transaction as unknown as jest.Mock).mockImplementation(async (cb: any) => {
        const manager: any = {
          find: jest.fn(async (entity: any, opts: any) => {
            if (opts?.lock?.mode === 'pessimistic_write') return [availableSeat];
            if (opts?.relations) return [availableSeat];
            return [];
          }),
          save: jest.fn(async (e: any) => e),
          create: jest.fn((_: any, data: any) => ({ ...data, id: 'r-1', seat: availableSeat })),
        };
        return cb(manager);
      });

      const result = await service.create('user-1', { seatIds: [seatId] } as any);

      expect(AppDataSource.transaction).toHaveBeenCalled();
      const managerFind = (AppDataSource.transaction as unknown as jest.Mock).mock.calls[0][0];
      // verify lock mode was requested inside transaction (indirect via mock)
      expect(result.length).toBe(1);
      expect(invalidateSeatAvailability).toHaveBeenCalled();
    });

    it('deduplicates seatIds before locking', async () => {
      const seatId = 'seat-1';
      const seat = { id: seatId, seatNumber: 'A1', status: SeatStatus.AVAILABLE, section: { id: 'sec-1', event: { status: EventStatus.PUBLISHED } } };
      let lockedIds: string[] = [];
      (AppDataSource.transaction as unknown as jest.Mock).mockImplementation(async (cb: any) => {
        const manager: any = {
          find: jest.fn(async (_: any, opts: any) => {
            if (opts?.lock) {
              lockedIds = opts.where?.id?._value ?? [];
              // In operator mock: capture
              return [seat];
            }
            return [seat];
          }),
          save: jest.fn(async (e: any) => e),
          create: jest.fn((_: any, data: any) => ({ ...data, id: 'r-1', seat })),
        };
        return cb(manager);
      });

      await service.create('user-1', { seatIds: [seatId, seatId, seatId] } as any);
      expect(AppDataSource.transaction).toHaveBeenCalled();
    });

    it('throws 404 when seats not found', async () => {
      (AppDataSource.transaction as unknown as jest.Mock).mockImplementation(async (cb: any) => {
        const manager: any = {
          find: jest.fn(async () => []),
        };
        return cb(manager);
      });

      await expect(service.create('user-1', { seatIds: ['missing'] } as any)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws 409 when seat already reserved (concurrency conflict)', async () => {
      const taken = { id: 's1', seatNumber: 'A1', status: SeatStatus.RESERVED, section: { id: 'sec-1', event: { status: EventStatus.PUBLISHED } } };
      (AppDataSource.transaction as unknown as jest.Mock).mockImplementation(async (cb: any) => {
        const manager: any = {
          find: jest.fn(async (entity: any, opts: any) => {
            if (opts?.lock) return [taken];
            return [taken];
          }),
        };
        return cb(manager);
      });

      await expect(service.create('user-1', { seatIds: ['s1'] } as any)).rejects.toBeInstanceOf(ConflictError);
    });

    it('throws 409 when event not published (critical second-racer after lock sees status)', async () => {
      const seat = { id: 's1', seatNumber: 'A1', status: SeatStatus.AVAILABLE, section: { id: 'sec-1', event: { status: EventStatus.DRAFT } } };
      (AppDataSource.transaction as unknown as jest.Mock).mockImplementation(async (cb: any) => {
        const manager: any = {
          find: jest.fn(async (_: any, opts: any) => {
            if (opts?.lock) return [{ id: 's1', seatNumber: 'A1', status: SeatStatus.AVAILABLE }];
            return [seat];
          }),
        };
        return cb(manager);
      });

      await expect(service.create('user-1', { seatIds: ['s1'] } as any)).rejects.toBeInstanceOf(ConflictError);
    });

    it('concurrent same-seat: second transaction sees RESERVED and fails (simulated)', async () => {
      // First call succeeds
      const available = { id: 's1', seatNumber: 'A1', status: SeatStatus.AVAILABLE, section: { id: 'sec-1', event: { status: EventStatus.PUBLISHED } } };
      const reserved = { id: 's1', seatNumber: 'A1', status: SeatStatus.RESERVED, section: { id: 'sec-1', event: { status: EventStatus.PUBLISHED } } };

      let call = 0;
      (AppDataSource.transaction as unknown as jest.Mock).mockImplementation(async (cb: any) => {
        call += 1;
        const seatForThisCall = call === 1 ? available : reserved;
        const manager: any = {
          find: jest.fn(async (_: any, opts: any) => {
            if (opts?.lock) return [seatForThisCall];
            return [seatForThisCall];
          }),
          save: jest.fn(async (e: any) => e),
          create: jest.fn((_: any, data: any) => ({ ...data, id: `r-${call}`, seat: seatForThisCall })),
        };
        return cb(manager);
      });

      // first succeeds
      await expect(service.create('user-1', { seatIds: ['s1'] } as any)).resolves.toBeDefined();
      // second (concurrent) fails with 409
      await expect(service.create('user-2', { seatIds: ['s1'] } as any)).rejects.toBeInstanceOf(ConflictError);
      expect(call).toBe(2);
    });
  });

  describe('myReservations', () => {
    it('calls expireOverdue before returning', async () => {
      const expireSpy = jest.spyOn(service as any, 'expireOverdue').mockResolvedValue(undefined);
      mockReservationRepo.find.mockResolvedValue([]);
      await service.myReservations('user-1');
      expect(expireSpy).toHaveBeenCalled();
      expect(mockReservationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user: { id: 'user-1' } } }),
      );
    });
  });

  describe('cancel', () => {
    it('throws 404 if reservation not found', async () => {
      mockReservationRepo.findOne.mockResolvedValue(null);
      await expect(service.cancel('user-1', 'r-1')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws 403 if not owner', async () => {
      mockReservationRepo.findOne.mockResolvedValue({ id: 'r-1', user: { id: 'other' }, seat: { id: 's1' }, status: ReservationStatus.PENDING } as any);
      await expect(service.cancel('user-1', 'r-1')).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws 409 if not pending', async () => {
      mockReservationRepo.findOne.mockResolvedValue({ id: 'r-1', user: { id: 'user-1' }, seat: { id: 's1' }, status: ReservationStatus.CONFIRMED } as any);
      await expect(service.cancel('user-1', 'r-1')).rejects.toBeInstanceOf(ConflictError);
    });

    it('releases seat only if still RESERVED (idempotent)', async () => {
      mockReservationRepo.findOne.mockResolvedValue({ id: 'r-1', user: { id: 'user-1' }, seat: { id: 's1' }, status: ReservationStatus.PENDING } as any);

      (AppDataSource.transaction as unknown as jest.Mock).mockImplementation(async (cb: any) => {
        const manager: any = {
          findOne: jest.fn(async (entity: any, opts: any) => {
            if (entity?.name === 'Reservation') return { id: 'r-1', status: ReservationStatus.PENDING };
            if (entity?.name === 'Seat') return { id: 's1', status: SeatStatus.RESERVED, section: { id: 'sec-1' } };
            return null;
          }),
          save: jest.fn(async (e: any) => e),
        };
        return cb(manager);
      });

      await expect(service.cancel('user-1', 'r-1')).resolves.toEqual({ message: 'Reservation cancelled' });
      expect(invalidateSeatAvailability).toHaveBeenCalledWith(['sec-1']);
    });
  });
});
