import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../../config/app.config';

export enum NotificationJobName {
  BOOKING_CONFIRMATION = 'booking-confirmation',
  EVENT_REMINDER = 'event-reminder',
  PAYMENT_FAILED = 'payment-failed',
  SEND_EMAIL = 'send-email',
}

export interface BookingConfirmationJobData {
  notificationId: string;
}

export interface EventReminderJobData {
  eventId: string;
}

export interface PaymentFailedJobData {
  notificationId: string;
}

export interface SendEmailJobData {
  to: string;
  subject: string;
  html: string;
}

const redisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  maxRetriesPerRequest: null,
};

export function createQueueConnection(): IORedis {
  return new IORedis(redisOptions);
}

export const notificationQueue = new Queue('notifications', {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600, count: 1000 },
  },
});
