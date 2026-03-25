import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { MaintenanceExpense } from '../models/MaintenanceExpense';
import { Payment } from '../models/Payment';
import { ensureBase64OrThrow } from '../utils/base64';
import { requireString } from '../utils/request';

export const listMaintenance = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const records = await MaintenanceExpense.find({ propertyId }).sort({ date: -1 });
  res.json(records);
});

export const getMaintenance = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const expenseId = requireString(req.params.expenseId, 'expenseId');
  const record = await MaintenanceExpense.findOne({ _id: expenseId, propertyId });
  if (!record) throw new HttpError(404, 'Maintenance record not found');
  res.json(record);
});

export const createMaintenance = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const { date, category, description, amount, paidTo, receiptBase64 } = req.body;
  if (!date || !category || amount == null) throw new HttpError(400, 'Missing maintenance fields');

  ensureBase64OrThrow(receiptBase64, 'receiptBase64');

  const record = new MaintenanceExpense({
    propertyId,
    date,
    category,
    description,
    amount,
    paidTo,
    receiptBase64
  });
  await record.save();

  await Payment.create({
    type: 'maintenance',
    amount: record.amount,
    date: record.date,
    propertyId: record.propertyId,
    notes: record.description || record.category,
    sourceType: 'maintenance',
    sourceId: record._id
  });

  res.status(201).json(record);
});

export const updateMaintenance = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const expenseId = requireString(req.params.expenseId, 'expenseId');
  const record = await MaintenanceExpense.findOne({ _id: expenseId, propertyId });
  if (!record) throw new HttpError(404, 'Maintenance record not found');

  ensureBase64OrThrow(req.body.receiptBase64, 'receiptBase64');

  Object.assign(record, req.body);
  await record.save();
  res.json(record);
});

export const deleteMaintenance = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const expenseId = requireString(req.params.expenseId, 'expenseId');
  const record = await MaintenanceExpense.findOne({ _id: expenseId, propertyId });
  if (!record) throw new HttpError(404, 'Maintenance record not found');

  await record.deleteOne();
  res.json({ message: 'Maintenance record deleted' });
});
