import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthRealm, CustomerStatus } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import { AuthenticationException } from '@common/exceptions/business.exception';
import { HashUtil } from '@common/utils/hash.util';
import { StaffRepository } from '@database/repositories/staff.repository';
import { CustomerRepository } from '@database/repositories/customer.repository';
import { AuthSessionRepository } from '@database/repositories/auth-session.repository';
import { StaffUser } from '@database/schema/staff-users.schema';
import { Customer } from '@database/schema/customers.schema';
import { TokenService } from '@shared/auth/token.service';
import { IRefreshTokenPayload } from '@shared/auth/auth.interfaces';
import {
  LoginDto,
  TeamLoginResponseDto,
  CustomerLoginResponseDto,
  StaffProfileDto,
  CustomerProfileDto,
  TokenPairDto,
  ChangeOwnPasswordDto,
} from './dto/auth.dto';

interface IRequestContext {
  ip?: string;
  userAgent?: string;
}

/**
 * Login, refresh and logout for both realms.
 *
 * Authentication failures are deliberately uniform: an unknown account and
 * a wrong password both produce AUTH_INVALID_CREDENTIALS with the same
 * message, and a dummy verification runs when no account matched so the
 * response time does not reveal whether the identifier exists.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Argon2 hash of a random value, verified against when no account
   * matched. Without it, a missing account returns measurably faster than
   * a wrong password and the endpoint becomes a user enumeration oracle.
   */
  private dummyHash?: string;

  constructor(
    private readonly staffRepository: StaffRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly sessionRepository: AuthSessionRepository,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  // ── Team ────────────────────────────────────────────────────

  async loginTeam(dto: LoginDto, context: IRequestContext): Promise<TeamLoginResponseDto> {
    const staff = await this.staffRepository.findByIdentifier(dto.identifier);
    const passwordValid = await this.verifyOrBurnTime(staff?.passwordHash, dto.password);

    if (!staff || !passwordValid) {
      throw new AuthenticationException(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid credentials');
    }

    if (!staff.isActive) {
      throw new AuthenticationException(
        ErrorCode.AUTH_ACCOUNT_DISABLED,
        'This account has been deactivated',
      );
    }

    const tokens = await this.issueTeamSession(staff, context);
    await this.staffRepository.touchLastLogin(staff.id);

    return { ...tokens, user: this.toStaffProfile(staff) };
  }

  // ── Customer ────────────────────────────────────────────────

  async loginCustomer(dto: LoginDto, context: IRequestContext): Promise<CustomerLoginResponseDto> {
    const customer = await this.customerRepository.findByIdentifier(dto.identifier);
    const passwordValid = await this.verifyOrBurnTime(customer?.passwordHash, dto.password);

    if (!customer || !passwordValid) {
      throw new AuthenticationException(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid credentials');
    }

    // Suspended and banned accounts are refused; inactive is not, since it
    // only reflects a lapse in activity rather than a deliberate block.
    if (customer.status === CustomerStatus.SUSPENDED || customer.status === CustomerStatus.BANNED) {
      throw new AuthenticationException(
        ErrorCode.AUTH_ACCOUNT_DISABLED,
        'This account has been suspended. Please contact support.',
      );
    }

    const tokens = await this.issueCustomerSession(customer, context);
    await this.customerRepository.touchLastLogin(customer.id);

    return { ...tokens, user: this.toCustomerProfile(customer) };
  }

  // ── Refresh ─────────────────────────────────────────────────

  /**
   * Rotates a refresh token.
   *
   * The presented token is verified, its session revoked, and a brand new
   * pair issued. Presenting an already-rotated token means it leaked, so
   * every session for that subject is revoked rather than issuing another
   * token to whoever holds it.
   */
  async refresh(
    refreshToken: string,
    realm: AuthRealm,
    context: IRequestContext,
  ): Promise<TokenPairDto> {
    let payload: IRefreshTokenPayload;
    try {
      payload = await this.tokenService.verifyRefreshToken<IRefreshTokenPayload>(
        refreshToken,
        realm,
      );
    } catch {
      throw new AuthenticationException(
        ErrorCode.AUTH_REFRESH_INVALID,
        'Refresh token is invalid or has expired',
      );
    }

    if (payload.realm !== realm) {
      throw new AuthenticationException(
        ErrorCode.AUTH_WRONG_REALM,
        'This refresh token belongs to a different realm',
      );
    }

    const tokenHash = HashUtil.sha256(refreshToken);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);

    if (!session) {
      throw new AuthenticationException(
        ErrorCode.AUTH_REFRESH_INVALID,
        'Refresh token is invalid or has expired',
      );
    }

    if (session.revokedAt) {
      // Reuse of a revoked token: assume compromise and cut the whole
      // family, not just this session.
      const revoked = await this.sessionRepository.revokeAllForSubject(
        session.subjectType,
        session.subjectId,
        'reuse_detected',
      );
      this.logger.warn(
        `Refresh token reuse detected for ${session.subjectType}:${session.subjectId}; revoked ${revoked} session(s)`,
      );
      throw new AuthenticationException(
        ErrorCode.AUTH_REFRESH_REUSED,
        'This session has been terminated for security reasons. Please sign in again.',
      );
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.sessionRepository.revoke(session.id, 'expired');
      throw new AuthenticationException(
        ErrorCode.AUTH_REFRESH_INVALID,
        'Refresh token is invalid or has expired',
      );
    }

    if (realm === AuthRealm.TEAM) {
      const staff = await this.staffRepository.findById(session.subjectId);
      if (!staff || !staff.isActive) {
        await this.sessionRepository.revokeAllForSubject(
          realm,
          session.subjectId,
          'account_disabled',
        );
        throw new AuthenticationException(
          ErrorCode.AUTH_ACCOUNT_DISABLED,
          'This account has been deactivated',
        );
      }
      const tokens = await this.issueTeamSession(staff, context);
      await this.sessionRepository.revoke(session.id, 'rotated');
      return tokens;
    }

    const customer = await this.customerRepository.findById(session.subjectId);
    if (
      !customer ||
      customer.status === CustomerStatus.SUSPENDED ||
      customer.status === CustomerStatus.BANNED
    ) {
      await this.sessionRepository.revokeAllForSubject(
        realm,
        session.subjectId,
        'account_disabled',
      );
      throw new AuthenticationException(
        ErrorCode.AUTH_ACCOUNT_DISABLED,
        'This account has been suspended. Please contact support.',
      );
    }

    const tokens = await this.issueCustomerSession(customer, context);
    await this.sessionRepository.revoke(session.id, 'rotated');
    return tokens;
  }

  // ── Logout ──────────────────────────────────────────────────

  /** Revokes the session behind the presented refresh token. */
  async logout(refreshToken: string): Promise<void> {
    const session = await this.sessionRepository.findByTokenHash(HashUtil.sha256(refreshToken));
    // Silent when the token is unknown or already revoked: logout is
    // idempotent, and reporting "no such session" would leak whether a
    // token was ever valid.
    if (session && !session.revokedAt) {
      await this.sessionRepository.revoke(session.id, 'logout');
    }
  }

  /**
   * Changes the signed-in staff member's own password.
   *
   * Requires the current password. That is the whole point: an
   * administrative reset (`/team/staff/:id/reset-password`) proves authority
   * over the account, whereas this proves possession *of the account itself*
   * — so an unlocked laptop is not enough to take it over.
   *
   * Every other session is revoked afterwards. If the password was changed
   * because it may have leaked, leaving other sessions alive would defeat
   * the change; the caller's own session is revoked too, so they sign back
   * in with the new password.
   */
  async changeOwnPassword(
    staffId: string,
    dto: ChangeOwnPasswordDto,
  ): Promise<{ revokedSessions: number }> {
    const staff = await this.staffRepository.findById(staffId);
    if (!staff) {
      throw new AuthenticationException(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Not signed in');
    }

    const matches = await HashUtil.verifyPassword(staff.passwordHash, dto.currentPassword);
    if (!matches) {
      // Deliberately not a 422 on the field: a wrong current password is a
      // failed authentication, not malformed input.
      throw new AuthenticationException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Current password is incorrect',
      );
    }

    await this.staffRepository.update(staffId, {
      passwordHash: await HashUtil.hashPassword(dto.newPassword),
      // They chose it themselves, so there is nothing to force at next login.
      mustChangePassword: false,
    });

    const revokedSessions = await this.sessionRepository.revokeAllForSubject(
      AuthRealm.TEAM,
      staffId,
      'password_change',
    );

    return { revokedSessions };
  }

  /** Revokes every session for a subject — "sign out everywhere". */
  async logoutAll(realm: AuthRealm, subjectId: string): Promise<number> {
    return this.sessionRepository.revokeAllForSubject(realm, subjectId, 'logout_all');
  }

  // ── Internals ───────────────────────────────────────────────

  private async issueTeamSession(
    staff: StaffUser,
    context: IRequestContext,
  ): Promise<TokenPairDto> {
    const session = await this.sessionRepository.createSession({
      subjectType: AuthRealm.TEAM,
      subjectId: staff.id,
      // Placeholder: the real digest needs the token, which needs the
      // session id. Overwritten immediately below.
      refreshTokenHash: HashUtil.generateRandomToken(32),
      expiresAt: this.refreshExpiry('jwt.refreshExpiresIn'),
      ip: context.ip,
      userAgent: context.userAgent,
    });

    const tokens = await this.tokenService.issueTeamTokens(
      {
        id: staff.id,
        email: staff.email,
        username: staff.username,
        role: staff.role,
        parentId: staff.parentId,
      },
      session.id,
    );

    await this.sessionRepository.update(session.id, {
      refreshTokenHash: HashUtil.sha256(tokens.refreshToken),
    });

    return { ...tokens, tokenType: 'Bearer' };
  }

  private async issueCustomerSession(
    customer: Customer,
    context: IRequestContext,
  ): Promise<TokenPairDto> {
    const session = await this.sessionRepository.createSession({
      subjectType: AuthRealm.CUSTOMER,
      subjectId: customer.id,
      refreshTokenHash: HashUtil.generateRandomToken(32),
      expiresAt: this.refreshExpiry('jwt.customerRefreshExpiresIn'),
      ip: context.ip,
      userAgent: context.userAgent,
    });

    const tokens = await this.tokenService.issueCustomerTokens(
      { id: customer.id, email: customer.email, username: customer.username },
      session.id,
    );

    await this.sessionRepository.update(session.id, {
      refreshTokenHash: HashUtil.sha256(tokens.refreshToken),
    });

    return { ...tokens, tokenType: 'Bearer' };
  }

  /**
   * Verifies a password, or burns comparable time when no account matched,
   * so login latency cannot be used to enumerate accounts.
   */
  private async verifyOrBurnTime(
    storedHash: string | undefined,
    plaintext: string,
  ): Promise<boolean> {
    if (storedHash) {
      return HashUtil.verifyPassword(storedHash, plaintext);
    }

    this.dummyHash ??= await HashUtil.hashPassword(HashUtil.generateRandomToken(16));
    await HashUtil.verifyPassword(this.dummyHash, plaintext);
    return false;
  }

  /** Converts a duration string such as '7d' or '30m' into an absolute expiry. */
  private refreshExpiry(configKey: string): Date {
    const raw = this.configService.getOrThrow<string>(configKey);
    const match = /^(\d+)([smhd])$/.exec(raw.trim());

    if (!match) {
      // Fall back to seven days rather than failing a login over a config
      // typo, but make the misconfiguration visible.
      this.logger.warn(`Unparseable duration "${raw}" for ${configKey}; defaulting to 7d`);
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return new Date(Date.now() + Number(match[1]) * multipliers[match[2]]);
  }

  private toStaffProfile(staff: StaffUser): StaffProfileDto {
    return {
      id: staff.id,
      email: staff.email,
      username: staff.username,
      firstName: staff.firstName,
      lastName: staff.lastName,
      role: staff.role,
      parentId: staff.parentId,
      isActive: staff.isActive,
      mustChangePassword: staff.mustChangePassword,
      lastLoginAt: staff.lastLoginAt,
    };
  }

  private toCustomerProfile(customer: Customer): CustomerProfileDto {
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
