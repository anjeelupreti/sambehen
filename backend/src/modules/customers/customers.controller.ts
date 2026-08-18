import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { StaffRole } from '@common/constants/app.constants';
import { TeamAuth } from '@common/decorators/composite-auth.decorator';
import { CurrentStaff } from '@common/decorators/auth.decorators';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { ParseUUIDPipe } from '@common/pipes/parse-uuid.pipe';
import { TrendQueryDto, TrendResponseDto } from '../dashboard/dto/dashboard.dto';
import {
  ApiOkData,
  ApiOkList,
  ApiCreatedData,
  ApiOkMessage,
  ApiErrors,
} from '@common/swagger/api-response.decorators';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { CustomersService } from './customers.service';
import { CustomerImportService } from './customer-import.service';
import { ValidationException } from '@common/exceptions/business.exception';
import {
  CommitImportDto,
  CommitImportResponseDto,
  ImportPreviewResponseDto,
} from './dto/import.dto';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  SetCustomerPasswordDto,
  ChangeCustomerStatusDto,
  ReassignCustomerDto,
  BulkReassignCustomersDto,
  BulkStatusDto,
  CustomerFilterDto,
  CustomerResponseDto,
  CustomerListSummaryDto,
} from './dto/customer.dto';

/**
 * Staff-side customer management.
 *
 * Customers cannot modify their own profile, credentials or status — every
 * write lives here and is audit-logged. Row visibility comes from
 * ScopeService, so a store sees only their own customers and a manager
 * only their chain, regardless of what they request.
 *
 * As in StaffController, auditing is owned by the service layer, which can
 * record before/after state; adding @Auditable here as well would produce
 * two rows per action.
 */
