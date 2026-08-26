import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { generateId } from '../../common/utils/uuid.util';
import { BaseEntity } from '../../common/base.entity';
import { Section } from '../sections/section.entity';

export enum SeatStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  BOOKED = 'booked',
}

@Entity('seats')
@Unique(['section', 'seatNumber'])
export class Seat extends BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string = generateId();

  @ManyToOne(() => Section)
  @JoinColumn({ name: 'section_id' })
  section: Section;

  @Column({ name: 'seat_number', type: 'varchar' })
  seatNumber: string;

  @Column({ type: 'enum', enum: SeatStatus, default: SeatStatus.AVAILABLE })
  status: SeatStatus;
}
