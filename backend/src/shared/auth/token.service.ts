import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { SignOptions } from 'jsonwebtoken';
import { AuthRealm, StaffRole } from '@common/constants/app.constants';
import { ITeamJwtPayload, ICustomerJwtPayload } from '@common/interfaces/auth.interface';
import { ITokenPair } from './auth.interfaces';

interface ITeamTokenSubject {
  id: string;
  email: string;
  username: string;
  role: StaffRole;
  parentId: string | null;
}

interface ICustomerTokenSubject {
  id: string;
  email: string;
  username: string;
}

/**
 * Issues access and refresh tokens for both realms.
 *
 * Every secret is resolved per call from the realm-specific config key, so
 * a token can only ever be signed with the secret belonging to the realm
 * it was minted for. Phase 1 pairs this with auth_sessions for refresh
 * rotation and reuse detection.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async issueTeamTokens(subject: ITeamTokenSubject, sessionId: string): Promise<ITokenPair> {
    const payload: ITeamJwtPayload = {
      sub: subject.id,
      realm: AuthRealm.TEAM,
      email: subject.email,
      username: subject.username,
      role: subject.role,
      parentId: subject.parentId,
      sid: sessionId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('jwt.secret'),
        expiresIn: this.configService.getOrThrow<string>(
          'jwt.expiresIn',
        ) as SignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(
        { sub: subject.id, realm: AuthRealm.TEAM, sid: sessionId },
        {
          secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
          expiresIn: this.configService.getOrThrow<string>(
            'jwt.refreshExpiresIn',
          ) as SignOptions['expiresIn'],
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  async issueCustomerTokens(
    subject: ICustomerTokenSubject,
    sessionId: string,
  ): Promise<ITokenPair> {
    const payload: ICustomerJwtPayload = {
      sub: subject.id,
      realm: AuthRealm.CUSTOMER,
      email: subject.email,
      username: subject.username,
      sid: sessionId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('jwt.customerSecret'),
        expiresIn: this.configService.getOrThrow<string>(
          'jwt.customerExpiresIn',
        ) as SignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(
        { sub: subject.id, realm: AuthRealm.CUSTOMER, sid: sessionId },
        {
          secret: this.configService.getOrThrow<string>('jwt.customerRefreshSecret'),
          expiresIn: this.configService.getOrThrow<string>(
            'jwt.customerRefreshExpiresIn',
          ) as SignOptions['expiresIn'],
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  /** Verifies a refresh token against the secret for its realm. */
  async verifyRefreshToken<T extends object>(token: string, realm: AuthRealm): Promise<T> {
    const secretKey = realm === AuthRealm.TEAM ? 'jwt.refreshSecret' : 'jwt.customerRefreshSecret';

    return this.jwtService.verifyAsync<T>(token, {
      secret: this.configService.getOrThrow<string>(secretKey),
    });
  }
}
