import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { generateId } from '../../common/utils/uuid.util';
import { BaseEntity } from '../../common/base.entity';
import { Event } from '../events/event.entity';

@Index(['event', 'name'])
@Entity('sections')
export class Section extends BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string = generateId();

  @ManyToOne(() => Event)
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'total_seats', type: 'int' })
  totalSeats: number;

  @Column({ name: 'bachs_product_id', type: 'varchar', nullable: true })
  bachsProductId: string;
}
