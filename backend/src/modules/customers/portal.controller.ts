import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiProperty,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiResponseDto } from '@common/dto/api-response.dto';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CustomerAuth } from '@common/decorators/composite-auth.decorator';
import { CurrentCustomer } from '@common/decorators/auth.decorators';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ApiOkData, ApiErrors } from '@common/swagger/api-response.decorators';
import { ICurrentCustomer } from '@common/interfaces/auth.interface';
import { CustomerRepository } from '@database/repositories/customer.repository';
import { TransactionRepository } from '@database/repositories/transaction.repository';
import { TransactionType } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import {
  ValidationException,
  ResourceNotFoundException,
} from '@common/exceptions/business.exception';
import { CustomerProfileDto } from '@modules/auth/dto/auth.dto';
import { Customer } from '@database/schema/customers.schema';
import { MilestoneDto, MilestonesService } from './milestones.service';

/**
 * Customer-facing portal.
 *
 * Read-only by design. Customers cannot update their profile, credentials
 * or status: those are performed by the master, their manager, or their
 * store, and are audit-logged. There is deliberately no PATCH here — the
 * absence is the requirement, not an omission.
 *
 * Every route resolves the customer from the authenticated token, never
 * from a path parameter, so one customer cannot address another's data.
 *
 * Grows in later phases with VIP status, transactions, referral details,
 * recent winners and messaging.
 */
