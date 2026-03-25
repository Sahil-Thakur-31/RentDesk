import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { UtilityBill, type IUtilityBillDocument } from '../models/UtilityBill';
import { Property } from '../models/Property';
import { Unit } from '../models/Unit';
import { Payment } from '../models/Payment';
import { ensureBase64OrThrow } from '../utils/base64';
import { optionalString, requireString } from '../utils/request';

const calculateElectricityAmount = (unitsConsumed: number, rate: number, common: number) => Math.floor(unitsConsumed * rate + common);

const recalculateElectricityTimeline = async (propertyId: string, unitId: string, rate: number, common: number) => {
  const bills = await UtilityBill.find({ propertyId, unitId, billType: 'electricity' }).sort({ month: 1, createdAt: 1 });

  let previousReading = 0;
  for (const bill of bills) {
    bill.meterStart = previousReading;
    bill.unitsConsumed = Math.max(0, Number(bill.meterEnd) - previousReading);
    bill.amount = calculateElectricityAmount(bill.unitsConsumed, rate, common);
    await bill.save();
    previousReading = Number(bill.meterEnd);
  }

  const unit = await Unit.findOne({ _id: unitId, propertyId });
  if (unit) {
    unit.lastMeterReading = previousReading;
    unit.lastMeterReadingDate = bills.length ? new Date() : unit.lastMeterReadingDate;
    await unit.save();
  }
};

export const listUtilityBills = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const month = optionalString(req.query.month as string | string[] | undefined);
  const billType = optionalString(req.query.billType as string | string[] | undefined);
  const unitId = optionalString(req.query.unitId as string | string[] | undefined);
  const status = optionalString(req.query.status as string | string[] | undefined);
  const query: Record<string, unknown> = { propertyId };
  if (month) query.month = month;
  if (billType) query.billType = billType;
  if (unitId) query.unitId = unitId;
  if (status) {
    const raw = status.split(',').map((s) => s.trim()).filter(Boolean);
    if (raw.length === 1) query.status = raw[0];
    else if (raw.length > 1) query.status = { $in: raw };
  }

  const bills = await UtilityBill.find(query).sort({ createdAt: -1 }).populate('unitId', 'unitNumber');
  res.json(bills);
});

export const getUtilityBill = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const billId = requireString(req.params.billId, 'billId');
  const bill = await UtilityBill.findOne({ _id: billId, propertyId });
  if (!bill) throw new HttpError(404, 'Utility bill not found');
  res.json(bill);
});

export const createUtilityBill = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const { unitId, billType, month, meterStart, meterEnd, unitsConsumed, amount, status, billImageBase64 } = req.body;

  if (!unitId || !billType || !month || meterStart == null || meterEnd == null || unitsConsumed == null) {
    throw new HttpError(400, 'Missing required utility bill fields');
  }

  ensureBase64OrThrow(billImageBase64, 'billImageBase64');

  let finalAmount = amount;
  const isElectricity = String(billType).toLowerCase().includes('electric');
  if ((finalAmount == null || finalAmount === '') && isElectricity) {
    const property = await Property.findById(propertyId).select('electricityUnitRate commonElectricityCharge');
    const rate = property?.electricityUnitRate || 0;
    const common = property?.commonElectricityCharge || 0;
    if (rate > 0 && unitsConsumed != null) finalAmount = calculateElectricityAmount(Number(unitsConsumed), rate, common);
  }

  if (finalAmount == null || finalAmount === '') throw new HttpError(400, 'amount is required');

  const bill = await UtilityBill.create({
    propertyId,
    unitId,
    billType,
    month: String(month),
    meterStart,
    meterEnd,
    unitsConsumed,
    amount: Math.floor(Number(finalAmount)),
    status: status || 'unpaid',
    billImageBase64
  });

  if (isElectricity) {
    const property = await Property.findById(propertyId).select('electricityUnitRate commonElectricityCharge');
    await recalculateElectricityTimeline(propertyId, String(bill.unitId), property?.electricityUnitRate || 0, property?.commonElectricityCharge || 0);
  } else {
    await Unit.updateOne({ _id: bill.unitId, propertyId: bill.propertyId }, { $set: { lastMeterReading: bill.meterEnd, lastMeterReadingDate: new Date() } });
  }

  if (bill.status === 'paid' || bill.status === 'partial') {
    await Payment.create({
      type: 'utility',
      amount: bill.amount,
      date: new Date(),
      propertyId: bill.propertyId,
      unitId: bill.unitId,
      notes: `${bill.billType} bill for month ${bill.month}`,
      sourceType: 'utilityBill',
      sourceId: bill._id
    });
  }

  res.status(201).json(bill);
});

export const updateUtilityBill = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const billId = requireString(req.params.billId, 'billId');
  const bill = await UtilityBill.findOne({ _id: billId, propertyId });
  if (!bill) throw new HttpError(404, 'Utility bill not found');

  ensureBase64OrThrow(req.body.billImageBase64, 'billImageBase64');

  const previousStatus = bill.status;
  Object.assign(bill, req.body);
  await bill.save();

  if (bill.meterEnd != null) {
    if (String(bill.billType).toLowerCase() === 'electricity') {
      const property = await Property.findById(propertyId).select('electricityUnitRate commonElectricityCharge');
      await recalculateElectricityTimeline(propertyId, String(bill.unitId), property?.electricityUnitRate || 0, property?.commonElectricityCharge || 0);
    } else {
      await Unit.updateOne({ _id: bill.unitId, propertyId: bill.propertyId }, { $set: { lastMeterReading: bill.meterEnd, lastMeterReadingDate: new Date() } });
    }
  }

  if ((bill.status === 'paid' || bill.status === 'partial') && previousStatus !== bill.status) {
    await Payment.create({
      type: 'utility',
      amount: bill.amount,
      date: new Date(),
      propertyId: bill.propertyId,
      unitId: bill.unitId,
      notes: `${bill.billType} bill for month ${bill.month}`,
      sourceType: 'utilityBill',
      sourceId: bill._id
    });
  }
  res.json(bill);
});

