import { Repository } from 'typeorm';
import { Notification, NotificationStatus, NotificationType } from './notification.entity';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';
import { AppDataSource } from '../../config/database.config';
import {
  notificationQueue,
  NotificationJobName,
  type BookingConfirmationJobData,
  type EventReminderJobData,
  type PaymentFailedJobData,
  type RefundIssuedJobData,
} from './notification.queue';

interface BookingTicket {
  id: string;
  ticketUrl: string;
}

export class NotificationsService {
  private notificationRepo: Repository<Notification>;
  private userRepo: Repository<User>;
  private eventRepo: Repository<Event>;

  constructor() {
    this.notificationRepo = AppDataSource.getRepository(Notification);
    this.userRepo = AppDataSource.getRepository(User);
    this.eventRepo = AppDataSource.getRepository(Event);
  }

  async enqueueBookingConfirmation(userId: string, eventId: string, tickets: BookingTicket[]) {
    const event = await this.eventRepo.findOne({ where: { id: eventId }, relations: ['venue'] });
    if (!event) return;

    const notification = this.notificationRepo.create({
      user: { id: userId } as User,
      type: NotificationType.BOOKING_CONFIRMATION,
      status: NotificationStatus.QUEUED,
      payload: {
        eventId: event.id,
        eventTitle: event.title,
        eventStartTime: event.startTime,
        venueName: event.venue?.name ?? '',
        seatCount: tickets.length,
        ticketIds: tickets.map((t) => t.id),
        ticketUrl: tickets[0]?.ticketUrl ?? '',
      },
    });
    await this.notificationRepo.save(notification);

    await notificationQueue.add(
      NotificationJobName.BOOKING_CONFIRMATION,
      { notificationId: notification.id } satisfies BookingConfirmationJobData,
    );
  }

  async scheduleEventReminder(eventId: string, startTime: Date) {
    const delay = Math.max(0, startTime.getTime() - 24 * 60 * 60 * 1000 - Date.now());
    await notificationQueue.add(
      NotificationJobName.EVENT_REMINDER,
      { eventId } satisfies EventReminderJobData,
      { delay },
    );
  }

  async enqueuePaymentFailed(userId: string, eventId: string, amount: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) return;

    const notification = this.notificationRepo.create({
      user: { id: userId } as User,
      type: NotificationType.PAYMENT_FAILED,
      status: NotificationStatus.QUEUED,
      payload: {
        eventId: event.id,
        eventTitle: event.title,
        amount,
      },
    });
    await this.notificationRepo.save(notification);

    await notificationQueue.add(
      NotificationJobName.PAYMENT_FAILED,
      { notificationId: notification.id } satisfies PaymentFailedJobData,
    );
  }

  async enqueueRefundIssued(userId: string, eventId: string, amount: string, reservationIds: string[]) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) return;

    const notification = this.notificationRepo.create({
      user: { id: userId } as User,
      type: NotificationType.REFUND_ISSUED,
      status: NotificationStatus.QUEUED,
      payload: {
        eventId: event.id,
        eventTitle: event.title,
        amount,
        reservationIds,
      },
    });
    await this.notificationRepo.save(notification);

    await notificationQueue.add(
      NotificationJobName.REFUND_ISSUED,
      { notificationId: notification.id } satisfies RefundIssuedJobData,
    );
  }
}
