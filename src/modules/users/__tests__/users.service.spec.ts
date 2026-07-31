import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users.service';
import { UserRepository } from '@database/repositories/user.repository';
import { User } from '@database/schema/users.schema';
import { ConflictException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let repository: UserRepository;

  const mockUser: User = {
    id: 'f3a4bb40-5a3d-4c3e-8c31-c03565e317c2',
    email: 'test@dpay.com',
    username: 'testuser',
    passwordHash: 'hashed',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    isActive: true,
    isEmailVerified: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UserRepository,
          useValue: {
            findByEmail: jest.fn(),
            findByUsername: jest.fn(),
            create: jest.fn().mockResolvedValue(mockUser),
            findActiveUsers: jest.fn(),
            findById: jest.fn().mockResolvedValue(mockUser),
            update: jest.fn().mockResolvedValue(mockUser),
            softDelete: jest.fn().mockResolvedValue(mockUser),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<UserRepository>(UserRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ConflictException if email exists', async () => {
      jest.spyOn(repository, 'findByEmail').mockResolvedValueOnce(mockUser);
      await expect(
        service.create({
          email: 'test@dpay.com',
          username: 'testuser',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
