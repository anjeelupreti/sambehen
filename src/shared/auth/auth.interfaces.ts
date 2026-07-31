import { AuthRealm } from '@common/constants/app.constants';

export interface ITokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Claims carried by a refresh token - deliberately minimal. */
export interface IRefreshTokenPayload {
  sub: string;
  realm: AuthRealm;
  /** auth_sessions row id, so a single session can be revoked. */
  sid: string;
  iat?: number;
  exp?: number;
}
