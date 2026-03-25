import { IUserDocument } from '../models/User';
import { IPropertyDocument } from '../models/Property';

declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
      property?: IPropertyDocument;
      userRole?: 'owner' | 'warden' | 'manager';
    }
  }
}

export {};
