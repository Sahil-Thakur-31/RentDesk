import { HydratedDocument, Schema, Types, model } from 'mongoose';

export type RentStatus = 'paid' | 'unpaid' | 'partial';

export interface IRentRecord {
  propertyId: Types.ObjectId;
  unitId: Types.ObjectId;
  tenantId: Types.ObjectId;
  month: number;
  year: number;
  rentAmount: number;
  status: RentStatus;
  paidDate?: Date;
  paymentMode?: string;
  receiptBase64?: string;
  paidAmount?: number;
}

export type IRentRecordDocument = HydratedDocument<IRentRecord>;

const rentRecordSchema = new Schema<IRentRecord>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    rentAmount: { type: Number, required: true },
    status: { type: String, enum: ['paid', 'unpaid', 'partial'], default: 'unpaid' },
    paidDate: { type: Date },
    paymentMode: { type: String },
    receiptBase64: { type: String },
    paidAmount: { type: Number }
  },
  { timestamps: true }
);

rentRecordSchema.index({ tenantId: 1, month: 1, year: 1 }, { unique: true });

export const RentRecord = model<IRentRecord>('RentRecord', rentRecordSchema);
