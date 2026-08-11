import { In, Repository } from 'typeorm';
import { Section } from '../sections/section.entity';
import { Seat, SeatStatus } from '../seats/seat.entity';
import { User } from '../users/user.entity';
import { EventStatus } from '../events/event.entity';
import { AppDataSource } from '../../config/database.config';
import { config } from '../../config/app.config';
import { bachs } from '../../providers/bachs.provider';
import { AppError, ConflictError, NotFoundError } from '../../common/errors/AppError';
import { ReservationsService } from '../reservations/reservations.service';
import type { CreateCheckoutDto } from './payments.schema';

export class PaymentsService {
  private sectionRepo: Repository<Section>;
  private seatRepo: Repository<Seat>;
  private userRepo: Repository<User>;
  private reservationsService: ReservationsService;

  constructor() {
    this.sectionRepo = AppDataSource.getRepository(Section);
    this.seatRepo = AppDataSource.getRepository(Seat);
    this.userRepo = AppDataSource.getRepository(User);
    this.reservationsService = new ReservationsService();
  }

  async createCheckoutSession(userId: string, data: CreateCheckoutDto) {
    const section = await this.sectionRepo.findOne({ where: { id: data.sectionId }, relations: ['event'] });
    if (!section) {
      throw new NotFoundError('Section not found');
    }
    if (!section.bachsProductId) {
      throw new AppError(400, 'This section is not yet available for purchase');
    }
    if (section.event.status !== EventStatus.PUBLISHED) {
      throw new AppError(400, 'This event is not published');
    }

    const seats = await this.seatRepo.find({ where: { id: In(data.seatIds) }, relations: ['section'] });
    if (seats.length !== data.seatIds.length) {
      throw new NotFoundError('One or more seats not found');
    }
    const wrongSection = seats.find((seat) => seat.section.id !== section.id);
    if (wrongSection) {
      throw new AppError(400, 'All seats must belong to the selected section');
    }
    const unavailable = seats.find((seat) => seat.status !== SeatStatus.AVAILABLE);
    if (unavailable) {
      throw new ConflictError(`Seat ${unavailable.seatNumber} is not available`);
    }

    const reservations = await this.reservationsService.create(userId, { seatIds: data.seatIds });

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const reference = `order_${reservations[0]!.id}`;
    const session = await bachs.checkout.create({
      product_cart: [{ product_id: section.bachsProductId, quantity: data.seatIds.length }],
      customer: { email: user.email, name: `${user.firstName} ${user.lastName}` },
      return_url: `${config.frontendUrl}/payment/success`,
      cancel_url: `${config.frontendUrl}/payment/cancelled`,
      reference,
      idempotencyKey: reference,
      metadata: {
        userId,
        sectionId: section.id,
        eventId: section.event.id,
        reservationIds: reservations.map((r) => r.id).join(','),
        seatIds: data.seatIds.join(','),
      },
      billing_currency: 'NGN',
      allowed_payment_method_types: ['card', 'bank_transfer'],
    });

    return {
      checkoutUrl: session.checkout_url,
      checkoutId: session.checkout_id,
      expiresAt: session.expires_at,
      reservationIds: reservations.map((r) => r.id),
    };
  }
}
