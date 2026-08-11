import { Entity, PrimaryColumn, Column, ManyToOne, OneToOne, JoinColumn, Index } from 'typeorm';
import { generateId } from '../../common/utils/uuid.util';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../users/user.entity';
import { Seat } from '../seats/seat.entity';

export enum ReservationStatus {
  PENDING = 'pending',
  EXPIRED = 'expired',
  CONFIRMED = 'confirmed',
}

@Index(['user', 'createdAt'])
@Index(['status', 'expiresAt'])
@Entity('reservations')
export class Reservation extends BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string = generateId();

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToOne(() => Seat)
  @JoinColumn({ name: 'seat_id' })
  seat: Seat;

  @Column({ type: 'enum', enum: ReservationStatus, default: ReservationStatus.PENDING })
  status: ReservationStatus;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;
}
