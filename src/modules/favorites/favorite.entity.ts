import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { generateId } from '../../common/utils/uuid.util';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';

@Index(['user', 'createdAt'])
@Unique(['user', 'event'])
@Entity('favorites')
export class Favorite extends BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string = generateId();

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Event)
  @JoinColumn({ name: 'event_id' })
  event: Event;
}