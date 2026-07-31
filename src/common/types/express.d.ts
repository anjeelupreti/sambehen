import { ICurrentUser } from '../interfaces/auth.interface';

declare global {
  namespace Express {
    // Augment Express Request interface to include CurrentUser typed object
    interface Request {
      user?: ICurrentUser;
    }
  }
}
export {};
