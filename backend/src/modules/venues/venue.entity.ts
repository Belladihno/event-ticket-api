import { Entity, PrimaryColumn, Column, Index } from 'typeorm';
import { generateId } from '../../common/utils/uuid.util';
import { BaseEntity } from '../../common/base.entity';

@Index(['createdAt'])
@Index(['city'])
@Entity('venues')
export class Venue extends BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string = generateId();

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  address: string;

  @Column({ type: 'varchar' })
  city: string;

  @Column({ type: 'int' })
  capacity: number;
}
