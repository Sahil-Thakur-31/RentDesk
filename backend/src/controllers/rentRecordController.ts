import dayjs from 'dayjs';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { RentRecord } from '../models/RentRecord';
import { Unit } from '../models/Unit';
import { Tenant } from '../models/Tenant';
import { Payment } from '../models/Payment';
import { ensureBase64OrThrow } from '../utils/base64';
import { generateMonthlyRent } from '../services/rentGenerationService';
import { optionalString, requireString } from '../utils/request';

export const listRentRecords = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const month = optionalString(req.query.month as string | string[] | undefined);
  const year = optionalString(req.query.year as string | string[] | undefined);
  const status = optionalString(req.query.status as string | string[] | undefined);
  const query: Record<string, unknown> = { propertyId };
  if (month) query.month = Number(month);
  if (year) query.year = Number(year);
  if (status) {
    const raw = status
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (raw.length === 1) {
      query.status = raw[0];
    } else if (raw.length > 1) {
      query.status = { $in: raw };
    }
  }

  const records = await RentRecord.find(query).populate('tenantId', 'fullName phone').populate('unitId', 'unitNumber');
  res.json(records);
});

export const createRentRecord = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const { unitId, tenantId, month, year, rentAmount, status, paidDate, paymentMode, receiptBase64, paidAmount } = req.body;

  const parsedMonth = Number(month);
  const parsedYear = Number(year);
  const parsedRentAmount = Number(rentAmount);
  const parsedPaidAmount = Number(paidAmount || 0);

  if (!unitId || !tenantId || !parsedMonth || !parsedYear || !parsedRentAmount) {
    throw new HttpError(400, 'Missing required rent record fields');
  }

  ensureBase64OrThrow(receiptBase64, 'receiptBase64');

  const unit = await Unit.findOne({ _id: unitId, propertyId });
  if (!unit) throw new HttpError(404, 'Unit not found');

  const tenant = await Tenant.findOne({ _id: tenantId, propertyId });
  if (!tenant) throw new HttpError(404, 'Tenant not found');

  const existingRecord = await RentRecord.findOne({ propertyId, tenantId, month: parsedMonth, year: parsedYear });

  if (existingRecord) {
    existingRecord.unitId = unit._id;
    existingRecord.rentAmount = parsedRentAmount;
    existingRecord.receiptBase64 = receiptBase64 ?? existingRecord.receiptBase64;

    if (parsedPaidAmount > 0) {
      const alreadyPaid = existingRecord.paidAmount || 0;
      const remaining = Math.max(0, existingRecord.rentAmount - alreadyPaid);
      if (parsedPaidAmount > remaining) {
        throw new HttpError(400, 'Payment amount cannot exceed remaining rent');
      }

      existingRecord.paidAmount = alreadyPaid + parsedPaidAmount;
      existingRecord.paidDate = paidDate ? new Date(paidDate) : new Date();
      existingRecord.paymentMode = paymentMode || existingRecord.paymentMode || 'cash';
      existingRecord.status = existingRecord.paidAmount >= existingRecord.rentAmount ? 'paid' : 'partial';

      await Payment.create({
        type: 'rent',
        amount: parsedPaidAmount,
        date: existingRecord.paidDate,
        propertyId: existingRecord.propertyId,
        unitId: existingRecord.unitId,
        tenantId: existingRecord.tenantId,
        notes: `Rent payment for ${dayjs().month(existingRecord.month - 1).format('MMM')} ${existingRecord.year}`,
        sourceType: 'rentRecord',
        sourceId: existingRecord._id
      });
    } else {
      existingRecord.status = status || existingRecord.status || 'unpaid';
      if (paidDate) existingRecord.paidDate = new Date(paidDate);
      if (paymentMode) existingRecord.paymentMode = paymentMode;
    }

    await existingRecord.save();

    const refreshedExisting = await RentRecord.findById(existingRecord._id)
      .populate('tenantId', 'fullName phone')
      .populate('unitId', 'unitNumber');

    res.json(refreshedExisting);
    return;
  }

  const resolvedStatus = status || (parsedPaidAmount >= parsedRentAmount ? 'paid' : parsedPaidAmount > 0 ? 'partial' : 'unpaid');

  const record = await RentRecord.create({
    propertyId,
    unitId,
    tenantId,
    month: parsedMonth,
    year: parsedYear,
    rentAmount: parsedRentAmount,
    status: resolvedStatus,
    paidDate,
    paymentMode,
    receiptBase64,
    paidAmount: parsedPaidAmount || undefined
  });

  if (record.status === 'paid' || record.status === 'partial') {
    await Payment.create({
      type: 'rent',
      amount: parsedPaidAmount || (record.status === 'paid' ? record.rentAmount : record.paidAmount || 0),
      date: record.paidDate || new Date(),
      propertyId: record.propertyId,
      unitId: record.unitId,
      tenantId: record.tenantId,
      notes: `Rent payment for ${dayjs().month(record.month - 1).format('MMM')} ${record.year}`,
      sourceType: 'rentRecord',
      sourceId: record._id
    });
  }

  const refreshed = await RentRecord.findById(record._id).populate('tenantId', 'fullName phone').populate('unitId', 'unitNumber');

  res.status(201).json(refreshed);
});

