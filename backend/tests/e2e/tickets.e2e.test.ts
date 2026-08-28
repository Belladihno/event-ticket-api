/**
 * E2E: Tickets generation + validation with real DB/Redis
 * Run: pnpm --filter backend test -- e2e/tickets --runInBand --forceExit
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
  checkout_id: 'chk_test',
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
import { AppDataSource } from '../../src/config/database.config';
import { initE2E, clearDatabase, createTestUser, createTestVenue, createTestEvent, createTestSection, createTestSeats, loginAs } from './helpers';

function signWebhook(body: Buffer, timestamp: string): string {
  const secret = (config.bachs as any).webhookSecret || process.env.BACHS_WEBHOOK_SECRET || 'test_webhook_secret';
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body.toString('utf8')}`, 'utf8').digest('hex');
}

describe('E2E Tickets', () => {
  beforeAll(async () => {
    process.env.BACHS_WEBHOOK_SECRET = process.env.BACHS_WEBHOOK_SECRET || 'test_webhook_secret';
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
  }, 60000);

  it('generates tickets on payment success and validates at door', async () => {
    const organizer = await createTestUser({ email: `org-${Date.now()}@example.com`, role: 'organizer' as any });
    const customer = await createTestUser({ email: `cust-${Date.now()}@example.com` });
    const venue = await createTestVenue();
    const event = await createTestEvent(organizer.id, venue.id);
    const section = await createTestSection(event.id);
    const seats = await createTestSeats(section.id, 2);
    const { token: customerToken } = await loginAs(customer.email);
    const { token: organizerToken } = await loginAs(organizer.email);

    // Checkout
    const checkout = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ sectionId: section.id, seatIds: seats.map((s) => s.id) });
    expect(checkout.status).toBe(200);
    const reservationIds = checkout.body.data.reservationIds as string[];
    const seatIds = seats.map((s) => s.id);

    // Webhook success
    const payload = {
      id: `evt_tix_${Date.now()}`,
      type: 'collection.succeeded',
      created_at: new Date().toISOString(),
      organization_id: 'org_bachs',
      data: {
        id: 'pay_tix',
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
    await new Promise((r) => setTimeout(r, 1500));

    // Poll for tickets
    let tickets: any[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app).get('/api/tickets/me').set('Authorization', `Bearer ${customerToken}`);
      tickets = res.body.data as any[];
      if (tickets.length === 2) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(tickets).toHaveLength(2);
    const ticket = tickets[0];

    // My ticket events
    const eventsRes = await request(app).get('/api/tickets/me/events').set('Authorization', `Bearer ${customerToken}`);
    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body.data[0].ticketCount).toBe(2);

    // Get ticket with signed URL
    const getRes = await request(app).get(`/api/tickets/${ticket.id}`).set('Authorization', `Bearer ${customerToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.ticketUrl).toMatch(/https/);
    const qrPayload = getRes.body.data.qrPayload as string;

    // Validate as organizer (first scan)
    const validate1 = await request(app)
      .post('/api/tickets/validate')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ qrPayload });
    expect(validate1.status).toBe(200);
    expect(validate1.body.data.alreadyUsed).toBe(false);

    // Second scan returns alreadyUsed true
    const validate2 = await request(app)
      .post('/api/tickets/validate')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ qrPayload });
    expect(validate2.status).toBe(200);
    expect(validate2.body.data.alreadyUsed).toBe(true);

    // Wrong organizer should 403
    const otherOrg = await createTestUser({ email: `other-${Date.now()}@example.com`, role: 'organizer' as any });
    const { token: otherToken } = await loginAs(otherOrg.email);
    const wrong = await request(app)
      .post('/api/tickets/validate')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ qrPayload });
    expect(wrong.status).toBe(403);
  });

  it('refunded ticket is rejected at validation', async () => {
    const organizer = await createTestUser({ email: `org-ref-${Date.now()}@example.com`, role: 'organizer' as any });
    const customer = await createTestUser({ email: `cust-ref-${Date.now()}@example.com` });
    const venue = await createTestVenue();
    const event = await createTestEvent(organizer.id, venue.id);
    const section = await createTestSection(event.id);
    const seats = await createTestSeats(section.id, 1);
    const { token: customerToken } = await loginAs(customer.email);
    const { token: organizerToken } = await loginAs(organizer.email);

    const checkout = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ sectionId: section.id, seatIds: [seats[0]!.id] });
    const reservationIds = checkout.body.data.reservationIds as string[];

    // Pay
    const payPayload = {
      id: `evt_pay_${Date.now()}`,
      type: 'collection.succeeded',
      created_at: new Date().toISOString(),
      organization_id: 'org',
      data: {
        id: 'pay_ref',
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
    const payBody = JSON.stringify(payPayload);
    const payRaw = Buffer.from(payBody);
    const payTs = Math.floor(Date.now() / 1000).toString();
    const paySig = signWebhook(payRaw, payTs);
    await request(app)
      .post('/api/webhooks/bachs')
      .set('X-Bachs-Timestamp', payTs)
      .set('X-Bachs-Signature', paySig)
      .set('Content-Type', 'application/json')
      .send(payBody);
    await new Promise((r) => setTimeout(r, 1500));

    // Get ticket
    const ticketsRes = await request(app).get('/api/tickets/me').set('Authorization', `Bearer ${customerToken}`);
    const ticket = ticketsRes.body.data[0] as any;
    const qrPayload = ticket.qrPayload as string;

    // Refund
    const refundPayload = {
      id: `evt_refund_${Date.now()}`,
      type: 'refund.paid',
      created_at: new Date().toISOString(),
      organization_id: 'org',
      data: {
        id: 'ref_test',
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
    const refBody = JSON.stringify(refundPayload);
    const refRaw = Buffer.from(refBody);
    const refTs = Math.floor(Date.now() / 1000).toString();
    const refSig = signWebhook(refRaw, refTs);
    const refundRes = await request(app)
      .post('/api/webhooks/bachs')
      .set('X-Bachs-Timestamp', refTs)
      .set('X-Bachs-Signature', refSig)
      .set('Content-Type', 'application/json')
      .send(refBody);
    expect(refundRes.status).toBe(200);
    await new Promise((r) => setTimeout(r, 800));

    // Ticket should now be refunded → validate should 401
    const validate = await request(app)
      .post('/api/tickets/validate')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ qrPayload });
    expect(validate.status).toBe(401);
    expect(validate.body.message).toMatch(/refunded/i);

    // Seat should be available again
    const seatsRes = await request(app).get(`/api/sections/${section.id}/seats`);
    const seat = (seatsRes.body.data as any[]).find((s: any) => s.id === seats[0]!.id);
    expect(seat.status).toBe('available');
  });
});
