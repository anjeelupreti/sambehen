import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthRealm } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import { AuthenticationException } from '@common/exceptions/business.exception';
import { ICurrentCustomer, ICustomerJwtPayload } from '@common/interfaces/auth.interface';

export const JWT_CUSTOMER_STRATEGY = 'jwt-customer';

/**
 * Validates customer (inhaler) access tokens.
 *
 * Signed with JWT_CUSTOMER_SECRET, separate from the team realm's secret,
 * so a customer token presented to a team route fails signature
 * verification outright.
 */
@Injectable()
export class JwtCustomerStrategy extends PassportStrategy(Strategy, JWT_CUSTOMER_STRATEGY) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.customerSecret'),
    });
  }

  validate(payload: ICustomerJwtPayload): ICurrentCustomer {
    if (payload.realm !== AuthRealm.CUSTOMER) {
      throw new AuthenticationException(
        ErrorCode.AUTH_WRONG_REALM,
        'This token is not valid for customer endpoints',
      );
    }

    if (!payload.sub) {
      throw new AuthenticationException(ErrorCode.AUTH_TOKEN_INVALID, 'Malformed access token');
    }

    return {
      id: payload.sub,
      realm: AuthRealm.CUSTOMER,
      email: payload.email,
      username: payload.username,
      sessionId: payload.sid,
    };
  }
}