export const updateRentRecord = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const recordId = requireString(req.params.recordId, 'recordId');
  const record = await RentRecord.findOne({ _id: recordId, propertyId });
  if (!record) throw new HttpError(404, 'Rent record not found');

  ensureBase64OrThrow(req.body.receiptBase64, 'receiptBase64');

  const previousStatus = record.status;
  Object.assign(record, req.body);
  await record.save();

  if ((record.status === 'paid' || record.status === 'partial') && previousStatus !== record.status) {
    await Payment.create({
      type: 'rent',
      amount: record.status === 'paid' ? record.rentAmount : record.paidAmount || 0,
      date: record.paidDate || new Date(),
      propertyId: record.propertyId,
      unitId: record.unitId,
      tenantId: record.tenantId,
      notes: `Rent payment for ${dayjs().month(record.month - 1).format('MMM')} ${record.year}`,
      sourceType: 'rentRecord',
      sourceId: record._id
    });
  }

  res.json(record);
});

export const collectRentPayment = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const recordId = requireString(req.params.recordId, 'recordId');
  const record = await RentRecord.findOne({ _id: recordId, propertyId });
  if (!record) throw new HttpError(404, 'Rent record not found');

  const amount = Number(req.body.amount);
  const paymentMode = req.body.paymentMode || 'cash';
  const paidDate = req.body.paidDate ? new Date(req.body.paidDate) : new Date();

  if (!amount || amount <= 0) {
    throw new HttpError(400, 'Payment amount must be greater than 0');
  }

  const alreadyPaid = record.paidAmount || 0;
  const remaining = Math.max(0, record.rentAmount - alreadyPaid);
  if (amount > remaining) {
    throw new HttpError(400, 'Payment amount cannot exceed remaining rent');
  }

  record.paidAmount = alreadyPaid + amount;
  record.paidDate = paidDate;
  record.paymentMode = paymentMode;
  record.status = record.paidAmount >= record.rentAmount ? 'paid' : 'partial';
  await record.save();

  await Payment.create({
    type: 'rent',
    amount,
    date: paidDate,
    propertyId: record.propertyId,
    unitId: record.unitId,
    tenantId: record.tenantId,
    notes: `Rent payment for ${dayjs().month(record.month - 1).format('MMM')} ${record.year}`,
    sourceType: 'rentRecord',
    sourceId: record._id
  });

  const refreshed = await RentRecord.findById(record._id).populate('tenantId', 'fullName phone').populate('unitId', 'unitNumber');

  res.json(refreshed);
});

export const generateMonthly = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const month = Number(req.body.month);
  const year = Number(req.body.year);
  if (!month || !year) throw new HttpError(400, 'month and year are required');

  const result = await generateMonthlyRent({ propertyId, month, year });

  res.json(result);
});
