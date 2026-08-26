import nodemailer from 'nodemailer';
import { config } from '../../config/app.config';
import type { EmailMessage, EmailProvider } from './email.interface';

export class SmtpEmailProvider implements EmailProvider {
  private transporter = nodemailer.createTransport({
    host: config.email.smtpHost,
    port: config.email.smtpPort,
    secure: config.email.smtpPort === 465,
    auth: config.email.smtpUser
      ? { user: config.email.smtpUser, pass: config.email.smtpPass }
      : undefined,
  });

  async send(message: EmailMessage): Promise<void> {
    if (!config.email.smtpUser) {
      console.log(`[email:mock] to=${message.to} subject="${message.subject}"\n${message.html}`);
      return;
    }
    await this.transporter.sendMail({ from: config.email.mailFrom, ...message });
  }
}
