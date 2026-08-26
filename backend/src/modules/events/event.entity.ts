import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { generateId } from '../../common/utils/uuid.util';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../users/user.entity';
import { Venue } from '../venues/venue.entity';

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
}

@Index(['status', 'startTime'])
@Index(['organizer', 'createdAt'])
@Index(['title', 'description'], { fulltext: true })
@Entity('events')
export class Event extends BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string = generateId();

  @ManyToOne(() => User)
  @JoinColumn({ name: 'organizer_id' })
  organizer: User;

  @ManyToOne(() => Venue)
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'banner_image_url', type: 'varchar', nullable: true })
  bannerImageUrl: string;

  @Column({ name: 'start_time', type: 'datetime' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'datetime' })
  endTime: Date;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.DRAFT })
  status: EventStatus;
}
