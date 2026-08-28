/**
 * E2E: Payments checkout + Bachs webhooks with real DB/Redis
 * Run: pnpm --filter backend test -- e2e/payments --runInBand --forceExit
 */
jest.setTimeout(60000);

jest.mock('../../src/providers/storage/storage.provider', () => ({
  storageProvider: {
    upload: jest.fn().mockResolvedValue('https://mock-public-url'),
    getSignedUrl: jest.fn().mockResolvedValue('https://mock-signed-url'),
    delete: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockCheckoutCreate = jest.fn().mockResolvedValue({
  checkout_url: 'https://checkout.bachs.io/test',
  checkout_id: 'chk_test123',
  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
});
jest.mock('../../src/providers/bachs.provider', () => ({
  bachs: {
    checkout: { create: jest.fn((...args: any[]) => mockCheckoutCreate(...args)) },
    products: { create: jest.fn().mockResolvedValue({ id: 'prod_test' }) },
  },
}));

import request from 'supertest';
import crypto from 'crypto';
import app from '../../src/app';
import { config } from '../../src/config/app.config';
import { initE2E, clearDatabase, createTestUser, createTestVenue, createTestEvent, createTestSection, createTestSeats, loginAs } from './helpers';
import { AppDataSource } from '../../src/config/database.config';

function signWebhook(body: Buffer, timestamp: string): string {
  const secret = config.bachs.webhookSecret || 'test_webhook_secret';
  // webhook.controller uses config.bachs.webhookSecret — ensure test secret matches
  // If env not set, fallback to test secret; we set process.env before import via setup.env
  const actualSecret = process.env.BACHS_WEBHOOK_SECRET || secret;
  return crypto.createHmac('sha256', actualSecret).update(`${timestamp}.${body.toString('utf8')}`, 'utf8').digest('hex');
}

describe('E2E Payments', () => {
  beforeAll(async () => {
    // Ensure webhook secret is set for HMAC verification
    process.env.BACHS_WEBHOOK_SECRET = process.env.BACHS_WEBHOOK_SECRET || 'test_webhook_secret';
    // Re-sync config (it reads env at import, but we set fallback)
    (config.bachs as any).webhookSecret = process.env.BACHS_WEBHOOK_SECRET;
    await initE2E();
  }, 60000);

  afterAll(async () => {
    const { teardownE2E } = await import('./helpers');
    await teardownE2E();
  }, 30000);

  beforeEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
    mockCheckoutCreate.mockClear();
  }, 60000);

  it('checkout creates holds and returns checkoutUrl, then webhook succeeds and books seats', async () => {
    const organizer = await createTestUser({ email: `org-${Date.now()}@example.com`, role: 'organizer' });
    const customer = await createTestUser({ email: `cust-${Date.now()}@example.com` });
    const venue = await createTestVenue();
    const event = await createTestEvent(organizer.id, venue.id);
    const section = await createTestSection(event.id);
    const seats = await createTestSeats(section.id, 2);

    const { token } = await loginAs(customer.email);

    // Checkout
    const checkout = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: section.id, seatIds: seats.map((s) => s.id) });

    expect(checkout.status).toBe(200);
    expect(checkout.body.data.checkoutUrl).toMatch(/https/);
    expect(checkout.body.data.reservationIds).toHaveLength(2);
    const reservationIds: string[] = checkout.body.data.reservationIds;
    const seatIds = seats.map((s) => s.id);

    // Seats should be reserved
    const seatList1 = await request(app).get(`/api/sections/${section.id}/seats`);
    expect(seatList1.body.data.find((s: any) => s.id === seatIds[0]).status).toBe('reserved');

    // Simulate Bachs webhook collection.succeeded with HMAC
    const payload = {
      id: `evt_${Date.now()}`,
      type: 'collection.succeeded',
      created_at: new Date().toISOString(),
      organization_id: 'org_bachs',
      data: {
        id: 'pay_test123',
        amount: '100000.00',
        currency: 'NGN',
        metadata: {
          userId: customer.id,
          sectionId: section.id,
          eventId: event.id,
          reservationIds: reservationIds.join(','),
          seatIds: seatIds.join(','),
        },
      },
    };
    const bodyStr = JSON.stringify(payload);
    const raw = Buffer.from(bodyStr);
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = signWebhook(raw, ts);

    const webhook = await request(app)
      .post('/api/webhooks/bachs')
      .set('X-Bachs-Timestamp', ts)
      .set('X-Bachs-Signature', sig)
      .set('Content-Type', 'application/json')
      .send(bodyStr);

    expect(webhook.status).toBe(200);
    expect(webhook.body.received).toBe(true);

    // Wait for async ticket generation (pdf + upload mocked but still async)
    await new Promise((r) => setTimeout(r, 1500));

    // Poll for tickets up to 3s (handle async worker delay)
    let tickets: any[] = [];
    for (let i = 0; i < 6; i++) {
      tickets = await AppDataSource.getRepository('Ticket' as any).find({ where: { user: { id: customer.id } } as any });
      if (tickets.length === 2) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    // Seats should now be booked
    const seatList2 = await request(app).get(`/api/sections/${section.id}/seats`);
    expect(seatList2.body.data.find((s: any) => s.id === seatIds[0]).status).toBe('booked');

    // Payment should be successful
    const payments = await AppDataSource.getRepository('Payment' as any).find({ where: { user: { id: customer.id } } as any });
    expect(payments.length).toBeGreaterThan(0);
    expect(payments[0]!.status).toBe('successful');

    // Tickets should be generated
    expect(tickets.length).toBe(2);
  });

  it('webhook rejects invalid signature (400)', async () => {
    const payload = { id: 'evt_bad', type: 'collection.succeeded', created_at: new Date().toISOString(), organization_id: 'org', data: { metadata: {} } };
    const raw = Buffer.from(JSON.stringify(payload));
    const ts = Math.floor(Date.now() / 1000).toString();

    const res = await request(app)
      .post('/api/webhooks/bachs')
      .set('X-Bachs-Timestamp', ts)
      .set('X-Bachs-Signature', 'bad-signature')
      .set('Content-Type', 'application/json')
      .send(raw);

    expect(res.status).toBe(400);
  });

  it('webhook is idempotent (duplicate evt id ignored, no double booking)', async () => {
    const organizer = await createTestUser({ email: `org2-${Date.now()}@example.com`, role: 'organizer' });
    const customer = await createTestUser({ email: `cust2-${Date.now()}@example.com` });
    const venue = await createTestVenue();
    const event = await createTestEvent(organizer.id, venue.id);
    const section = await createTestSection(event.id);
    const seats = await createTestSeats(section.id, 1);
    const { token } = await loginAs(customer.email);

    const checkout = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ sectionId: section.id, seatIds: [seats[0]!.id] });
    const reservationIds = checkout.body.data.reservationIds as string[];

    const payload = {
      id: 'evt_dup_test',
      type: 'collection.succeeded',
      created_at: new Date().toISOString(),
      organization_id: 'org',
      data: {
        id: 'pay_dup',
        amount: '50000.00',
        currency: 'NGN',
        metadata: {
          userId: customer.id,
          sectionId: section.id,
          eventId: event.id,
          reservationIds: reservationIds.join(','),
          seatIds: seats.map((s) => s.id).join(','),
        },
      },
    };
    const bodyStr = JSON.stringify(payload);
    const raw = Buffer.from(bodyStr);
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = signWebhook(raw, ts);

    const first = await request(app).post('/api/webhooks/bachs').set('X-Bachs-Timestamp', ts).set('X-Bachs-Signature', sig).set('Content-Type', 'application/json').send(bodyStr);
    expect(first.status).toBe(200);
    await new Promise((r) => setTimeout(r, 500));

    const second = await request(app).post('/api/webhooks/bachs').set('X-Bachs-Timestamp', ts).set('X-Bachs-Signature', sig).set('Content-Type', 'application/json').send(bodyStr);
    expect(second.status).toBe(200);
    await new Promise((r) => setTimeout(r, 300));

    // Should still be only one payment (idempotencyKey = evt id)
    const payments = await AppDataSource.getRepository('Payment' as any).find();
    const dupPayments = payments.filter((p: any) => p.idempotencyKey === 'evt_dup_test');
    expect(dupPayments).toHaveLength(1);
  });
});
