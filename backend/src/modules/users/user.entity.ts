import { Entity, PrimaryColumn, Column } from 'typeorm';
import { generateId } from '../../common/utils/uuid.util';
import { BaseEntity } from '../../common/base.entity';

export enum UserRole {
  CUSTOMER = 'customer',
  ORGANIZER = 'organizer',
  ADMIN = 'admin',
}

@Entity('users')
export class User extends BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string = generateId();

  @Column({ name: 'first_name', type: 'varchar' })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar' })
  lastName: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar' })
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;
}
