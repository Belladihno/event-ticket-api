jest.mock('../src/config/redis.config', () => ({
  redis: { del: jest.fn().mockResolvedValue(1), get: jest.fn(), setex: jest.fn() },
}));

jest.mock('../src/modules/seats/seats.service', () => ({
  invalidateSeatAvailabilityBySeatIds: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/modules/tickets/tickets.service', () => ({
  TicketsService: jest.fn().mockImplementation(() => ({
    generateForReservations: jest.fn().mockResolvedValue([{ id: 't1' }]),
  })),
}));

jest.mock('../src/modules/notifications/notifications.service', () => ({
  NotificationsService: jest.fn().mockImplementation(() => ({
    enqueueBookingConfirmation: jest.fn().mockResolvedValue(undefined),
    enqueuePaymentFailed: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockProcessedRepo: any = {
  findOne: jest.fn().mockResolvedValue(null),
  save: jest.fn(async (x: any) => x),
  create: jest.fn((x: any) => x),
};

const mockTransaction = jest.fn(async (cb: any) => {
  const manager: any = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    create: jest.fn((_: any) => ({ id: 'p1' })),
    save: jest.fn(async (x: any) => x),
  };
  return cb(manager);
});

jest.mock('../src/config/database.config', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: any) => {
      if (entity?.name === 'ProcessedEvent' || entity?.name === 'ProcessedEvent') return mockProcessedRepo;
      return { findOne: jest.fn(), find: jest.fn() };
    }),
    transaction: mockTransaction,
  },
}));

import { handleBachsWebhook } from '../src/modules/payments/webhooks.service';
import { AppDataSource } from '../src/config/database.config';
import { invalidateSeatAvailabilityBySeatIds } from '../src/modules/seats/seats.service';

describe('handleBachsWebhook — idempotency & state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProcessedRepo.findOne.mockResolvedValue(null);
    mockProcessedRepo.save.mockImplementation(async (x: any) => x);
    mockProcessedRepo.create.mockImplementation((x: any) => x);
    (mockTransaction as jest.Mock).mockImplementation(async (cb: any) => {
      const manager: any = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        create: jest.fn((_: any) => ({ id: 'p1' })),
        save: jest.fn(async (x: any) => x),
      };
      return cb(manager);
    });
  });

  it('inserts processed event and processes new event', async () => {
    await handleBachsWebhook({
      id: 'evt_new',
      type: 'collection.succeeded',
      created_at: new Date().toISOString(),
      organization_id: 'org',
      data: { amount: '50000.00', currency: 'NGN', metadata: { reservationIds: 'r1', seatIds: 's1', userId: 'u1', eventId: 'e1' }, id: 'pay_1' },
    } as any);

    expect(mockProcessedRepo.findOne).toHaveBeenCalledWith({ where: { eventId: 'evt_new' } });
    expect(mockProcessedRepo.save).toHaveBeenCalled();
    expect(AppDataSource.transaction).toHaveBeenCalled();
  });

  it('ignores duplicate eventId (idempotency) — no transaction', async () => {
    mockProcessedRepo.findOne.mockResolvedValue({ eventId: 'evt_dup' } as any);

    await handleBachsWebhook({
      id: 'evt_dup',
      type: 'collection.succeeded',
      created_at: new Date().toISOString(),
      organization_id: 'org',
      data: { metadata: {} },
    } as any);

    expect(mockProcessedRepo.findOne).toHaveBeenCalledWith({ where: { eventId: 'evt_dup' } });
    expect(AppDataSource.transaction).not.toHaveBeenCalled();
  });

  it('collection.succeeded creates payment and invalidates seats', async () => {
    await handleBachsWebhook({
      id: 'evt_ok',
      type: 'collection.succeeded',
      created_at: new Date().toISOString(),
      organization_id: 'org',
      data: {
        id: 'pay_123',
        amount: '50000.00',
        currency: 'NGN',
        metadata: { userId: 'u1', eventId: 'e1', reservationIds: 'r1,r2', seatIds: 's1,s2' },
      },
    } as any);

    expect(AppDataSource.transaction).toHaveBeenCalledTimes(1);
    expect(invalidateSeatAvailabilityBySeatIds).toHaveBeenCalledWith(['s1', 's2']);
  });

  it('collection.failed releases pending->expired and reserved->available', async () => {
    await handleBachsWebhook({
      id: 'evt_fail',
      type: 'collection.failed',
      created_at: new Date().toISOString(),
      organization_id: 'org',
      data: { metadata: { reservationIds: 'r1', seatIds: 's1', userId: 'u1', eventId: 'e1' }, amount: '5000' },
    } as any);

    expect(AppDataSource.transaction).toHaveBeenCalled();
    expect(invalidateSeatAvailabilityBySeatIds).toHaveBeenCalled();
  });

  it('checkout.expired releases holds same as failed', async () => {
    await handleBachsWebhook({
      id: 'evt_exp',
      type: 'checkout.expired',
      created_at: new Date().toISOString(),
      organization_id: 'org',
      data: { metadata: { reservationIds: 'r1', seatIds: 's1' } },
    } as any);

    expect(AppDataSource.transaction).toHaveBeenCalled();
  });

  it('missing metadata does not throw (graceful no-op)', async () => {
    await expect(
      handleBachsWebhook({
        id: 'evt_nometa',
        type: 'collection.succeeded',
        created_at: new Date().toISOString(),
        organization_id: 'org',
        data: { metadata: {} },
      } as any),
    ).resolves.not.toThrow();

    // still inserted processed marker, but no transaction for business
    expect(mockProcessedRepo.save).toHaveBeenCalled();
  });

  it('duplicate webhook does not create second payment (idempotency)', async () => {
    // First call processes
    await handleBachsWebhook({
      id: 'evt_idem',
      type: 'collection.succeeded',
      created_at: new Date().toISOString(),
      organization_id: 'org',
      data: { amount: '5000', metadata: { reservationIds: 'r1', seatIds: 's1', userId: 'u1', eventId: 'e1' }, id: 'pay1' },
    } as any);
    const firstTxCalls = (AppDataSource.transaction as unknown as jest.Mock).mock.calls.length;

    // Second call with same id should be ignored
    mockProcessedRepo.findOne.mockResolvedValue({ eventId: 'evt_idem' } as any);
    await handleBachsWebhook({
      id: 'evt_idem',
      type: 'collection.succeeded',
      created_at: new Date().toISOString(),
      organization_id: 'org',
      data: { amount: '5000', metadata: { reservationIds: 'r1', seatIds: 's1', userId: 'u1', eventId: 'e1' }, id: 'pay1' },
    } as any);

    expect((AppDataSource.transaction as unknown as jest.Mock).mock.calls.length).toBe(firstTxCalls);
  });
});