@ApiTags('Customers')
@Controller('team/customers')
@TeamAuth()
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly customerImportService: CustomerImportService,
  ) {}

  @Post()
  @ResponseMessage('Customer created successfully')
  @ApiOperation({
    summary: 'Create a customer',
    description:
      'A store always creates for themselves — a supplied ownerStaffId is ignored. A manager may assign to themselves or one of their own stores. A master must name an owner, since masters cannot own customers directly.',
  })
  @ApiCreatedData(CustomerResponseDto, 'Customer created')
  @ApiErrors(401, 403, 404, 409, 422)
  create(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    return this.customersService.create(actor, dto);
  }

  @Post('import/preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ResponseMessage('File parsed')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Parse and validate an import file without writing anything',
    description: [
      'Returns the rows that would be created and, separately, every row that',
      'cannot be — each with its own reason. Nothing is written.',
      '',
      'This exists so a bulk import is reviewable before it happens. A',
      'spreadsheet of several hundred customers is where a mis-mapped column',
      'does real damage, and writing on upload means the damage is only',
      'discovered afterwards.',
      '',
      'The sheet needs `email` and `username` columns; `fullName`, `phone`,',
      '`city` and `country` are optional. Header matching ignores case,',
      'spacing and common wordings.',
    ].join(' '),
  })
  @ApiOkData(ImportPreviewResponseDto, 'Rows parsed')
  @ApiErrors(401, 422)
  previewImport(@UploadedFile() file: Express.Multer.File): Promise<ImportPreviewResponseDto> {
    if (!file) {
      throw new ValidationException([
        { field: 'file', constraint: 'required', message: 'Attach a .xlsx file' },
      ]);
    }
    return this.customerImportService.preview(file.buffer);
  }

  @Post('import')
  @ResponseMessage('Customers imported')
  @ApiOperation({
    summary: 'Create the confirmed rows in one transaction',
    description: [
      'All or nothing. A file whose two-hundredth row collides with an',
      'existing username must not leave 199 customers behind — there is no',
      'sensible way to resume a half-finished import.',
      '',
      'Takes the rows returned by the preview rather than the file again, so',
      'what is written is what the operator reviewed. Collisions are',
      're-checked here because preview may have run minutes ago.',
    ].join(' '),
  })
  @ApiCreatedData(CommitImportResponseDto, 'Customers imported')
  @ApiErrors(401, 403, 404, 422)
  commitImport(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: CommitImportDto,
  ): Promise<CommitImportResponseDto> {
    return this.customerImportService.commit(actor, dto);
  }

  @Get()
  @ResponseMessage('Customers retrieved successfully')
  @ApiOperation({
    summary: "List customers within the actor's scope",
    description:
      'Returns `summary` aggregates computed over the entire filtered set, not the current page. Note that `isActive` is activity-based (status is active AND last seen inside the window), which is distinct from the `status` filter.',
  })
  @ApiOkList(CustomerResponseDto, CustomerListSummaryDto)
  @ApiErrors(401, 404, 422)
  findAll(
    @CurrentStaff() actor: ICurrentStaff,
    @Query() filters: CustomerFilterDto,
  ): Promise<IPaginatedResult<CustomerResponseDto, CustomerListSummaryDto>> {
    return this.customersService.findAll(actor, filters);
  }

  @Get(':id')
  @ResponseMessage('Customer retrieved successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Get a customer',
    description:
      "Returns 404 when the customer lies outside the actor's chain, so the API never confirms that another chain's customer exists.",
  })
  @ApiOkData(CustomerResponseDto)
  @ApiErrors(401, 404)
  findOne(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerResponseDto> {
    return this.customersService.findOne(actor, id);
  }

  @Get(':id/trends')
  @ResponseMessage('Customer trends retrieved successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Get customer transaction trends',
    description: 'Time-bucketed net series specifically for this customer.',
  })
  @ApiOkData(TrendResponseDto)
  @ApiErrors(401, 404, 422)
  getTrends(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TrendQueryDto,
  ): Promise<TrendResponseDto> {
    return this.customersService.getTrends(actor, id, query);
  }

  @Patch(':id')
  @ResponseMessage('Customer updated successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Update a customer profile',
    description:
      'Credentials and status are excluded on purpose: password changes go through the reset endpoint so sessions can be revoked, and status changes through their own endpoint so they audit as status changes.',
  })
  @ApiOkData(CustomerResponseDto)
  @ApiErrors(401, 404, 409, 422)
  update(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    return this.customersService.update(actor, id, dto);
  }

  @Post(':id/set-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password set successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Set a customer password',
    description:
      'The only way a customer password ever changes — customers cannot change their own. Revokes every session, so a previous holder keeps no usable refresh token.',
  })
  @ApiOkData(Object, 'Password set and sessions revoked')
  @ApiErrors(401, 404, 422)
  setPassword(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCustomerPasswordDto,
  ): Promise<{ revokedSessions: number }> {
    return this.customersService.setPassword(actor, id, dto);
  }

  @Patch(':id/status')
  @ResponseMessage('Customer status updated')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Change a customer status',
    description: 'Suspending or banning revokes every session so access ends immediately.',
  })
  @ApiOkData(CustomerResponseDto)
  @ApiErrors(401, 404, 422)
  changeStatus(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeCustomerStatusDto,
  ): Promise<CustomerResponseDto> {
    return this.customersService.changeStatus(actor, id, dto);
  }

  @Patch(':id/reassign')
  @TeamAuth(StaffRole.MASTER, StaffRole.MANAGER)
  @ResponseMessage('Customer reassigned successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Move a customer to a different owner',
    description:
      'Rewrites all three ownership columns through CustomerAssignmentService. A manager may only assign within their own chain.',
  })
  @ApiOkData(CustomerResponseDto)
  @ApiErrors(401, 403, 404, 422)
  reassign(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignCustomerDto,
  ): Promise<CustomerResponseDto> {
    return this.customersService.reassign(actor, id, dto);
  }

  @Patch(':id/approve')
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Customer approved')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Approve a pending self-registration',
    description:
      'Assigns an owner and activates the account in one step. Master only — excluded from the default list, a pending customer only appears when filtering `status=pending`.',
  })
  @ApiOkData(CustomerResponseDto)
  @ApiErrors(401, 403, 404, 422)
  approve(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignCustomerDto,
  ): Promise<CustomerResponseDto> {
    return this.customersService.approve(actor, id, dto);
  }

  @Post('bulk/status')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Bulk status update completed')
  @ApiOperation({
    summary: 'Change status for many customers',
    description:
      "Supplied ids are intersected with the actor's scope rather than trusted: ids outside the chain are dropped and counted in `skipped`.",
  })
  @ApiOkData(Object, 'Updated and skipped counts')
  @ApiErrors(401, 422)
  bulkStatus(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: BulkStatusDto,
  ): Promise<{ updated: number; skipped: number }> {
    return this.customersService.bulkChangeStatus(actor, dto.ids, dto.status);
  }

  @Post('bulk/reassign')
  @TeamAuth(StaffRole.MASTER, StaffRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Bulk reassignment completed')
  @ApiOperation({
    summary: 'Move many customers to a different owner',
    description: "Ids outside the actor's scope are dropped and counted in `skipped`.",
  })
  @ApiOkData(Object, 'Updated and skipped counts')
  @ApiErrors(401, 403, 404, 422)
  bulkReassign(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: BulkReassignCustomersDto,
  ): Promise<{ updated: number; skipped: number }> {
    return this.customersService.bulkReassign(actor, dto.ids, dto.ownerStaffId);
  }

  @Delete(':id')
  @TeamAuth(StaffRole.MASTER, StaffRole.MANAGER)
  @ResponseMessage('Customer deleted successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Soft-delete a customer',
    description:
      'Soft delete, so transaction history and audit trail remain intact. Revokes every session.',
  })
  @ApiOkMessage('Customer deleted')
  @ApiErrors(401, 403, 404)
  remove(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    return this.customersService.remove(actor, id);
  }
}
