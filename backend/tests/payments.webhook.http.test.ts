import crypto from 'crypto';
import request from 'supertest';
import express from 'express';

jest.mock('../src/config/app.config', () => ({
  config: {
    bachs: { webhookSecret: 'whsec_test_secret' },
    supabase: { ticketsBucket: 'tickets', eventBannersBucket: 'event-banners' },
    jwt: { accessSecret: 'a', refreshSecret: 'b' },
    qrSigningSecret: 'qr',
  },
}));

const mockHandle = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/modules/payments/webhooks.service', () => ({
  handleBachsWebhook: (...args: any[]) => mockHandle(...args),
}));

import webhookRouter from '../src/modules/payments/webhooks.controller';

function sign(timestamp: string, body: Buffer, secret: string) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body.toString('utf8')}`, 'utf8').digest('hex');
}

describe('POST /api/webhooks/bachs — HMAC verification', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use('/api/webhooks', webhookRouter);
  });

  it('returns 200 and processes when signature valid', async () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'collection.succeeded', data: { metadata: {} } });
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = sign(ts, Buffer.from(body), 'whsec_test_secret');

    const res = await request(app)
      .post('/api/webhooks/bachs')
      .set('X-Bachs-Timestamp', ts)
      .set('X-Bachs-Signature', sig)
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    await new Promise((r) => setImmediate(r));
    expect(mockHandle).toHaveBeenCalled();
  });

  it('rejects 400 when signature invalid', async () => {
    const body = JSON.stringify({ id: 'evt_2', type: 'collection.succeeded', data: {} });
    const ts = Math.floor(Date.now() / 1000).toString();

    const res = await request(app)
      .post('/api/webhooks/bachs')
      .set('X-Bachs-Timestamp', ts)
      .set('X-Bachs-Signature', 'bad')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(400);
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it('rejects 400 when timestamp stale (>300s)', async () => {
    const body = JSON.stringify({ id: 'evt_3', type: 'collection.succeeded', data: {} });
    const stale = (Math.floor(Date.now() / 1000) - 600).toString();
    const sig = sign(stale, Buffer.from(body), 'whsec_test_secret');

    const res = await request(app)
      .post('/api/webhooks/bachs')
      .set('X-Bachs-Timestamp', stale)
      .set('X-Bachs-Signature', sig)
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(400);
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it('rejects 400 when timestamp not numeric', async () => {
    const body = JSON.stringify({ id: 'evt_4', type: 'collection.succeeded', data: {} });
    const res = await request(app)
      .post('/api/webhooks/bachs')
      .set('X-Bachs-Timestamp', 'not-a-number')
      .set('X-Bachs-Signature', 'whatever')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(400);
  });

  it('rejects invalid JSON after valid signature', async () => {
    const raw = Buffer.from('{ not json ');
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = sign(ts, raw, 'whsec_test_secret');

    const res = await request(app)
      .post('/api/webhooks/bachs')
      .set('X-Bachs-Timestamp', ts)
      .set('X-Bachs-Signature', sig)
      .set('Content-Type', 'application/json')
      .send(raw);

    expect(res.status).toBe(400);
  });
});
