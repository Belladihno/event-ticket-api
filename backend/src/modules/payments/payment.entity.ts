import { Entity, PrimaryColumn, Column, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { generateId } from '../../common/utils/uuid.util';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../users/user.entity';
import { Reservation } from '../reservations/reservation.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
}

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
}
