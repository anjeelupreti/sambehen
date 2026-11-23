import { Controller, Get, Query } from '@nestjs/common';
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
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CustomerAuth } from '@common/decorators/composite-auth.decorator';
import { CurrentCustomer } from '@common/decorators/auth.decorators';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ApiOkData, ApiErrors } from '@common/swagger/api-response.decorators';
import { ICurrentCustomer } from '@common/interfaces/auth.interface';
import { CustomerRepository } from '@database/repositories/customer.repository';
import { TransactionRepository } from '@database/repositories/transaction.repository';
import { TransactionType } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import { ResourceNotFoundException } from '@common/exceptions/business.exception';
import { CustomerProfileDto } from '@modules/auth/dto/auth.dto';
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

    return {
      id: customer.id,
      email: customer.email,
      username: customer.username,
      fullName: customer.fullName,
      status: customer.status,
      balance: customer.balance,
      bonusBalance: customer.bonusBalance,
      lastLoginAt: customer.lastLoginAt,
    };
  }
}
