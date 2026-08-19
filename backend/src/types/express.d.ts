import { IUserDocument } from '../models/User';
import { IPropertyDocument } from '../models/Property';
import { IPortfolioDocument } from '../models/Portfolio';

declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
      property?: IPropertyDocument;
      portfolio?: IPortfolioDocument;
      userRole?: 'owner' | 'warden' | 'manager';
    }
  }
}

export {};
