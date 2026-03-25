import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { Payment } from '../models/Payment';
import { optionalString, requireString } from '../utils/request';

export const listPayments = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const type = optionalString(req.query.type as string | string[] | undefined);
  const startDate = optionalString(req.query.startDate as string | string[] | undefined);
  const endDate = optionalString(req.query.endDate as string | string[] | undefined);

  const query: Record<string, unknown> = { propertyId };
  if (type) query.type = type;
  if (startDate || endDate) {
    query.date = {};
    if (startDate) (query.date as Record<string, unknown>).$gte = new Date(startDate);
    if (endDate) (query.date as Record<string, unknown>).$lte = new Date(endDate);
  }

  const payments = await Payment.find(query)
    .sort({ date: -1 })
    .populate('tenantId', 'fullName')
    .populate('unitId', 'unitNumber');
  res.json(payments);
});

export const createPayment = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const { type, amount, date, unitId, tenantId, notes } = req.body;
  if (!type || amount == null || !date) {
    throw new HttpError(400, 'type, amount and date are required');
  }

  const payment = await Payment.create({
    type,
    amount,
    date: new Date(date),
    propertyId,
    unitId,
    tenantId,
    notes,
    sourceType: 'manual'
  });

  res.status(201).json(payment);
});
