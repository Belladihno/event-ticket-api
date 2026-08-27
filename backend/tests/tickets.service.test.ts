import { TicketsService } from '../src/modules/tickets/tickets.service';
import { signQrPayload } from '../src/common/utils/qr.util';
import { AuthError, ForbiddenError, NotFoundError, ValidationError } from '../src/common/errors/AppError';

jest.mock('../src/config/database.config', () => {
  const mockTicketRepo: any = { find: jest.fn(), findOne: jest.fn(), create: jest.fn((x: any) => x), save: jest.fn(async (x: any) => ({ ...x, id: x.id ?? 't1' })) };
  const mockReservationRepo: any = { find: jest.fn() };
  const mockEventRepo: any = { findOne: jest.fn() };
  const mockUserRepo: any = { findOne: jest.fn() };
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: any) => {
        if (entity?.name === 'Ticket') return mockTicketRepo;
        if (entity?.name === 'Reservation') return mockReservationRepo;
        if (entity?.name === 'Event') return mockEventRepo;
        if (entity?.name === 'User') return mockUserRepo;
        return mockTicketRepo;
      }),
    },
  };
});

jest.mock('../src/providers/storage/storage.provider', () => ({
  storageProvider: { upload: jest.fn().mockResolvedValue('https://public'), getSignedUrl: jest.fn().mockResolvedValue('https://signed') },
}));

jest.mock('../src/common/utils/pdf.util', () => ({
  generateTicketPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
}));

import { AppDataSource } from '../src/config/database.config';
import { storageProvider } from '../src/providers/storage/storage.provider';

describe('TicketsService.validate', () => {
  let service: TicketsService;
  let mockTicketRepo: any;

  const organizerId = 'org-1';
  const userId = 'user-1';
  const eventId = 'event-1';

  beforeEach(() => {
    jest.clearAllMocks();
    mockTicketRepo = (AppDataSource.getRepository as unknown as jest.Mock)({ name: 'Ticket' });
    service = new TicketsService();
    (service as any).ticketRepo = mockTicketRepo;
  });

  function makePayload(ticketId = 't1') {
    const p = signQrPayload(ticketId, userId, eventId);
    return JSON.stringify(p);
  }

  it('validates a fresh ticket and marks isUsed true (first scan)', async () => {
    const payload = makePayload('t1');
    mockTicketRepo.findOne.mockResolvedValue({
      id: 't1',
      isUsed: false,
      event: { id: eventId, organizer: { id: organizerId } },
      seat: { id: 's1' },
    } as any);
    mockTicketRepo.save.mockImplementation(async (x: any) => ({ ...x }));

    const res = await service.validate(payload, organizerId);

    expect(res.alreadyUsed).toBe(false);
    expect(res.ticket.isUsed).toBe(true);
    expect(res.ticket.usedAt).toBeDefined();
    expect(mockTicketRepo.save).toHaveBeenCalled();
  });

  it('returns alreadyUsed true on second scan (idempotent, no double-save)', async () => {
    const payload = makePayload('t1');
    mockTicketRepo.findOne.mockResolvedValue({
      id: 't1',
      isUsed: true,
      usedAt: new Date(),
      event: { id: eventId, organizer: { id: organizerId } },
    } as any);

    const res = await service.validate(payload, organizerId);

    expect(res.alreadyUsed).toBe(true);
    expect(mockTicketRepo.save).not.toHaveBeenCalled();
  });

  it('throws AuthError for tampered signature', async () => {
    const payload = JSON.stringify({ ticketId: 't1', userId, eventId, signature: 'f'.repeat(64) });
    await expect(service.validate(payload, organizerId)).rejects.toBeInstanceOf(AuthError);
  });

  it('throws ValidationError for invalid JSON', async () => {
    await expect(service.validate('not-json', organizerId)).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws NotFoundError when ticket not found', async () => {
    const payload = makePayload('missing');
    mockTicketRepo.findOne.mockResolvedValue(null);
    await expect(service.validate(payload, organizerId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ForbiddenError when scanner is not organizer of event', async () => {
    const payload = makePayload('t1');
    mockTicketRepo.findOne.mockResolvedValue({
      id: 't1',
      isUsed: false,
      event: { id: eventId, organizer: { id: 'other-org' } },
    } as any);

    await expect(service.validate(payload, organizerId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('tampered ticketId in payload fails signature check', async () => {
    const good = signQrPayload('t1', userId, eventId);
    const tampered = { ...good, ticketId: 't2' };
    await expect(service.validate(JSON.stringify(tampered), organizerId)).rejects.toBeInstanceOf(AuthError);
  });

  it('throws AuthError for refunded ticket', async () => {
    const payload = makePayload('t1');
    mockTicketRepo.findOne.mockResolvedValue({
      id: 't1',
      isUsed: false,
      isRefunded: true,
      event: { id: eventId, organizer: { id: organizerId } },
    } as any);
    await expect(service.validate(payload, organizerId)).rejects.toBeInstanceOf(AuthError);
    await expect(service.validate(payload, organizerId)).rejects.toThrow(/refunded/i);
  });
});

describe('TicketsService.getTicket', () => {
  let service: TicketsService;
  let mockTicketRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTicketRepo = (AppDataSource.getRepository as unknown as jest.Mock)({ name: 'Ticket' });
    service = new TicketsService();
    (service as any).ticketRepo = mockTicketRepo;
  });

  it('throws NotFound for missing ticket', async () => {
    mockTicketRepo.findOne.mockResolvedValue(null);
    await expect(service.getTicket('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws Forbidden when not owner', async () => {
    mockTicketRepo.findOne.mockResolvedValue({ id: 't1', user: { id: 'other' } } as any);
    await expect(service.getTicket('user-1', 't1')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('returns ticket with fresh signed URL for owner', async () => {
    mockTicketRepo.findOne.mockResolvedValue({
      id: 't1',
      user: { id: 'user-1' },
      event: { id: 'e1' },
      seat: { id: 's1', section: { name: 'VIP' } },
      isUsed: false,
      qrPayload: '{}',
    } as any);
    (storageProvider.getSignedUrl as unknown as jest.Mock).mockResolvedValue('https://signed/t1.pdf');

    const res = await service.getTicket('user-1', 't1');
    expect(res.ticketUrl).toBe('https://signed/t1.pdf');
    expect(res.id).toBe('t1');
  });
});

describe('TicketsService.myTicketEvents grouping', () => {
  let service: TicketsService;
  let mockTicketRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTicketRepo = (AppDataSource.getRepository as unknown as jest.Mock)({ name: 'Ticket' });
    service = new TicketsService();
    (service as any).ticketRepo = mockTicketRepo;
  });

  it('deduplicates events and counts tickets per event', async () => {
    mockTicketRepo.find.mockResolvedValue([
      { id: 't1', event: { id: 'e1' } },
      { id: 't2', event: { id: 'e1' } },
      { id: 't3', event: { id: 'e2' } },
    ] as any);

    const res = await service.myTicketEvents('user-1');
    expect(res).toHaveLength(2);
    const e1 = res.find((r: any) => r.event.id === 'e1');
    expect(e1).toBeDefined();
    expect(e1!.ticketCount).toBe(2);
  });
});