export const bulkElectricityReadings = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const { month, readings } = req.body;
  if (!month || !Array.isArray(readings)) throw new HttpError(400, 'month and readings[] are required');

  const property = await Property.findById(propertyId).select('electricityUnitRate commonElectricityCharge');
  if (!property) throw new HttpError(404, 'Property not found');

  const rate = property.electricityUnitRate || 0;
  const common = property.commonElectricityCharge || 0;

  const results: IUtilityBillDocument[] = [];
  for (const item of readings) {
    const { unitId, currentReading } = item;
    if (!unitId || currentReading == null) continue;

    const unit = await Unit.findOne({ _id: unitId, propertyId });
    if (!unit) continue;

    const existingBill = await UtilityBill.findOne({ propertyId, unitId, billType: 'electricity', month: String(month) });

    const lastBillBefore = await UtilityBill.findOne({ propertyId, unitId, billType: 'electricity', month: { $lt: String(month) } }).sort({ month: -1 });
    const nextBillAfter = await UtilityBill.findOne({ propertyId, unitId, billType: 'electricity', month: { $gt: String(month) } }).sort({ month: 1 });

    const lastReading = lastBillBefore ? lastBillBefore.meterEnd : 0;
    if (Number(currentReading) <= lastReading) {
      throw new HttpError(400, `Current reading must be greater than last reading for unit ${unitId}`);
    }
    if (nextBillAfter && Number(currentReading) > Number(nextBillAfter.meterEnd)) {
      throw new HttpError(400, `Current reading for unit ${unit.unitNumber} cannot be greater than next saved month's reading (${nextBillAfter.meterEnd})`);
    }
    const consumed = Math.max(0, Number(currentReading) - lastReading);
    const amount = calculateElectricityAmount(consumed, rate, common);

    if (existingBill) {
      existingBill.meterStart = lastReading;
      existingBill.meterEnd = Number(currentReading);
      existingBill.unitsConsumed = consumed;
      existingBill.amount = amount;
      await existingBill.save();
      results.push(existingBill);
    } else {
      const bill = await UtilityBill.create({
        propertyId,
        unitId,
        billType: 'electricity',
        month: String(month),
        meterStart: lastReading,
        meterEnd: Number(currentReading),
        unitsConsumed: consumed,
        amount,
        status: 'unpaid'
      });
      results.push(bill);
    }

    await recalculateElectricityTimeline(propertyId, String(unit._id), rate, common);
  }

  res.json({ created: results.length, bills: results });
});

export const getElectricityReadings = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const month = optionalString(req.query.month as string | string[] | undefined);
  if (!month) throw new HttpError(400, 'month is required');

  const [property, units, bills] = await Promise.all([
    Property.findById(propertyId).select('electricityUnitRate commonElectricityCharge'),
    Unit.find({ propertyId, isArchived: false }).select('unitNumber'),
    UtilityBill.find({ propertyId, billType: 'electricity', month: { $lte: String(month) } })
  ]);

  if (!property) throw new HttpError(404, 'Property not found');

  const billByUnitMonth = new Map<string, IUtilityBillDocument>();
  for (const bill of bills) billByUnitMonth.set(`${bill.unitId.toString()}::${bill.month}`, bill);

  const rows = units.map((unit) => {
    const currentBill = billByUnitMonth.get(`${unit._id.toString()}::${String(month)}`);
    const previousBills = bills
      .filter((bill) => bill.unitId.toString() === unit._id.toString() && bill.month < String(month))
      .sort((a, b) => (a.month < b.month ? 1 : -1));
    const nextBills = bills
      .filter((bill) => bill.unitId.toString() === unit._id.toString() && bill.month > String(month))
      .sort((a, b) => (a.month > b.month ? 1 : -1));
    const lastBillBefore = previousBills[0];
    const nextBillAfter = nextBills[0];
    const lastReading = lastBillBefore ? lastBillBefore.meterEnd : 0;

    return {
      unitId: unit._id,
      unitNumber: unit.unitNumber,
      lastReading,
      currentReading: currentBill ? currentBill.meterEnd : null,
      nextReading: nextBillAfter ? nextBillAfter.meterEnd : null,
      calculatedUnits: currentBill ? currentBill.unitsConsumed : 0,
      calculatedAmount: currentBill ? currentBill.amount : 0
    };
  });

  res.json({
    rates: {
      electricityUnitRate: property.electricityUnitRate || 0,
      commonElectricityCharge: property.commonElectricityCharge || 0
    },
    rows
  });
});

export const deleteUtilityBill = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const billId = requireString(req.params.billId, 'billId');
  const bill = await UtilityBill.findOne({ _id: billId, propertyId });
  if (!bill) throw new HttpError(404, 'Utility bill not found');

  await bill.deleteOne();
  res.json({ message: 'Utility bill deleted' });
});
