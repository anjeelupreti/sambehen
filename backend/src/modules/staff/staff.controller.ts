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
} from '@nestjs/common';
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
import { StaffService } from './staff.service';
import {
  CreateStaffDto,
  UpdateStaffDto,
  ResetStaffPasswordDto,
  ReassignStoreDto,
  StaffFilterDto,
  StaffResponseDto,
} from './dto/staff.dto';

/**
 * Staff hierarchy management.
 *
 * Role checks here answer "may this role perform this action". Which rows
 * an actor may see or touch is decided by ScopeService in the service
 * layer, so a manager listing staff sees only themselves and their own
 * stores regardless of what they request.
 *
 * Auditing note: these routes carry no @Auditable decorator. StaffService
 * already records every mutation with before/after state, and adding the
 * decorator as well produced two rows per action. The rule is: whichever
 * layer can supply the richer entry owns the audit, and @Auditable is for
 * actions with no service-level record.
 */
@ApiTags('Staff')
@Controller('team/staff')
@TeamAuth()
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @TeamAuth(StaffRole.MASTER, StaffRole.MANAGER)
  @ResponseMessage('Staff member created successfully')
  @ApiOperation({
    summary: 'Create a manager or store',
    description:
      "A master creates managers, and stores under an explicit manager. A manager creates stores only, always attached to themselves — a supplied parentId is ignored, so a store cannot be planted in another manager's team.",
  })
  @ApiCreatedData(StaffResponseDto, 'Staff member created')
  @ApiErrors(401, 403, 409, 422)
  create(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: CreateStaffDto,
  ): Promise<StaffResponseDto> {
    return this.staffService.create(actor, dto);
  }

  @Get()
  @ResponseMessage('Staff retrieved successfully')
  @ApiOperation({
    summary: "List staff within the actor's scope",
    description:
      'Master sees all staff; a manager sees themselves and their own stores; a store sees only themselves.',
  })
  @ApiOkList(StaffResponseDto)
  @ApiErrors(401, 422)
  findAll(
    @CurrentStaff() actor: ICurrentStaff,
    @Query() filters: StaffFilterDto,
  ): Promise<IPaginatedResult<StaffResponseDto>> {
    return this.staffService.findAll(actor, filters);
  }

  @Patch('me')
  @ResponseMessage('Profile updated successfully')
  @ApiOperation({ summary: 'Update your own profile' })
  @ApiOkData(StaffResponseDto)
  @ApiErrors(401, 409, 422)
  updateProfile(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: UpdateStaffDto,
  ): Promise<StaffResponseDto> {
    return this.staffService.update(actor, actor.id, dto);
  }

  @Post('me/reset-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password updated successfully')
  @ApiOperation({ summary: 'Update your own password' })
  @ApiOkData(Object, 'Password updated and sessions revoked')
  @ApiErrors(401, 422)
  resetOwnPassword(
    @CurrentStaff() actor: ICurrentStaff,
    @Body() dto: ResetStaffPasswordDto,
  ): Promise<{ revokedSessions: number }> {
    return this.staffService.resetPassword(actor, actor.id, dto);
  }

  @Get(':id')
  @ResponseMessage('Staff member retrieved successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Get a staff member',
    description:
      "Returns 404 when the account lies outside the actor's scope, so the API never confirms that another chain's account exists.",
  })
  @ApiOkData(StaffResponseDto)
  @ApiErrors(401, 404)
  findOne(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StaffResponseDto> {
    return this.staffService.findOne(actor, id);
  }

  @Patch(':id')
  @TeamAuth(StaffRole.MASTER, StaffRole.MANAGER)
  @ResponseMessage('Staff member updated successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: "Update a staff member's profile" })
  @ApiOkData(StaffResponseDto)
  @ApiErrors(401, 403, 404, 409, 422)
  update(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
  ): Promise<StaffResponseDto> {
    return this.staffService.update(actor, id, dto);
  }

  @Post(':id/reset-password')
  @TeamAuth(StaffRole.MASTER, StaffRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password reset successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Set a new password for a staff member',
    description:
      'Revokes every session for that account. A reset that left live refresh tokens in circulation would not actually lock anyone out.',
  })
  @ApiOkData(Object, 'Password reset and sessions revoked')
  @ApiErrors(401, 403, 404, 422)
  resetPassword(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetStaffPasswordDto,
  ): Promise<{ revokedSessions: number }> {
    return this.staffService.resetPassword(actor, id, dto);
  }

  @Patch(':id/activate')
  @TeamAuth(StaffRole.MASTER, StaffRole.MANAGER)
  @ResponseMessage('Staff member activated')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Reactivate a staff account' })
  @ApiOkData(StaffResponseDto)
  @ApiErrors(401, 403, 404)
  activate(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StaffResponseDto> {
    return this.staffService.setActive(actor, id, true);
  }

  @Patch(':id/deactivate')
  @TeamAuth(StaffRole.MASTER, StaffRole.MANAGER)
  @ResponseMessage('Staff member deactivated')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Deactivate a staff account',
    description: 'Revokes every session, so access ends immediately rather than at token expiry.',
  })
  @ApiOkData(StaffResponseDto)
  @ApiErrors(401, 403, 404)
  deactivate(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StaffResponseDto> {
    return this.staffService.setActive(actor, id, false);
  }

  @Patch(':id/reassign')
  @TeamAuth(StaffRole.MASTER)
  @ResponseMessage('Store reassigned successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Move a store to a different manager',
    description:
      'Rewrites the denormalised managerId on every customer of that store, in the same transaction. Master only.',
  })
  @ApiOkData(StaffResponseDto)
  @ApiErrors(401, 403, 404, 422)
  reassign(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignStoreDto,
  ): Promise<StaffResponseDto> {
    return this.staffService.reassignStore(actor, id, dto);
  }

  @Delete(':id')
  @TeamAuth(StaffRole.MASTER, StaffRole.MANAGER)
  @ResponseMessage('Staff member deleted successfully')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Soft-delete a staff account',
    description:
      'Refused while direct reports remain: orphaning them would strand their customers outside every visible scope.',
  })
  @ApiOkMessage('Staff member deleted')
  @ApiErrors(401, 403, 404, 409)
  remove(
    @CurrentStaff() actor: ICurrentStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    return this.staffService.remove(actor, id);
  }
}
