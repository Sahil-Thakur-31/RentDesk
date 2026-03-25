import { HydratedDocument, Schema, Types, model } from 'mongoose';

export type UtilityBillStatus = 'paid' | 'unpaid' | 'partial';
export type UtilityBillType = 'electricity' | 'water';

export interface IUtilityBill {
  propertyId: Types.ObjectId;
  unitId: Types.ObjectId;
  billType: UtilityBillType;
  month: string;
  meterStart: number;
  meterEnd: number;
  unitsConsumed: number;
  amount: number;
  status: UtilityBillStatus;
  billImageBase64?: string;
}

export type IUtilityBillDocument = HydratedDocument<IUtilityBill>;

const utilityBillSchema = new Schema<IUtilityBill>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
    billType: { type: String, enum: ['electricity', 'water'], required: true },
    month: { type: String, required: true },
    meterStart: { type: Number, required: true },
    meterEnd: { type: Number, required: true },
    unitsConsumed: { type: Number, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['paid', 'unpaid', 'partial'], default: 'unpaid' },
    billImageBase64: { type: String }
  },
  { timestamps: true }
);

utilityBillSchema.index({ propertyId: 1, unitId: 1, month: 1, billType: 1 });

export const UtilityBill = model<IUtilityBill>('UtilityBill', utilityBillSchema);
