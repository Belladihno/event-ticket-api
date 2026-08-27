import { Worker } from 'bullmq';
import { Repository } from 'typeorm';
import { Notification, NotificationStatus, NotificationType } from './notification.entity';
import { Event } from '../events/event.entity';
import { Ticket } from '../tickets/ticket.entity';
import { AppDataSource } from '../../config/database.config';
import { emailProvider } from '../../providers/email/email.provider';
import {
  NotificationJobName,
  createQueueConnection,
  type BookingConfirmationJobData,
  type EventReminderJobData,
  type PaymentFailedJobData,
  type SendEmailJobData,
  type RefundIssuedJobData,
} from './notification.queue';
import {
  bookingConfirmationHtml,
  eventReminderHtml,
  paymentFailedHtml,
  refundIssuedHtml,
} from './notification.email';

interface BookingPayload {
  eventTitle: string;
  eventStartTime: string;
  venueName: string;
  seatCount: number;
  ticketUrl: string;
}

interface PaymentFailedPayload {
  eventTitle: string;
  amount: string;
}

async function handleBookingConfirmation(data: BookingConfirmationJobData): Promise<void> {
  const notificationRepo: Repository<Notification> = AppDataSource.getRepository(Notification);
  const notification = await notificationRepo.findOne({
    where: { id: data.notificationId },
    relations: ['user'],
  });
  if (!notification) return;

  const payload = notification.payload as unknown as BookingPayload;

  try {
    await emailProvider.send({
      to: notification.user.email,
      subject: `Your ticket is ready for ${payload.eventTitle}`,
      html: bookingConfirmationHtml(payload),
    });
    notification.status = NotificationStatus.SENT;
    notification.sentAt = new Date();
    notification.errorMessage = undefined as unknown as string;
    await notificationRepo.save(notification);
  } catch (err) {
    notification.status = NotificationStatus.FAILED;
    notification.errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await notificationRepo.save(notification);
    throw err;
  }
}

async function handlePaymentFailed(data: PaymentFailedJobData): Promise<void> {
  const notificationRepo: Repository<Notification> = AppDataSource.getRepository(Notification);
  const notification = await notificationRepo.findOne({
    where: { id: data.notificationId },
    relations: ['user'],
  });
  if (!notification) return;

  const payload = notification.payload as unknown as PaymentFailedPayload;

  try {
    await emailProvider.send({
      to: notification.user.email,
      subject: `Payment failed for ${payload.eventTitle}`,
      html: paymentFailedHtml(payload),
    });
    notification.status = NotificationStatus.SENT;
    notification.sentAt = new Date();
    notification.errorMessage = undefined as unknown as string;
    await notificationRepo.save(notification);
  } catch (err) {
    notification.status = NotificationStatus.FAILED;
    notification.errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await notificationRepo.save(notification);
    throw err;
  }
}

async function handleRefundIssued(data: RefundIssuedJobData): Promise<void> {
  const notificationRepo: Repository<Notification> = AppDataSource.getRepository(Notification);
  const notification = await notificationRepo.findOne({
    where: { id: data.notificationId },
    relations: ['user'],
  });
  if (!notification) return;

  const payload = notification.payload as unknown as PaymentFailedPayload;

  try {
    await emailProvider.send({
      to: notification.user.email,
      subject: `Refund issued for ${payload.eventTitle}`,
      html: refundIssuedHtml(payload),
    });
    notification.status = NotificationStatus.SENT;
    notification.sentAt = new Date();
    notification.errorMessage = undefined as unknown as string;
    await notificationRepo.save(notification);
  } catch (err) {
    notification.status = NotificationStatus.FAILED;
    notification.errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await notificationRepo.save(notification);
    throw err;
  }
}

async function handleEventReminder(data: EventReminderJobData): Promise<void> {
  const eventRepo: Repository<Event> = AppDataSource.getRepository(Event);
  const ticketRepo: Repository<Ticket> = AppDataSource.getRepository(Ticket);
  const notificationRepo: Repository<Notification> = AppDataSource.getRepository(Notification);

  const event = await eventRepo.findOne({ where: { id: data.eventId }, relations: ['venue'] });
  if (!event) return;

  const tickets = await ticketRepo.find({
    where: { event: { id: data.eventId } },
    relations: ['user', 'seat', 'seat.section'],
  });

  const seen = new Set<string>();
  for (const ticket of tickets) {
    const user = ticket.user;
    if (!user || seen.has(user.id)) continue;
    seen.add(user.id);

    const html = eventReminderHtml({
      eventTitle: event.title,
      eventStartTime: event.startTime.toISOString(),
      venueName: event.venue?.name ?? '',
    });

    const notification = notificationRepo.create({
      user,
      type: NotificationType.EVENT_REMINDER,
      status: NotificationStatus.QUEUED,
      payload: {
        eventId: event.id,
        eventTitle: event.title,
        eventStartTime: event.startTime,
        venueName: event.venue?.name ?? '',
      },
    });
    await notificationRepo.save(notification);

    try {
      await emailProvider.send({
        to: user.email,
        subject: `Reminder: ${event.title} is coming up`,
        html,
      });
      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
      notification.errorMessage = undefined as unknown as string;
      await notificationRepo.save(notification);
    } catch (err) {
      notification.status = NotificationStatus.FAILED;
      notification.errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await notificationRepo.save(notification);
    }
  }
}

async function handleSendEmail(data: SendEmailJobData): Promise<void> {
  await emailProvider.send({
    to: data.to,
    subject: data.subject,
    html: data.html,
  });
}

export function startNotificationWorker(): Worker {
  const worker = new Worker(
    'notifications',
    async (job) => {
      switch (job.name) {
        case NotificationJobName.BOOKING_CONFIRMATION:
          await handleBookingConfirmation(job.data as BookingConfirmationJobData);
          break;
        case NotificationJobName.EVENT_REMINDER:
          await handleEventReminder(job.data as EventReminderJobData);
          break;
        case NotificationJobName.PAYMENT_FAILED:
          await handlePaymentFailed(job.data as PaymentFailedJobData);
          break;
        case NotificationJobName.REFUND_ISSUED:
          await handleRefundIssued(job.data as RefundIssuedJobData);
          break;
        case NotificationJobName.SEND_EMAIL:
          await handleSendEmail(job.data as SendEmailJobData);
          break;
        default:
          console.log(`[notifications] Unknown job type: ${job.name}`);
      }
    },
    {
      connection: createQueueConnection(),
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[notifications] Job ${job.id} (${job.name}) completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[notifications] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  return worker;
}
