import { HydratedDocument, Schema, Types, model } from 'mongoose';

export interface TenantDocuments {
  idProofBase64?: string;
  policeVerificationBase64?: string;
}

export interface ITenant {
  propertyId: Types.ObjectId;
  unitId: Types.ObjectId;
  fullName: string;
  phone: string;
  email?: string;
  idProofType?: string;
  idProofNumber?: string;
  emergencyContact?: string;
  rentAmount: number;
  depositAmount: number;
  assignedUnit: Types.ObjectId;
  photoBase64?: string;
  documents?: TenantDocuments;
  isActive: boolean;
  movedOutDate?: Date;
}

export type ITenantDocument = HydratedDocument<ITenant>;

const tenantSchema = new Schema<ITenant>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, trim: true, lowercase: true },
    idProofType: { type: String },
    idProofNumber: { type: String },
    emergencyContact: { type: String },
    rentAmount: { type: Number, required: true },
    depositAmount: { type: Number, required: true },
    assignedUnit: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
    photoBase64: { type: String },
    documents: {
      idProofBase64: { type: String },
      policeVerificationBase64: { type: String }
    },
    isActive: { type: Boolean, default: true },
    movedOutDate: { type: Date }
  },
  { timestamps: true }
);

tenantSchema.index({ propertyId: 1, unitId: 1, isActive: 1 });

export const Tenant = model<ITenant>('Tenant', tenantSchema);