class MyTransactionsQueryDto {
  @ApiProperty({ required: false, minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

/**
 * What a player may change about themselves. Email and username are how
 * they sign in, so those stay with staff; so do status and money.
 */
export class UpdateMyProfileDto {
  @ApiProperty({ required: false, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName?: string;

  @ApiProperty({ required: false, maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiProperty({ required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiProperty({ required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiProperty({ required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    description: 'A photo uploaded through the portal, or null to remove it.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  avatarUrl?: string | null;
}

export class MyTransactionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: TransactionType, description: 'debit = money in, credit = money out' })
  type!: TransactionType;

  @ApiProperty({ type: String, example: '120.00' })
  amount!: string;

  @ApiProperty({ type: String, nullable: true })
  gameName!: string | null;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: Date;

  @ApiProperty({ description: 'A credit that corrects an earlier entry, not a withdrawal.' })
  isCorrection!: boolean;
}

@ApiTags('Customer Portal')
@Controller('me')
export class PortalController {
  constructor(
    private readonly config: ConfigService,
    private readonly customerRepository: CustomerRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly milestonesService: MilestonesService,
  ) {}

  @Get('milestones')
  @CustomerAuth()
  @ResponseMessage('Milestones retrieved successfully')
  @ApiOperation({
    summary: "The signed-in customer's milestones",
    description:
      'Earned and upcoming milestones: joining, first message, referrals, reaching VIP and time with the store. None are based on amounts deposited.',
  })
  @ApiExtraModels(ApiResponseDto, MilestoneDto)
  @ApiOkResponse({
    description: 'Milestones retrieved successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        { properties: { data: { type: 'array', items: { $ref: getSchemaPath(MilestoneDto) } } } },
      ],
    },
  })
  @ApiErrors(401, 404)
  milestones(@CurrentCustomer() actor: ICurrentCustomer): Promise<MilestoneDto[]> {
    return this.milestonesService.forCustomer(actor.id);
  }

  @Get('transactions')
  @CustomerAuth()
  @ResponseMessage('Transactions retrieved successfully')
  @ApiOperation({
    summary: "The signed-in customer's own recent transactions",
    description:
      'Newest first, at most 50. Scoped to the customer in the token; there is no way to ask for anyone else. Staff-only fields (channel, reference, note, who entered it) are omitted.',
  })
  @ApiExtraModels(ApiResponseDto, MyTransactionDto)
  @ApiOkResponse({
    description: 'Transactions retrieved successfully',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: { data: { type: 'array', items: { $ref: getSchemaPath(MyTransactionDto) } } },
        },
      ],
    },
  })
  @ApiErrors(401, 422)
  async transactions(
    @CurrentCustomer() actor: ICurrentCustomer,
    @Query() query: MyTransactionsQueryDto,
  ): Promise<MyTransactionDto[]> {
    return this.transactionRepository.recentForCustomer(actor.id, query.limit ?? 10);
  }

  @Get('profile')
  @CustomerAuth()
  @ResponseMessage('Profile retrieved successfully')
  @ApiOperation({
    summary: "The signed-in customer's own profile",
    description:
      "Read-only. Profile and credential changes are made by staff on the customer's behalf. Internal ownership fields (owning manager and store) are omitted, since the customer has no need to see the team structure behind their account.",
  })
  @ApiOkData(CustomerProfileDto)
  @ApiErrors(401, 404)
  async profile(@CurrentCustomer() actor: ICurrentCustomer): Promise<CustomerProfileDto> {
    // Read fresh rather than trusting the token: a status change or
    // profile edit made by staff must be visible immediately, not only
    // after the access token expires.
    const customer = await this.customerRepository.findById(actor.id);

    if (!customer) {
      throw new ResourceNotFoundException(ErrorCode.CUSTOMER_NOT_FOUND, 'Customer not found');
    }

    return this.toProfile(customer);
  }

  @Patch('profile')
  @CustomerAuth()
  @ResponseMessage('Profile updated')
  @ApiOperation({
    summary: 'Update the signed-in customer’s own profile',
    description:
      'Name, phone, location and photo. Email, username, status and money stay with staff. A photo must be one uploaded through the portal.',
  })
  @ApiOkData(CustomerProfileDto)
  @ApiErrors(401, 404, 422)
  async updateProfile(
    @CurrentCustomer() actor: ICurrentCustomer,
    @Body() body: UpdateMyProfileDto,
  ): Promise<CustomerProfileDto> {
    if (body.avatarUrl && !this.isPortalPhoto(body.avatarUrl)) {
      throw new ValidationException([
        {
          field: 'avatarUrl',
          constraint: 'portalPhoto',
          message: 'Upload a photo through your profile page.',
        },
      ]);
    }

    const blankToNull = (value?: string) =>
      value === undefined ? undefined : value.trim() === '' ? null : value.trim();
    const changes: Partial<Customer> = {
      ...(body.fullName !== undefined ? { fullName: body.fullName.trim() } : {}),
      ...(body.phone !== undefined ? { phone: blankToNull(body.phone) } : {}),
      ...(body.city !== undefined ? { city: blankToNull(body.city) } : {}),
      ...(body.state !== undefined ? { state: blankToNull(body.state) } : {}),
      ...(body.country !== undefined ? { country: blankToNull(body.country) } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
      updatedAt: new Date(),
    };

    const updated = await this.customerRepository.update(actor.id, changes);
    if (!updated) {
      throw new ResourceNotFoundException(ErrorCode.CUSTOMER_NOT_FOUND, 'Customer not found');
    }
    return this.toProfile(updated);
  }

  /**
   * Photos may only point at files this product stores: the demo
   * portraits, local uploads in development, or the R2 bucket. Anything
   * else (an arbitrary URL) would let a player load a third-party image,
   * or a tracking pixel, in every staff member's browser.
   */
  private isPortalPhoto(url: string): boolean {
    const file = /\/avatars\/[0-9a-f-]{36}\.(webp|jpg|png)$/;
    const r2 = (this.config.get<string>('R2_PUBLIC_URL') ?? '').replace(/\/+$/, '');
    return (
      /^\/avatars\/players\/\d{2}\.webp$/.test(url) ||
      (url.startsWith('/uploads/avatars/') && file.test(url)) ||
      (r2 !== '' && url.startsWith(`${r2}/avatars/`) && file.test(url))
    );
  }

  private toProfile(customer: Customer): CustomerProfileDto {
    return {
      id: customer.id,
      email: customer.email,
      username: customer.username,
      fullName: customer.fullName,
      avatarUrl: customer.avatarUrl,
      phone: customer.phone,
      city: customer.city,
      state: customer.state,
      country: customer.country,
      status: customer.status,
      balance: customer.balance,
      bonusBalance: customer.bonusBalance,
      lastLoginAt: customer.lastLoginAt,
    };
  }
}
