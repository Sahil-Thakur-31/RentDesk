import { HydratedDocument, Schema, Types, model } from 'mongoose';

export type UnitStatus = 'occupied' | 'vacant' | 'maintenance';
export type UnitType = 'single_room' | '1rk' | '1bhk' | '2bhk' | '3bhk' | 'shop' | 'office' | 'warehouse' | 'other';

export interface IUnit {
  propertyId: Types.ObjectId;
  unitNumber: string;
  unitType: UnitType;
  floor?: string;
  size?: string;
  monthlyRent: number;
  deposit: number;
  status: UnitStatus;
  currentTenant?: Types.ObjectId;
  maintenanceMode: boolean;
  maintenanceUntil?: Date;
  lastMeterReading?: number;
  lastMeterReadingDate?: Date;
  isArchived: boolean;
}

export type IUnitDocument = HydratedDocument<IUnit>;

const unitSchema = new Schema<IUnit>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    unitNumber: { type: String, required: true },
    unitType: {
      type: String,
      enum: ['single_room', '1rk', '1bhk', '2bhk', '3bhk', 'shop', 'office', 'warehouse', 'other'],
      required: true
    },
    floor: { type: String },
    size: { type: String },
    monthlyRent: { type: Number, required: true },
    deposit: { type: Number, required: true },
    status: { type: String, enum: ['occupied', 'vacant', 'maintenance'], default: 'vacant' },
    currentTenant: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceUntil: { type: Date },
    lastMeterReading: { type: Number, default: 0 },
    lastMeterReadingDate: { type: Date },
    isArchived: { type: Boolean, default: false }
  },
  { timestamps: true }
);

unitSchema.index({ propertyId: 1 });

export const Unit = model<IUnit>('Unit', unitSchema);
