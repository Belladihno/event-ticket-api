import { Router, Request, Response, raw } from 'express';
import crypto from 'crypto';
import { config } from '../../config/app.config';
import { handleBachsWebhook, type BachsWebhookEvent } from './webhooks.service';

const router = Router();

// express.raw() keeps the body as a Buffer so the signature can be verified.
// This router must be mounted BEFORE the global express.json() middleware.
router.post(
  '/bachs',
  raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const rawBody = req.body as Buffer;
    const timestamp = req.headers['x-bachs-timestamp'] as string;
    const signature = req.headers['x-bachs-signature'] as string;

    if (!verifyBachsSignature(rawBody, config.bachs.webhookSecret, timestamp, signature)) {
      console.warn('[webhook] Invalid signature — request rejected');
      res.status(400).json({ status: 'error', message: 'Invalid signature' });
      return;
    }

    let event: BachsWebhookEvent;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      res.status(400).json({ status: 'error', message: 'Invalid JSON' });
      return;
    }

    // Return 200 immediately — heavy work runs asynchronously
    res.status(200).json({ received: true });

    handleBachsWebhook(event).catch((err) => {
      console.error('[webhook] Handler error:', err);
    });
  },
);

function verifyBachsSignature(
  rawBody: Buffer,
  secret: string,
  timestampHeader: string,
  signatureHeader: string,
  toleranceSeconds = 300,
): boolean {
  if (!secret || !signatureHeader) {
    return false;
  }
  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp)) {
    return false;
  }
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
    console.warn('[webhook] Stale timestamp rejected');
    return false;
  }
  const message = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(message, 'utf8').digest('hex');
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export default router;
