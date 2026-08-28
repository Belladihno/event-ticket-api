import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { generateId } from '../../common/utils/uuid.util';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../users/user.entity';

export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

@Entity('payout_requests')
@Index(['organizer', 'createdAt'])
@Index(['organizer', 'status'])
export class PayoutRequest extends BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string = generateId();

  @Index()
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organizer_id' })
  organizer: User;

  @Column({ name: 'bachs_account_id', type: 'varchar', length: 100 })
  bachsAccountId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', default: 'pending' })
  status: PayoutStatus;

  @Index({ unique: true })
  @Column({ name: 'bachs_payout_id', type: 'varchar', length: 100, nullable: true })
  bachsPayoutId: string | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ name: 'arrived_at', type: 'datetime', nullable: true })
  arrivedAt: Date | null;
}
