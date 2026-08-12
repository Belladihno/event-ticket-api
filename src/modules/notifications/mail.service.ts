import {
  notificationQueue,
  NotificationJobName,
  type SendEmailJobData,
} from './notification.queue';

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await notificationQueue.add(
      NotificationJobName.SEND_EMAIL,
      { to, subject, html } satisfies SendEmailJobData,
    );
  } catch (err) {
    console.error('[mail] Failed to enqueue email:', err);
  }
}
