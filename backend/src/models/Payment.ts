import { HydratedDocument, Schema, Types, model } from 'mongoose';

export type PaymentType = 'rent' | 'deposit' | 'maintenance' | 'utility' | 'refund' | 'other';
export type PaymentDirection = 'in' | 'out';

export interface IPayment {
  type: PaymentType;
  amount: number;
  date: Date;
  propertyId: Types.ObjectId;
  unitId?: Types.ObjectId;
  tenantId?: Types.ObjectId;
  notes?: string;
  sourceType?: string;
  sourceId?: Types.ObjectId;
  /** Only meaningful for types 'other' and 'maintenance' — rent/utility/deposit always flow in and refund always flows out. Defaults to 'in'. */
  direction?: PaymentDirection;
}

export type IPaymentDocument = HydratedDocument<IPayment>;

const paymentSchema = new Schema<IPayment>(
  {
    type: { type: String, enum: ['rent', 'deposit', 'maintenance', 'utility', 'refund', 'other'], required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit' },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    notes: { type: String },
    sourceType: { type: String },
    sourceId: { type: Schema.Types.ObjectId },
    direction: { type: String, enum: ['in', 'out'], default: 'in' }
  },
  { timestamps: true }
);

paymentSchema.index({ propertyId: 1, date: -1 });

export const Payment = model<IPayment>('Payment', paymentSchema);
