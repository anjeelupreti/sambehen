import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRepository } from '@database/repositories/user.repository';
import { User } from '@database/schema/users.schema';
import { PaginationQueryDto } from '@common/dto/pagination.dto';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { HashUtil } from '@common/utils/hash.util';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingEmail = await this.userRepository.findByEmail(createUserDto.email);
    if (existingEmail) {
      throw new ConflictException(`User with email ${createUserDto.email} already exists`);
    }

    const existingUsername = await this.userRepository.findByUsername(createUserDto.username);
    if (existingUsername) {
      throw new ConflictException(`User with username ${createUserDto.username} already exists`);
    }

    const passwordHash = HashUtil.hashSha256(createUserDto.password);

    return this.userRepository.create({
      email: createUserDto.email,
      username: createUserDto.username,
      passwordHash,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      role: createUserDto.role || 'user',
      isActive: true,
      isEmailVerified: false,
    });
  }

  async findAll(paginationQuery: PaginationQueryDto): Promise<IPaginatedResult<User>> {
    return this.userRepository.findActiveUsers(paginationQuery);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user || user.deletedAt) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    await this.findOne(id);

    const updateData: Partial<User> = {};
    if (updateUserDto.firstName !== undefined) updateData.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName !== undefined) updateData.lastName = updateUserDto.lastName;
    if (updateUserDto.isActive !== undefined) updateData.isActive = updateUserDto.isActive;

    const updated = await this.userRepository.update(id, updateData);
    if (!updated) {
      throw new NotFoundException(`User with ID ${id} not found for update`);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.userRepository.softDelete(id);
  }
}
