import crypto from 'crypto';
import { config } from '../../config/app.config';

export interface QrPayload {
  ticketId: string;
  userId: string;
  eventId: string;
  signature: string;
}

export function signQrPayload(ticketId: string, userId: string, eventId: string): QrPayload {
  const data = `${ticketId}:${userId}:${eventId}`;
  const signature = crypto.createHmac('sha256', config.qrSigningSecret).update(data).digest('hex');
  return { ticketId, userId, eventId, signature };
}

export function verifyQrPayload(payload: QrPayload): boolean {
  const data = `${payload.ticketId}:${payload.userId}:${payload.eventId}`;
  const expectedSignature = crypto.createHmac('sha256', config.qrSigningSecret).update(data).digest('hex');
  return payload.signature === expectedSignature;
}
