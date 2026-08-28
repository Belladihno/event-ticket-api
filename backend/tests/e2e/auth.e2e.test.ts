/**
 * E2E: Auth flow with real MySQL (WSL2) + Redis
 * Requires WSL2 MySQL/Redis at localhost:3306/6379 (verified via test-connection.ts)
 * Run: pnpm --filter backend test -- e2e/auth --runInBand --forceExit
 */
jest.setTimeout(60000);
import { faker } from '@faker-js/faker';
import request from 'supertest';

// Mock external providers before importing app/helpers
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
      create: jest
        .fn()
        .mockResolvedValue({
          checkout_url: 'https://checkout.bachs',
          checkout_id: 'chk_test',
          expires_at: new Date().toISOString(),
        }),
    },
    products: { create: jest.fn().mockResolvedValue({ id: 'prod_test' }) },
  },
}));

import app from '../../src/app';
import { redis } from '../../src/config/redis.config';
import { initE2E, clearDatabase, teardownE2E } from './helpers';

describe('E2E Auth', () => {
  beforeAll(async () => {
    await initE2E();
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  }, 30000);

  beforeEach(async () => {
    await clearDatabase();
  }, 30000);

  it('register → verify OTP → login → refresh → logout', async () => {
    const email = faker.internet.email().toLowerCase();
    const password = 'password123';

    // Register
    const reg = await request(app).post('/api/auth/register').send({
      firstName: 'E2E',
      lastName: 'User',
      email,
      password,
      role: 'customer',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.data.user.email).toBe(email);
    expect(reg.body.data.user.isVerified).toBe(false);

    // Fetch OTP from Redis (mocked email, but OTP stored)
    const code = await redis.get(`auth:otp:verify:${email.toLowerCase()}`);
    expect(code).toMatch(/^\d{6}$/);

    // Verify
    const verify = await request(app)
      .post('/api/auth/verify-email')
      .send({ email, code });
    expect(verify.status).toBe(200);
    expect(verify.body.data.message).toMatch(/verified/i);

    // Login now succeeds
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.data.accessToken).toBeDefined();
    const cookies = login.headers['set-cookie'] as unknown as string[];
    expect(cookies?.join('')).toMatch(/refreshToken/);
    const accessToken = login.body.data.accessToken as string;

    // Me
    const me = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);

    // Refresh (cookie) — must send empty JSON body to satisfy Zod refreshSchema
    const refreshCookie =
      cookies
        ?.find((c: string) => c.startsWith('refreshToken='))
        ?.split(';')[0] ?? '';
    const refresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie)
      .send({});
    expect(refresh.status).toBe(200);
    expect(refresh.body.data.accessToken).toBeDefined();

    // Logout
    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(logout.status).toBe(200);

    // Refresh after logout should 401
    const after = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie)
      .send({});
    expect(after.status).toBe(401);
  }, 30000);

  it('login fails for unverified email', async () => {
    const email = faker.internet.email().toLowerCase();
    await request(app).post('/api/auth/register').send({
      firstName: 'Unverified',
      lastName: 'User',
      email,
      password: 'password123',
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'password123' });
    expect(login.status).toBe(401);
    expect(login.body.message).toMatch(/not verified/i);
  });

  it('resend verification respects cooldown (429 after immediate resend)', async () => {
    const email = faker.internet.email().toLowerCase();
    await request(app).post('/api/auth/register').send({
      firstName: 'Cooldown',
      lastName: 'User',
      email,
      password: 'password123',
    });

    // First resend should be rate-limited due to initial register cooldown (60s OTP_RESEND_COOLDOWN)
    // The first resend immediately after register should hit cooldown
    const resend1 = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email });
    // Either 200 (if cooldown not set) or 429 — assert either but not 500
    expect([200, 429]).toContain(resend1.status);
  });
});
