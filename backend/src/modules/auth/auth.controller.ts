import { Controller, Post, Get, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthRealm } from '@common/constants/app.constants';
import { Public, CurrentStaff, CurrentCustomer } from '@common/decorators/auth.decorators';
import { TeamAuth, CustomerAuth } from '@common/decorators/composite-auth.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import { Auditable } from '@common/decorators/auditable.decorator';
import { ApiOkData, ApiOkMessage, ApiErrors } from '@common/swagger/api-response.decorators';
import { ICurrentStaff, ICurrentCustomer } from '@common/interfaces/auth.interface';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RefreshTokenDto,
  TeamLoginResponseDto,
  CustomerLoginResponseDto,
  TokenPairDto,
  ChangeOwnPasswordDto,
  StaffProfileDto,
  CustomerProfileDto,
} from './dto/auth.dto';

/**
 * Separate login gateways for the two realms.
 *
 * The tokens they issue are signed with different secrets, so a token
 * from one gateway is rejected by the other's routes at signature
 * verification rather than by a claim check.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Team gateway ────────────────────────────────────────────

  /**
   * Credential endpoints get a far tighter limit than the global default,
   * since the global 100/min would allow a practical online password
   * guessing attack.
   */
  @Post('team/login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ResponseMessage('Signed in successfully')
  @ApiOperation({
    summary: 'Team login (master, manager, runner)',
    description:
      'Accepts an email address or username. Unknown accounts and wrong passwords are reported identically, and take comparable time, so the endpoint cannot be used to enumerate accounts.',
  })
  @ApiOkData(TeamLoginResponseDto, 'Signed in successfully')
  @ApiErrors(401, 422, 429)
  loginTeam(@Body() dto: LoginDto, @Req() request: Request): Promise<TeamLoginResponseDto> {
    return this.authService.loginTeam(dto, this.contextOf(request));
  }

  @Post('team/refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ResponseMessage('Token refreshed')
  @ApiOperation({
    summary: 'Rotate a team refresh token',
    description:
      'Issues a new token pair and revokes the presented one. Re-presenting an already-rotated token is treated as a leak: every session for that account is revoked.',
  })
  @ApiOkData(TokenPairDto, 'Token refreshed')
  @ApiErrors(401, 422, 429)
  refreshTeam(@Body() dto: RefreshTokenDto, @Req() request: Request): Promise<TokenPairDto> {
    return this.authService.refresh(dto.refreshToken, AuthRealm.TEAM, this.contextOf(request));
  }

  @Post('team/logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Signed out')
  @ApiOperation({
    summary: 'Revoke a team refresh token',
    description:
      'Idempotent: an unknown or already-revoked token still returns success, so the endpoint cannot be used to probe token validity.',
  })
  @ApiOkMessage('Signed out')
  async logoutTeam(@Body() dto: RefreshTokenDto): Promise<null> {
    await this.authService.logout(dto.refreshToken);
    return null;
  }

  @Post('team/logout-all')
  @TeamAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Signed out of all sessions')
  @Auditable({ action: 'auth.logout_all', entityType: 'staff', entityIdParam: null })
  @ApiOperation({ summary: 'Revoke every session for the signed-in staff member' })
  @ApiOkData(Object, 'Sessions revoked')
  @ApiErrors(401)
  async logoutAllTeam(@CurrentStaff() staff: ICurrentStaff): Promise<{ revokedSessions: number }> {
    const revokedSessions = await this.authService.logoutAll(AuthRealm.TEAM, staff.id);
    return { revokedSessions };
  }

  @Post('team/change-password')
  @TeamAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password changed')
  @Auditable({ action: 'auth.password_changed', entityType: 'staff', entityIdParam: null })
  @ApiOperation({
    summary: "Change the signed-in staff member's own password",
    description: [
      'Requires the current password. This is the self-service path and is',
      'distinct from an administrative reset, which proves authority over an',
      'account rather than possession of it — so an unlocked laptop is not',
      'enough to take an account over.',
      '',
      'Every session is revoked, including the one making the call: a',
      'password changed because it may have leaked is worth nothing if the',
      'old sessions survive it.',
    ].join(' '),
  })
  @ApiOkData(Object, 'Password changed and sessions revoked')
  @ApiErrors(401, 422)
  async changeOwnPassword(
    @CurrentStaff() staff: ICurrentStaff,
    @Body() dto: ChangeOwnPasswordDto,
  ): Promise<{ revokedSessions: number }> {
    return this.authService.changeOwnPassword(staff.id, dto);
  }

  @Get('team/me')
  @TeamAuth()
  @ResponseMessage('Profile retrieved')
  @ApiOperation({ summary: 'Claims of the signed-in staff member' })
  @ApiOkData(StaffProfileDto)
  @ApiErrors(401)
  meTeam(@CurrentStaff() staff: ICurrentStaff): ICurrentStaff {
    return staff;
  }

  // ── Customer gateway ────────────────────────────────────────

  @Post('customer/login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ResponseMessage('Signed in successfully')
  @ApiOperation({
    summary: 'Customer login',
    description:
      'Accepts an email address or username. Suspended and banned accounts are refused; a merely inactive account can still sign in, since inactivity only reflects a lapse in usage.',
  })
  @ApiOkData(CustomerLoginResponseDto, 'Signed in successfully')
  @ApiErrors(401, 422, 429)
  loginCustomer(@Body() dto: LoginDto, @Req() request: Request): Promise<CustomerLoginResponseDto> {
    return this.authService.loginCustomer(dto, this.contextOf(request));
  }

  @Post('customer/refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ResponseMessage('Token refreshed')
  @ApiOperation({ summary: 'Rotate a customer refresh token' })
  @ApiOkData(TokenPairDto, 'Token refreshed')
  @ApiErrors(401, 422, 429)
  refreshCustomer(@Body() dto: RefreshTokenDto, @Req() request: Request): Promise<TokenPairDto> {
    return this.authService.refresh(dto.refreshToken, AuthRealm.CUSTOMER, this.contextOf(request));
  }

  @Post('customer/logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Signed out')
  @ApiOperation({ summary: 'Revoke a customer refresh token' })
  @ApiOkMessage('Signed out')
  async logoutCustomer(@Body() dto: RefreshTokenDto): Promise<null> {
    await this.authService.logout(dto.refreshToken);
    return null;
  }

  @Get('customer/me')
  @CustomerAuth()
  @ResponseMessage('Profile retrieved')
  @ApiOperation({
    summary: 'Claims of the signed-in customer',
    description:
      'Read-only. Customers cannot modify their own profile or credentials; those changes are made by the master, their manager, or their runner.',
  })
  @ApiOkData(CustomerProfileDto)
  @ApiErrors(401)
  meCustomer(@CurrentCustomer() customer: ICurrentCustomer): ICurrentCustomer {
    return customer;
  }

  private contextOf(request: Request): { ip?: string; userAgent?: string } {
    return { ip: request.ip, userAgent: request.get('user-agent') };
  }
}
