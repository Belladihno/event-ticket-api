import { Entity, PrimaryColumn, Column } from 'typeorm';
import { generateId } from '../../common/utils/uuid.util';
import { BaseEntity } from '../../common/base.entity';

@Entity('processed_webhook_events')
export class ProcessedEvent extends BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string = generateId();

  @Column({ name: 'event_id', type: 'varchar', unique: true })
  eventId: string;

  @Column({ type: 'varchar' })
  type: string;
}
