import { Entity, PrimaryColumn, Column, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { generateId } from '../../common/utils/uuid.util';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';
import { Seat } from '../seats/seat.entity';
import { Reservation } from '../reservations/reservation.entity';

@Entity('tickets')
export class Ticket extends BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string = generateId();

  @OneToOne(() => Reservation)
  @JoinColumn({ name: 'reservation_id' })
  reservation: Reservation;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Event)
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @OneToOne(() => Seat)
  @JoinColumn({ name: 'seat_id' })
  seat: Seat;

  @Column({ name: 'qr_payload', type: 'text' })
  qrPayload: string;

  @Column({ name: 'ticket_url', type: 'varchar' })
  ticketUrl: string;

  @Column({ name: 'is_used', type: 'boolean', default: false })
  isUsed: boolean;

  @Column({ name: 'used_at', type: 'datetime', nullable: true })
  usedAt: Date;

  @Column({ name: 'is_refunded', type: 'boolean', default: false })
  isRefunded: boolean;

  @Column({ name: 'refunded_at', type: 'datetime', nullable: true })
  refundedAt: Date;
}
