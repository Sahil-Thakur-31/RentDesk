import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { Unit } from '../models/Unit';
import { Tenant } from '../models/Tenant';
import { Payment } from '../models/Payment';
import { RentRecord } from '../models/RentRecord';
import { UtilityBill } from '../models/UtilityBill';
import { syncPropertyUnitStatuses, syncUnitStatus } from '../services/unitStatusService';
import { requireString } from '../utils/request';

export const listUnits = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  await syncPropertyUnitStatuses(propertyId);
  const status = String(req.query.status || '').toLowerCase();
  const archivedParam = String(req.query.archived || '').toLowerCase();
  let isArchivedFilter: boolean | undefined = false;

  if (status === 'all') {
    isArchivedFilter = undefined;
  } else if (status === 'archived' || archivedParam === 'true') {
    isArchivedFilter = true;
  } else if (status === 'active') {
    isArchivedFilter = false;
  }

  const query: Record<string, unknown> = { propertyId };
  if (typeof isArchivedFilter === 'boolean') {
    query.isArchived = isArchivedFilter;
  }

  const units = await Unit.find(query).sort({ createdAt: -1 });
  res.json(units);
});

export const getUnit = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const unitId = requireString(req.params.unitId, 'unitId');
  const unit = await Unit.findOne({ _id: unitId, propertyId }).populate('currentTenant', 'fullName phone');

  if (!unit) throw new HttpError(404, 'Unit not found');
  await syncUnitStatus(unit);
  res.json(unit);
});

export const createUnit = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const { unitNumber, unitType, floor, size, monthlyRent, deposit, lastMeterReading } = req.body;
  if (!unitNumber || !unitType || monthlyRent == null || deposit == null) {
    throw new HttpError(400, 'unitNumber, unitType, monthlyRent and deposit are required');
  }

  const unit = await Unit.create({
    propertyId,
    unitNumber,
    unitType,
    floor,
    size,
    monthlyRent,
    deposit,
    maintenanceMode: false,
    status: 'vacant',
    lastMeterReading,
    lastMeterReadingDate: lastMeterReading != null ? new Date() : undefined
  });

  res.status(201).json(unit);
});

export const updateUnit = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const unitId = requireString(req.params.unitId, 'unitId');
  const unit = await Unit.findOne({ _id: unitId, propertyId });
  if (!unit) throw new HttpError(404, 'Unit not found');

  const { status, currentTenant, lastMeterReadingDate, maintenanceMode, maintenanceUntil, ...updates } = req.body;
  Object.assign(unit, updates);
  if (typeof maintenanceMode === 'boolean') {
    unit.maintenanceMode = maintenanceMode;
    unit.maintenanceUntil = maintenanceMode
      ? maintenanceUntil
        ? new Date(maintenanceUntil)
        : undefined
      : undefined;
  }
  if (updates.lastMeterReading != null) {
    unit.lastMeterReadingDate = new Date();
  }
  await syncUnitStatus(unit);
  res.json(unit);
});

export const getUnitDetails = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const unitId = requireString(req.params.unitId, 'unitId');
  const unit = await Unit.findOne({ _id: unitId, propertyId }).populate('currentTenant', 'fullName phone email');

  if (!unit) throw new HttpError(404, 'Unit not found');
  await syncUnitStatus(unit);

  const [tenants, payments, rentRecords, utilityBills] = await Promise.all([
    Tenant.find({ propertyId, assignedUnit: unit._id }).sort({ createdAt: -1 }).select('fullName phone email isActive movedOutDate'),
    Payment.find({ propertyId, unitId: unit._id }).sort({ date: -1 }).select('type amount date notes tenantId'),
    RentRecord.find({ propertyId, unitId: unit._id }).sort({ year: -1, month: -1 }),
    UtilityBill.find({ propertyId, unitId: unit._id }).sort({ createdAt: -1 })
  ]);

  res.json({
    unit,
    tenants,
    payments,
    rentRecords,
    utilityBills
  });
});

export const archiveUnit = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const unitId = requireString(req.params.unitId, 'unitId');
  const unit = await Unit.findOne({ _id: unitId, propertyId });
  if (!unit) throw new HttpError(404, 'Unit not found');

  unit.isArchived = true;
  await unit.save();
  res.json({ message: 'Unit archived' });
});

export const restoreUnit = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const unitId = requireString(req.params.unitId, 'unitId');
  const unit = await Unit.findOne({ _id: unitId, propertyId });
  if (!unit) throw new HttpError(404, 'Unit not found');

  unit.isArchived = false;
  await unit.save();
  res.json({ message: 'Unit restored' });
});
