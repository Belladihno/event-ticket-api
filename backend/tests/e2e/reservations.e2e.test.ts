/**
 * E2E: Reservations with real MySQL pessimistic locking + Redis
 * Run: pnpm --filter backend test -- e2e/reservations --runInBand --forceExit
 */
jest.setTimeout(60000);

jest.mock('../../src/providers/storage/storage.provider', () => ({
  storageProvider: {
    upload: jest.fn().mockResolvedValue('https://mock-public-url'),
    getSignedUrl: jest.fn().mockResolvedValue('https://mock-signed-url'),
    delete: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/providers/bachs.provider', () => ({
  bachs: {
    checkout: {
      create: jest.fn().mockResolvedValue({
        checkout_url: 'https://checkout.bachs',
        checkout_id: 'chk_test',
        expires_at: new Date().toISOString(),
      }),
    },
    products: { create: jest.fn().mockResolvedValue({ id: 'prod_test' }) },
  },
}));

import request from 'supertest';
import app from '../../src/app';
import {
  initE2E,
  clearDatabase,
  createTestUser,
  createTestVenue,
  createTestEvent,
  createTestSection,
  createTestSeats,
  loginAs,
} from './helpers';

describe('E2E Reservations — pessimistic locking', () => {
  beforeAll(async () => {
    await initE2E();
  }, 60000);

  afterAll(async () => {
    const { teardownE2E } = await import('./helpers');
    await teardownE2E();
  }, 30000);

  beforeEach(async () => {
    await clearDatabase();
  }, 60000);

  it('concurrent same-seat reservation: only one succeeds (409 for the other)', async () => {
    // Organizer + event published + section + seats
    const organizer = await createTestUser({
      email: `org-${Date.now()}@example.com`,
      role: 'organizer',
    });
    const customer1 = await createTestUser({
      email: `c1-${Date.now()}@example.com`,
      role: 'customer',
    });
    const customer2 = await createTestUser({
      email: `c2-${Date.now()}@example.com`,
      role: 'customer',
    });
    const venue = await createTestVenue();
    const event = await createTestEvent(organizer.id, venue.id, {
      status: 'published' as any,
    });
    const section = await createTestSection(event.id);
    const seats = await createTestSeats(section.id, 3);
    const seatId = seats[0]!.id;

    const { token: token1 } = await loginAs(customer1.email);
    const { token: token2 } = await loginAs(customer2.email);

    // Fire two concurrent requests for the same seat
    const [r1, r2] = await Promise.all([
      request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${token1}`)
        .send({ seatIds: [seatId] }),
      request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${token2}`)
        .send({ seatIds: [seatId] }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]); // one success, one conflict

    const success = r1.status === 201 ? r1 : r2;
    expect(success.body.data[0].seat.id).toBe(seatId);
    expect(success.body.data[0].status).toBe('pending');
  });

  it('rejects reservation for unpublished (draft) event', async () => {
    const organizer = await createTestUser({
      email: `org2-${Date.now()}@example.com`,
      role: 'organizer',
    });
    const customer = await createTestUser({
      email: `c-${Date.now()}@example.com`,
    });
    const venue = await createTestVenue();
    const draftEvent = await createTestEvent(organizer.id, venue.id, {
      status: 'draft' as any,
    });
    const section = await createTestSection(draftEvent.id);
    const seats = await createTestSeats(section.id, 2);
    const { token } = await loginAs(customer.email);

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ seatIds: [seats[0]!.id] });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/published/i);
  });

  it('myReservations lazily expires overdue holds', async () => {
    const organizer = await createTestUser({
      email: `org3-${Date.now()}@example.com`,
      role: 'organizer',
    });
    const customer = await createTestUser({
      email: `c3-${Date.now()}@example.com`,
    });
    const venue = await createTestVenue();
    const event = await createTestEvent(organizer.id, venue.id);
    const section = await createTestSection(event.id);
    const seats = await createTestSeats(section.id, 1);
    const { token } = await loginAs(customer.email);

    // Reserve
    const reserve = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ seatIds: [seats[0]!.id] });
    expect(reserve.status).toBe(201);
    const reservationId = reserve.body.data[0].id as string;

    // Manually expire the reservation by pushing expiresAt to past via DB
    const { AppDataSource } = await import('../../src/config/database.config');
    await AppDataSource.getRepository('Reservation' as any).update(
      { id: reservationId },
      { expiresAt: new Date(Date.now() - 60_000) } as any,
    );

    // GET /reservations/me triggers expireOverdue
    const me = await request(app)
      .get('/api/reservations/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    const expired = me.body.data.find((r: any) => r.id === reservationId);
    expect(expired.status).toBe('expired');

    // Seat should be back to available
    const seatRes = await request(app).get(`/api/sections/${section.id}/seats`);
    const seat = (seatRes.body.data as any[]).find(
      (s: any) => s.id === seats[0]!.id,
    );
    expect(seat.status).toBe('available');
  });
});
