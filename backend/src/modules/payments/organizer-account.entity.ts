import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, Index } from 'typeorm';
import { generateId } from '../../common/utils/uuid.util';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../users/user.entity';

@Entity('organizer_accounts')
export class OrganizerAccount extends BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string = generateId();

  @Index({ unique: true })
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizer_id' })
  organizer: User;

  @Column({ name: 'payouts_enabled', type: 'boolean', default: false })
  payoutsEnabled: boolean;

  @Column({ name: 'details_submitted', type: 'boolean', default: false })
  detailsSubmitted: boolean;

  @Column({ name: 'bank_account_last4', type: 'varchar', length: 4, nullable: true })
  bankAccountLast4: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName: string | null;

  @Column({ name: 'payouts_enabled_at', type: 'datetime', nullable: true })
  payoutsEnabledAt: Date | null;
}
