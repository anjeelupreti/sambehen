import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { StaffRole } from '@common/constants/app.constants';
import { TeamAuth } from '@common/decorators/composite-auth.decorator';
import { CurrentStaff } from '@common/decorators/auth.decorators';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ParseUUIDPipe } from '@common/pipes/parse-uuid.pipe';
import {
  ApiOkData,
  ApiOkList,
  ApiCreatedData,
  ApiOkMessage,
  ApiErrors,
} from '@common/swagger/api-response.decorators';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionDto,
  CreateCorrectionDto,
  UpdateTransactionDto,
  TransactionFilterDto,
  TransactionResponseDto,
  TransactionSummaryDto,
} from './dto/transaction.dto';

/**
 * Transaction data entry.
 *
 * Money semantics, which every downstream figure depends on:
 *   debit  = money IN from the customer
 *   credit = money OUT to the customer
 *   a credit carrying parentTransactionId is a CORRECTION, not a
 *   withdrawal, and is excluded from `totalWithdrawn` everywhere.
 */
@ApiTags('Transactions')
@Controller('team/transactions')
@TeamAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ResponseMessage('Transaction recorded successfully')
  @ApiOperation({
    summary: 'Record a transaction',
    description:
      'The ledger row, the customer balance and the activity timestamp commit together, so the balance can never disagree with the ledger. The balance delta is computed in SQL, so concurrent entries cannot lose an update.',
  })
  @ApiCreatedData(TransactionResponseDto, 'Transaction recorded')
  @ApiErrors(401, 404, 422)
  create(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.create(actor, dto);
  }

  @Post(':id/correction')
  @ResponseMessage('Correction recorded successfully')
  @ApiParam({ name: 'id', format: 'uuid', description: 'The transaction being corrected' })
  @ApiOperation({
    summary: 'Correct a transaction',
    description:
      'Records a credit linked to the original rather than editing it, so history stays intact and the fix is visible as a fix. Because the row carries a parent it is excluded from totalWithdrawn — correcting a mis-keyed entry does not look like the customer took money out. Corrections against one parent may not exceed its amount in total; the parent flips to `reversed` once fully corrected.',
  })
  @ApiCreatedData(TransactionResponseDto, 'Correction recorded')
  @ApiErrors(401, 404, 422)
  correct(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCorrectionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.createCorrection(actor, id, dto);
  }

  @Get()
  @ResponseMessage('Transactions retrieved successfully')
  @ApiOperation({
    summary: "List transactions within the actor's scope",
    description:
      'Scoped through the owning customer. `summary` reports totalIn, totalOut and net over the entire filtered set, not the page. Use `isWithdrawal=true` for genuine withdrawals (credits with no parent) and `isCorrection=true` for bookkeeping fixes.',
  })
  @ApiOkList(TransactionResponseDto, TransactionSummaryDto)
  @ApiErrors(401, 404, 422)
  findAll(
    @CurrentStaff() actor: ICurrentStaff,
    @Query() filters: TransactionFilterDto,
  ): Promise<IPaginatedResult<TransactionResponseDto, TransactionSummaryDto>> {
    return this.transactionsService.findAll(actor, filters);
  }

  @Get(':id')
  @ResponseMessage('Transaction retrieved successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Get a transaction',
    description: "Returns 404 when the owning customer lies outside the actor's chain.",
  })
  @ApiOkData(TransactionResponseDto)
  @ApiErrors(401, 404)
  findOne(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.findOne(actor, id);
  }

  @Patch(':id')
  @TeamAuth(StaffRole.MASTER, StaffRole.MANAGER)
  @ResponseMessage('Transaction updated successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: "Edit a transaction's descriptive fields",
    description:
      'Amount, type and customer are immutable: changing them would silently rewrite historical aggregates that have already been reported. Fix a wrong amount with a correction instead.',
  })
  @ApiOkData(TransactionResponseDto)
  @ApiErrors(401, 403, 404, 422)
  update(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.update(actor, id, dto);
  }

  @Delete(':id')
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Transaction deleted successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Soft-delete a transaction',
    description:
      'Master only. Reverses the balance effect in the same database transaction. Refused when corrections reference it, since removing a parent would orphan them and make withdrawal totals unreconstructable.',
  })
  @ApiOkMessage('Transaction deleted')
  @ApiErrors(401, 403, 404, 422)
  remove(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    return this.transactionsService.remove(actor, id);
  }
}
