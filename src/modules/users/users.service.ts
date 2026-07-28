import { Repository } from 'typeorm';
import { User } from './user.entity';
import { toUserResponse } from './user.mapper';
import { Event } from '../events/event.entity';
import { AppDataSource } from '../../config/database.config';
import { NotFoundError } from '../../common/errors/AppError';
import type { UpdateProfileDto } from './users.schema';

export class UsersService {
  private userRepo: Repository<User>;
  private eventRepo: Repository<Event>;

  constructor() {
    this.userRepo = AppDataSource.getRepository(User);
    this.eventRepo = AppDataSource.getRepository(Event);
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return toUserResponse(user);
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    if (data.firstName !== undefined) user.firstName = data.firstName;
    if (data.lastName !== undefined) user.lastName = data.lastName;
    await this.userRepo.save(user);
    return toUserResponse(user);
  }

  async getMyEvents(organizerId: string) {
    return this.eventRepo.find({
      where: { organizer: { id: organizerId } },
      relations: ['venue'],
      order: { createdAt: 'DESC' },
    });
  }
}
