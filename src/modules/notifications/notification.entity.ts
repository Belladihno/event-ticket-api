import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { generateId } from '../../common/utils/uuid.util';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../users/user.entity';

export enum NotificationType {
  BOOKING_CONFIRMATION = 'booking_confirmation',
  EVENT_REMINDER = 'event_reminder',
  PAYMENT_FAILED = 'payment_failed',
}

export enum NotificationStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  FAILED = 'failed',
}

@Index(['user', 'createdAt'])
@Entity('notifications')
export class Notification extends BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string = generateId();

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'json' })
  payload: Record<string, unknown>;

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.QUEUED })
  status: NotificationStatus;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;
}
