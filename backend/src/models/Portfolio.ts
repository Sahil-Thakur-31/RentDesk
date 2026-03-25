import { HydratedDocument, Schema, Types, model } from 'mongoose';
import { UserRole } from './User';

export interface PortfolioMember {
  user: Types.ObjectId;
  role: UserRole;
  propertyIds: Types.ObjectId[];
  addedAt: Date;
}

export interface PortfolioJoinRequest {
  user: Types.ObjectId;
  requestedAt: Date;
}

export interface IPortfolio {
  name: string;
  ownerUser: Types.ObjectId;
  joinCode: string;
  rentDueDay: number;
  electricityDueDay: number;
  maintenanceDueDay: number;
  reminderLeadDays: number;
  members: PortfolioMember[];
  joinRequests: PortfolioJoinRequest[];
}

export type IPortfolioDocument = HydratedDocument<IPortfolio>;

const portfolioMemberSchema = new Schema<PortfolioMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'warden', 'manager'], required: true },
    propertyIds: { type: [Schema.Types.ObjectId], ref: 'Property', default: [] },
    addedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const portfolioJoinRequestSchema = new Schema<PortfolioJoinRequest>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const portfolioSchema = new Schema<IPortfolio>(
  {
    name: { type: String, required: true },
    ownerUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    joinCode: { type: String, required: true, unique: true },
    rentDueDay: { type: Number, default: 5, min: 1, max: 28 },
    electricityDueDay: { type: Number, default: 10, min: 1, max: 28 },
    maintenanceDueDay: { type: Number, default: 7, min: 1, max: 28 },
    reminderLeadDays: { type: Number, default: 1, min: 0, max: 7 },
    members: { type: [portfolioMemberSchema], default: [] },
    joinRequests: { type: [portfolioJoinRequestSchema], default: [] }
  },
  { timestamps: true }
);

portfolioSchema.index({ 'members.user': 1 });
portfolioSchema.index({ joinCode: 1 }, { unique: true });

export const Portfolio = model<IPortfolio>('Portfolio', portfolioSchema);
