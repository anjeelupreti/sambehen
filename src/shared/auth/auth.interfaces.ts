export interface ITokenResponse {
  accessToken: string;
  refreshToken: string;
}
export interface IAuthStatus {
  authenticated: boolean;
  role?: string;
}
