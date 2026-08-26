import { SmtpEmailProvider } from './smtp-email.provider';
import type { EmailProvider } from './email.interface';

export const emailProvider: EmailProvider = new SmtpEmailProvider();
