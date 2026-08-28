import { Entity, PrimaryColumn, Column, ManyToOne, OneToOne, JoinColumn, Index } from 'typeorm';
import { generateId } from '../../common/utils/uuid.util';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../users/user.entity';
import { Reservation } from '../reservations/reservation.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Index(['eventId', 'status'])
@Entity('payments')
export class Payment extends BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string = generateId();

  @OneToOne(() => Reservation)
  @JoinColumn({ name: 'reservation_id' })
  reservation: Reservation;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', default: 'NGN' })
  currency: string;

  @Column({ type: 'varchar' })
  provider: string;

  @Column({ name: 'provider_reference', type: 'varchar', nullable: true })
  providerReference: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ name: 'idempotency_key', type: 'varchar', unique: true })
  idempotencyKey: string;

  // --- Connect sub-account fields (Phase 1) ---
  @Column({ name: 'bachs_connect_account_id', type: 'varchar', length: 50, nullable: true })
  bachsConnectAccountId: string | null;

  @Column({ name: 'platform_fee_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  platformFeeAmount: number | null;

  @Column({ name: 'bachs_refund_id', type: 'varchar', length: 50, nullable: true })
  bachsRefundId: string | null;

  @Column({ name: 'refund_status', type: 'varchar', default: 'none', nullable: true })
  refundStatus: 'none' | 'pending' | 'refunded' | 'refund_failed' | null;

  @Column({ name: 'refunded_at', type: 'datetime', nullable: true })
  refundedAt: Date | null;

  @Index()
  @Column({ name: 'bachs_session_id', type: 'varchar', length: 100, nullable: true })
  bachsSessionId: string | null;

  @Column({ name: 'bachs_checkout_url', type: 'varchar', length: 500, nullable: true })
  bachsCheckoutUrl: string | null;

  @Column({ name: 'event_title', type: 'varchar', length: 255, nullable: true })
  eventTitle: string | null;

  @Index()
  @Column({ name: 'promo_link_id', type: 'varchar', length: 100, nullable: true })
  promoLinkId: string | null;

  @Index()
  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId: string | null;
}
