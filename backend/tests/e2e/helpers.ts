import { AppDataSource } from '../../src/config/database.config';
import { redis } from '../../src/config/redis.config';
import IORedis from 'ioredis';
import crypto from 'crypto';
import { config } from '../../src/config/app.config';
import { hashPassword } from '../../src/common/utils/hash.util';
import { generateId } from '../../src/common/utils/uuid.util';
import { User } from '../../src/modules/users/user.entity';
import { Venue } from '../../src/modules/venues/venue.entity';
import { Event, EventStatus } from '../../src/modules/events/event.entity';
import { Section } from '../../src/modules/sections/section.entity';
import { Seat, SeatStatus } from '../../src/modules/seats/seat.entity';
import request from 'supertest';
import app from '../../src/app';

let initialized = false;

export async function initE2E(): Promise<void> {
  if (initialized && AppDataSource.isInitialized) return;

  // Ensure test DB exists — create event_ticketing_test if needed
  // Use the same connection but switch database via query
  if (!AppDataSource.isInitialized) {
    // Try to initialize with configured DB (event_ticketing)
    // For isolation, we use the same DB but truncate between tests
    await AppDataSource.initialize();
    await AppDataSource.runMigrations();
  }
  initialized = true;
}

export async function clearDatabase(): Promise<void> {
  if (!AppDataSource.isInitialized) return;

  // Disable FK checks, truncate all tables, re-enable
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    await queryRunner.query('SET FOREIGN_KEY_CHECKS=0');
    const tables = [
      'tickets',
      'payments',
      'processed_webhook_events',
      'reservations',
      'seats',
      'sections',
      'events',
      'favorites',
      'notifications',
      'venues',
      'users',
    ];
    for (const table of tables) {
      try {
        await queryRunner.query(`TRUNCATE TABLE \`${table}\``);
      } catch {}
    }
    await queryRunner.query('SET FOREIGN_KEY_CHECKS=1');
  } finally {
    try {
      await queryRunner.release();
    } catch {}
  }

  // Clear Redis — use a fresh client so it works even if shared redis was quit
  let tempRedis: IORedis | null = null;
  try {
    tempRedis = new IORedis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    await tempRedis.connect();
    await tempRedis.flushdb();
    await tempRedis.quit();
  } catch {
    try {
      await redis.flushdb();
    } catch {}
  } finally {
    if (tempRedis) try { await tempRedis.quit(); } catch {}
  }
}

export async function teardownE2E(): Promise<void> {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  } catch {}
  try {
    await redis.quit();
  } catch {}
  try {
    const { notificationQueue } = await import('../../src/modules/notifications/notification.queue');
    await notificationQueue.close();
  } catch {}
  initialized = false;
}

export async function createTestUser(overrides: Omit<Partial<User>, 'role'> & { role?: any } = {}): Promise<User> {
  const repo = AppDataSource.getRepository(User);
  const user = repo.create({
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    email: overrides.email ?? `test-${generateId()}@example.com`,
    password: await hashPassword(overrides.password ?? 'password123'),
    role: (overrides.role ?? 'customer') as any,
    isVerified: overrides.isVerified ?? true,
  });
  return repo.save(user);
}

export async function createTestVenue(overrides: Partial<Venue> = {}): Promise<Venue> {
  const repo = AppDataSource.getRepository(Venue);
  const venue = repo.create({
    name: overrides.name ?? 'Test Venue',
    address: overrides.address ?? '123 Test St',
    city: overrides.city ?? 'Lagos',
    capacity: overrides.capacity ?? 1000,
  });
  return repo.save(venue);
}

export async function createTestEvent(organizerId: string, venueId: string, overrides: Omit<Partial<Event>, 'status'> & { status?: any } = {}): Promise<Event> {
  const venueRepo = AppDataSource.getRepository(Venue);
  const eventRepo = AppDataSource.getRepository(Event);
  const venue = await venueRepo.findOne({ where: { id: venueId } });
  if (!venue) throw new Error('Venue not found');
  const event = eventRepo.create({
    organizer: { id: organizerId } as any,
    venue,
    title: overrides.title ?? `Event ${generateId()}`,
    description: overrides.description ?? 'Test event',
    startTime: overrides.startTime ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    endTime: overrides.endTime ?? new Date(Date.now() + 25 * 60 * 60 * 1000),
    status: overrides.status ?? EventStatus.PUBLISHED,
    bannerImageUrl: overrides.bannerImageUrl ?? null,
  } as any) as unknown as Event;
  return eventRepo.save(event as any);
}

export async function createTestSection(eventId: string, overrides: Partial<Section> = {}): Promise<Section> {
  const eventRepo = AppDataSource.getRepository(Event);
  const sectionRepo = AppDataSource.getRepository(Section);
  const event = await eventRepo.findOne({ where: { id: eventId } });
  if (!event) throw new Error('Event not found');
  const section = sectionRepo.create({
    event,
    name: overrides.name ?? `Section-${generateId().slice(0, 4)}`,
    price: (overrides.price as any) ?? 50000,
    totalSeats: overrides.totalSeats ?? 10,
    bachsProductId: overrides.bachsProductId ?? `prod_${generateId()}`,
  } as any) as unknown as Section;
  return sectionRepo.save(section as any);
}

export async function createTestSeats(sectionId: string, count: number): Promise<Seat[]> {
  const sectionRepo = AppDataSource.getRepository(Section);
  const seatRepo = AppDataSource.getRepository(Seat);
  const section = await sectionRepo.findOne({ where: { id: sectionId } });
  if (!section) throw new Error('Section not found');
  const seats: Seat[] = [];
  for (let i = 0; i < count; i++) {
    const seat = seatRepo.create({
      section,
      seatNumber: `A${i + 1}`,
      status: SeatStatus.AVAILABLE,
    } as any) as unknown as Seat;
    seats.push(seat);
  }
  return seatRepo.save(seats as any);
}

export async function loginAs(email: string, password = 'password123'): Promise<{ token: string; user: any }> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.data.accessToken, user: res.body.data.user };
}

export function authHeader(token: string): string {
  return `Bearer ${token}`;
}

// HMAC helper for webhook tests (mirrors backend/src/modules/payments/webhooks.controller.ts)
export function signWebhook(body: Buffer, timestamp: string): string {
  const secret = config.bachs.webhookSecret || 'test_webhook_secret';
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body.toString('utf8')}`, 'utf8').digest('hex');
}
