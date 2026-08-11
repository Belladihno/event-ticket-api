import { In, Repository } from 'typeorm';
import { Reservation, ReservationStatus } from '../reservations/reservation.entity';
import { Seat, SeatStatus } from '../seats/seat.entity';
import { Payment, PaymentStatus } from './payment.entity';
import { ProcessedEvent } from './processed-event.entity';
import { AppDataSource } from '../../config/database.config';

export interface BachsWebhookEvent {
  id: string;
  type: string;
  created_at: string;
  organization_id: string;
  data: Record<string, unknown>;
}

type BachsMetadata = {
  userId?: string;
  sectionId?: string;
  eventId?: string;
  reservationIds?: string;
  seatIds?: string;
};

export async function handleBachsWebhook(event: BachsWebhookEvent): Promise<void> {
  const processedRepo: Repository<ProcessedEvent> = AppDataSource.getRepository(ProcessedEvent);

  const alreadyProcessed = await processedRepo.findOne({ where: { eventId: event.id } });
  if (alreadyProcessed) {
    console.log(`[webhook] Duplicate event ${event.id} — skipping`);
    return;
  }
  await processedRepo.save(processedRepo.create({ eventId: event.id, type: event.type }));

  console.log(`[webhook] Processing event: ${event.type} (${event.id})`);

  switch (event.type) {
    case 'collection.succeeded':
      await onPaymentSucceeded(event);
      break;
    case 'collection.failed':
      await onPaymentFailed(event);
      break;
    case 'checkout.expired':
      await onCheckoutExpired(event);
      break;
    default:
      console.log(`[webhook] Unhandled event type: ${event.type}`);
  }
}

async function onPaymentSucceeded(event: BachsWebhookEvent) {
  const reservationRepo: Repository<Reservation> = AppDataSource.getRepository(Reservation);
  const seatRepo: Repository<Seat> = AppDataSource.getRepository(Seat);
  const paymentRepo: Repository<Payment> = AppDataSource.getRepository(Payment);

  const metadata = (event.data.metadata ?? {}) as BachsMetadata;
  if (!metadata.reservationIds || !metadata.seatIds) {
    console.error('[webhook] collection.succeeded missing metadata');
    return;
  }
  const reservationIds = metadata.reservationIds.split(',');
  const seatIds = metadata.seatIds.split(',');

  await AppDataSource.transaction(async (manager) => {
    await manager.update(
      Reservation,
      { id: In(reservationIds), status: ReservationStatus.PENDING },
      { status: ReservationStatus.CONFIRMED },
    );
    await manager.update(
      Seat,
      { id: In(seatIds), status: SeatStatus.RESERVED },
      { status: SeatStatus.BOOKED },
    );
    const payment = manager.create(Payment);
    payment.user = { id: metadata.userId } as Payment['user'];
    const amountValue = (event.data.amount as string | number | undefined)?.toString() ?? '0';
    payment.amount = amountValue as unknown as number;
    payment.currency = (event.data.currency as string | undefined) ?? 'NGN';
    payment.provider = 'bachs';
    payment.providerReference = event.data.id as string;
    payment.status = PaymentStatus.SUCCESSFUL;
    payment.idempotencyKey = event.id;
    await manager.save(payment);
  });

  console.log(`[webhook] Payment confirmed — seats ${seatIds.join(', ')} booked`);
}

async function onPaymentFailed(event: BachsWebhookEvent) {
  const metadata = (event.data.metadata ?? {}) as BachsMetadata;
  if (!metadata.reservationIds || !metadata.seatIds) {
    console.error('[webhook] collection.failed missing metadata');
    return;
  }
  const reservationIds = metadata.reservationIds.split(',');
  const seatIds = metadata.seatIds.split(',');

  await releaseHold(reservationIds, seatIds);
  console.log(`[webhook] Payment failed — seats ${seatIds.join(', ')} released`);
}

async function onCheckoutExpired(event: BachsWebhookEvent) {
  const metadata = (event.data.metadata ?? {}) as BachsMetadata;
  if (!metadata.reservationIds || !metadata.seatIds) {
    console.error('[webhook] checkout.expired missing metadata');
    return;
  }
  const reservationIds = metadata.reservationIds.split(',');
  const seatIds = metadata.seatIds.split(',');

  await releaseHold(reservationIds, seatIds);
  console.log(`[webhook] Checkout expired — seats ${seatIds.join(', ')} released`);
}

async function releaseHold(reservationIds: string[], seatIds: string[]) {
  const reservationRepo: Repository<Reservation> = AppDataSource.getRepository(Reservation);
  const seatRepo: Repository<Seat> = AppDataSource.getRepository(Seat);

  await AppDataSource.transaction(async (manager) => {
    await manager.update(
      Reservation,
      { id: In(reservationIds), status: ReservationStatus.PENDING },
      { status: ReservationStatus.EXPIRED },
    );
    await manager.update(
      Seat,
      { id: In(seatIds), status: SeatStatus.RESERVED },
      { status: SeatStatus.AVAILABLE },
    );
  });
}
