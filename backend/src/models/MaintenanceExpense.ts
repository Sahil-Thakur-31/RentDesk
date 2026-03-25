import { HydratedDocument, Schema, Types, model } from 'mongoose';

export interface IMaintenanceExpense {
  propertyId: Types.ObjectId;
  date: Date;
  category: string;
  description?: string;
  amount: number;
  paidTo?: string;
  receiptBase64?: string;
}

export type IMaintenanceExpenseDocument = HydratedDocument<IMaintenanceExpense>;

const maintenanceSchema = new Schema<IMaintenanceExpense>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    date: { type: Date, required: true },
    category: { type: String, required: true },
    description: { type: String },
    amount: { type: Number, required: true },
    paidTo: { type: String },
    receiptBase64: { type: String }
  },
  { timestamps: true }
);

maintenanceSchema.index({ propertyId: 1, date: -1 });

export const MaintenanceExpense = model<IMaintenanceExpense>('MaintenanceExpense', maintenanceSchema);
