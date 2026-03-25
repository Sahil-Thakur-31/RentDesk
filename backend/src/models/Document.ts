import { HydratedDocument, Schema, Types, model } from 'mongoose';

export interface IDocument {
  ownerType: string;
  ownerId: Types.ObjectId;
  name: string;
  mimeType: string;
  base64: string;
  createdBy: Types.ObjectId;
}

export type IDocumentDocument = HydratedDocument<IDocument>;

const documentSchema = new Schema<IDocument>(
  {
    ownerType: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
    base64: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const Document = model<IDocument>('Document', documentSchema);
