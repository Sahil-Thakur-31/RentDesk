import { HydratedDocument, Schema, Types, model } from 'mongoose';
import { UserRole } from './User';

export type PropertyType = 'building' | 'flat' | 'shop' | 'commercial' | 'plot';

export interface PropertyMember {
  user: Types.ObjectId;
  role: UserRole;
  addedAt: Date;
}

export interface PropertyJoinRequest {
  user: Types.ObjectId;
  requestedAt: Date;
}

export interface IProperty {
  portfolioId?: Types.ObjectId;
  name: string;
  propertyType: PropertyType;
  address: string;
  city: string;
  state: string;
  pincode: string;
  size?: string;
  notes?: string;
  activeSince?: Date;
  maintenanceCharge?: number;
  electricityUnitRate?: number;
  commonElectricityCharge?: number;
  createdBy: Types.ObjectId;
  joinCode?: string;
  members: PropertyMember[];
  joinRequests: PropertyJoinRequest[];
  isArchived: boolean;
}

export type IPropertyDocument = HydratedDocument<IProperty>;

const memberSchema = new Schema<PropertyMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'warden', 'manager'], required: true },
    addedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const joinRequestSchema = new Schema<PropertyJoinRequest>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const propertySchema = new Schema<IProperty>(
  {
    portfolioId: { type: Schema.Types.ObjectId, ref: 'Portfolio' },
    name: { type: String, required: true },
    propertyType: { type: String, enum: ['building', 'flat', 'shop', 'commercial', 'plot'], required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    size: { type: String },
    notes: { type: String },
    activeSince: { type: Date },
    maintenanceCharge: { type: Number, default: 0 },
    electricityUnitRate: { type: Number, default: 0 },
    commonElectricityCharge: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    joinCode: { type: String },
    members: { type: [memberSchema], default: [] },
    joinRequests: { type: [joinRequestSchema], default: [] },
    isArchived: { type: Boolean, default: false }
  },
  { timestamps: true }
);

propertySchema.index({ 'members.user': 1 });
propertySchema.index({ portfolioId: 1 });
propertySchema.index({ joinCode: 1 }, { unique: true, sparse: true });

export const Property = model<IProperty>('Property', propertySchema);
