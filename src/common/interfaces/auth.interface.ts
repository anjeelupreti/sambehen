export interface ICurrentUser {
  id: string;
  email: string;
  username: string;
  role: string;
  permissions?: string[];
}

export interface IJwtPayload {
  sub: string;
  email: string;
  username: string;
  role: string;
  permissions?: string[];
}
