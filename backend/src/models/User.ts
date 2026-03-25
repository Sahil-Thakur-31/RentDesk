import { HydratedDocument, Schema, Types, model } from 'mongoose';

export type UserRole = 'owner' | 'warden' | 'manager';

export interface IUser {
  fullName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  activePortfolioId?: Types.ObjectId;
  isActive: boolean;
  passwordResetOtpHash?: string;
  passwordResetOtpExpiresAt?: Date;
}

export type IUserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['owner', 'warden', 'manager'], default: 'owner' },
    activePortfolioId: { type: Schema.Types.ObjectId, ref: 'Portfolio' },
    isActive: { type: Boolean, default: true },
    passwordResetOtpHash: { type: String },
    passwordResetOtpExpiresAt: { type: Date }
  },
  { timestamps: true }
);

export const User = model<IUser>('User', userSchema);
