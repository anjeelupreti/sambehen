import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthRealm, StaffRole } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import { AuthenticationException } from '@common/exceptions/business.exception';
import { ICurrentStaff, ITeamJwtPayload } from '@common/interfaces/auth.interface';

export const JWT_TEAM_STRATEGY = 'jwt-team';

/**
 * Validates business-side (master / manager / store) access tokens.
 *
 * Signed with JWT_SECRET, which is distinct from the customer realm's
 * secret. A customer token therefore fails signature verification here
 * rather than merely failing a claim check, so the realms cannot be
 * crossed even if a payload were forged with the right shape.
 */
@Injectable()
export class JwtTeamStrategy extends PassportStrategy(Strategy, JWT_TEAM_STRATEGY) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  validate(payload: ITeamJwtPayload): ICurrentStaff {
    if (payload.realm !== AuthRealm.TEAM) {
      throw new AuthenticationException(
        ErrorCode.AUTH_WRONG_REALM,
        'This token is not valid for team endpoints',
      );
    }

    if (!payload.sub || !payload.role || !Object.values(StaffRole).includes(payload.role)) {
      throw new AuthenticationException(ErrorCode.AUTH_TOKEN_INVALID, 'Malformed access token');
    }

    return {
      id: payload.sub,
      realm: AuthRealm.TEAM,
      email: payload.email,
      username: payload.username,
      role: payload.role,
      parentId: payload.parentId ?? null,
      sessionId: payload.sid,
    };
  }
}
