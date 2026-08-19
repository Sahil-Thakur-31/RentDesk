import { Types, type PipelineStage } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { MaintenanceExpense } from '../models/MaintenanceExpense';
import { Payment } from '../models/Payment';
import { ensureBase64OrThrow } from '../utils/base64';
import { optionalString, requireString } from '../utils/request';
import { emitPortfolioEvent } from '../ws/emit';
import { buildPaginatedResult, buildSearchRegexStage, isPaginatedRequest, parseListQuery, runPaginatedAggregate } from '../utils/listQuery';

const toMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const listMaintenance = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const month = optionalString(req.query.month as string | string[] | undefined);

  const query: Record<string, unknown> = { propertyId };
  let dateRange: { $gte: Date; $lt: Date } | undefined;
  if (month) {
    const [year, monthNum] = month.split('-').map(Number);
    if (year && monthNum) {
      dateRange = { $gte: new Date(year, monthNum - 1, 1), $lt: new Date(year, monthNum, 1) };
      query.date = dateRange;
    }
  }

  const listParams = parseListQuery(req.query);

  if (!isPaginatedRequest(listParams)) {
    const records = await MaintenanceExpense.find(query).sort({ date: -1 });
    res.json(records);
    return;
  }

  const matchStage: Record<string, unknown> = { propertyId: new Types.ObjectId(propertyId) };
  if (dateRange) matchStage.date = dateRange;

  const pipeline: PipelineStage[] = [{ $match: matchStage }];

  const searchStage = buildSearchRegexStage(['category', 'paidTo', 'description'], listParams.search);
  if (searchStage) pipeline.push({ $match: searchStage });

  const sortFieldMap: Record<string, string> = {
    date: 'date',
    amount: 'amount',
    category: 'category'
  };
  const sortField = sortFieldMap[listParams.sortKey || ''] || 'date';
  const sortDirection = listParams.sortKey ? (listParams.sortDir === 'desc' ? -1 : 1) : -1;
  pipeline.push({ $sort: { [sortField]: sortDirection, _id: 1 } });

  const { data, total } = await runPaginatedAggregate(MaintenanceExpense, pipeline, listParams);
  res.json(buildPaginatedResult(data, total, listParams));
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

  const payment = await Payment.create({
    type: 'maintenance',
    amount: record.amount,
    date: record.date,
    propertyId: record.propertyId,
    notes: record.description || record.category,
    sourceType: 'maintenance',
    sourceId: record._id
  });
  emitPortfolioEvent(req, { resource: 'payment', action: 'create', id: String(payment._id), data: payment });
  emitPortfolioEvent(req, { resource: 'maintenance', action: 'create', id: String(record._id), data: record, meta: { monthKey: toMonthKey(new Date(record.date)) } });

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
  emitPortfolioEvent(req, { resource: 'maintenance', action: 'update', id: String(record._id), data: record, meta: { monthKey: toMonthKey(new Date(record.date)) } });
  res.json(record);
});

export const deleteMaintenance = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const expenseId = requireString(req.params.expenseId, 'expenseId');
  const record = await MaintenanceExpense.findOne({ _id: expenseId, propertyId });
  if (!record) throw new HttpError(404, 'Maintenance record not found');

  await record.deleteOne();
  emitPortfolioEvent(req, { resource: 'maintenance', action: 'delete', id: String(record._id), meta: { monthKey: toMonthKey(new Date(record.date)) } });
  res.json({ message: 'Maintenance record deleted' });
});
