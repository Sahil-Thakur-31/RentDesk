import { Types, type PipelineStage } from 'mongoose';
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
import { emitPortfolioEvent } from '../ws/emit';
import { buildPaginatedResult, buildSearchRegexStage, isPaginatedRequest, parseListQuery, runPaginatedAggregate } from '../utils/listQuery';

const toMonthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

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

  const listParams = parseListQuery(req.query);

  if (!isPaginatedRequest(listParams)) {
    const records = await RentRecord.find(query).populate('tenantId', 'fullName phone').populate('unitId', 'unitNumber');
    res.json(records);
    return;
  }

  const matchStage: Record<string, unknown> = { propertyId: new Types.ObjectId(propertyId) };
  if (query.month != null) matchStage.month = query.month;
  if (query.year != null) matchStage.year = query.year;
  if (query.status != null) matchStage.status = query.status;

  const pipeline: PipelineStage[] = [
    { $match: matchStage },
    {
      $lookup: { from: 'tenants', localField: 'tenantId', foreignField: '_id', as: 'tenantId' }
    },
    { $unwind: { path: '$tenantId', preserveNullAndEmptyArrays: true } },
    {
      $lookup: { from: 'units', localField: 'unitId', foreignField: '_id', as: 'unitId' }
    },
    { $unwind: { path: '$unitId', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        tenantId: { _id: '$tenantId._id', fullName: '$tenantId.fullName', phone: '$tenantId.phone' },
        unitId: { _id: '$unitId._id', unitNumber: '$unitId.unitNumber' }
      }
    }
  ];

  const searchStage = buildSearchRegexStage(['tenantId.fullName', 'unitId.unitNumber'], listParams.search);
  if (searchStage) pipeline.push({ $match: searchStage });

  const sortDirection = listParams.sortDir === 'desc' ? -1 : 1;
  const sortStage: Record<string, 1 | -1> =
    listParams.sortKey === 'month'
      ? { year: sortDirection, month: sortDirection }
      : listParams.sortKey === 'amount'
        ? { rentAmount: sortDirection }
        : listParams.sortKey === 'status'
          ? { status: sortDirection }
          : { year: -1, month: -1 };
  pipeline.push({ $sort: { ...sortStage, _id: 1 } });

  const { data, total } = await runPaginatedAggregate(RentRecord, pipeline, listParams);
  res.json(buildPaginatedResult(data, total, listParams));
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

      const payment = await Payment.create({
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
      emitPortfolioEvent(req, { resource: 'payment', action: 'create', id: String(payment._id), data: payment });
    } else {
      existingRecord.status = status || existingRecord.status || 'unpaid';
      if (paidDate) existingRecord.paidDate = new Date(paidDate);
      if (paymentMode) existingRecord.paymentMode = paymentMode;
    }

    await existingRecord.save();

    const refreshedExisting = await RentRecord.findById(existingRecord._id)
      .populate('tenantId', 'fullName phone')
      .populate('unitId', 'unitNumber');

    emitPortfolioEvent(req, {
      resource: 'rentRecord',
      action: 'update',
      id: String(existingRecord._id),
      data: refreshedExisting,
      meta: { monthKey: toMonthKey(existingRecord.year, existingRecord.month) }
    });

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
    const payment = await Payment.create({
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
    emitPortfolioEvent(req, { resource: 'payment', action: 'create', id: String(payment._id), data: payment });
  }

  const refreshed = await RentRecord.findById(record._id).populate('tenantId', 'fullName phone').populate('unitId', 'unitNumber');

  emitPortfolioEvent(req, {
    resource: 'rentRecord',
    action: 'create',
    id: String(record._id),
    data: refreshed,
    meta: { monthKey: toMonthKey(record.year, record.month) }
  });

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
    const payment = await Payment.create({
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
    emitPortfolioEvent(req, { resource: 'payment', action: 'create', id: String(payment._id), data: payment });
  }

  emitPortfolioEvent(req, {
    resource: 'rentRecord',
    action: 'update',
    id: String(record._id),
    data: record,
    meta: { monthKey: toMonthKey(record.year, record.month) }
  });

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

  const payment = await Payment.create({
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
  emitPortfolioEvent(req, { resource: 'payment', action: 'create', id: String(payment._id), data: payment });

  const refreshed = await RentRecord.findById(record._id).populate('tenantId', 'fullName phone').populate('unitId', 'unitNumber');

  emitPortfolioEvent(req, {
    resource: 'rentRecord',
    action: 'update',
    id: String(record._id),
    data: refreshed,
    meta: { monthKey: toMonthKey(record.year, record.month) }
  });

  res.json(refreshed);
});

export const generateMonthly = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const month = Number(req.body.month);
  const year = Number(req.body.year);
  if (!month || !year) throw new HttpError(400, 'month and year are required');

  const result = await generateMonthlyRent({ propertyId, month, year });

  emitPortfolioEvent(req, { resource: 'rentRecord', action: 'bulkGenerate', meta: { monthKey: toMonthKey(year, month) } });

  res.json(result);
});
