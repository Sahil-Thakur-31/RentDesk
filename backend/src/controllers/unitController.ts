import { Types, type PipelineStage } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { Unit } from '../models/Unit';
import { Tenant } from '../models/Tenant';
import { Payment } from '../models/Payment';
import { RentRecord } from '../models/RentRecord';
import { UtilityBill } from '../models/UtilityBill';
import { Property } from '../models/Property';
import { applyDerivedUnitStatus, syncPropertyUnitStatuses, syncUnitStatus } from '../services/unitStatusService';
import { requireString } from '../utils/request';
import { emitPortfolioEvent } from '../ws/emit';
import { buildPaginatedResult, buildSearchRegexStage, isPaginatedRequest, parseListQuery, runPaginatedAggregate } from '../utils/listQuery';

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

  const listParams = parseListQuery(req.query);

  if (!isPaginatedRequest(listParams)) {
    const units = await Unit.find(query).sort({ createdAt: -1 });
    res.json(units);
    return;
  }

  const matchStage: Record<string, unknown> = { propertyId: new Types.ObjectId(propertyId) };
  if (typeof isArchivedFilter === 'boolean') matchStage.isArchived = isArchivedFilter;

  const unitStatusFilter = String(req.query.unitStatus || '').trim();
  if (unitStatusFilter) matchStage.status = unitStatusFilter;

  const pipeline: PipelineStage[] = [{ $match: matchStage }];

  const searchStage = buildSearchRegexStage(['unitNumber', 'floor'], listParams.search);
  if (searchStage) pipeline.push({ $match: searchStage });

  const sortFieldMap: Record<string, string> = {
    unitNumber: 'unitNumber',
    floor: 'floor',
    meterReading: 'lastMeterReading',
    rent: 'monthlyRent',
    status: 'status'
  };
  const sortField = sortFieldMap[listParams.sortKey || ''] || 'createdAt';
  const sortDirection = listParams.sortDir === 'desc' ? -1 : 1;
  pipeline.push({ $sort: { [sortField]: sortDirection, _id: 1 } });

  const { data, total } = await runPaginatedAggregate(Unit, pipeline, listParams);
  res.json(buildPaginatedResult(data, total, listParams));
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

  emitPortfolioEvent(req, { resource: 'unit', action: 'create', id: String(unit._id), data: unit });

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
    if (maintenanceMode && unit.currentTenant) {
      throw new HttpError(400, 'Cannot turn on repair mode while a tenant is living in this unit. Move the tenant out first.');
    }
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
  applyDerivedUnitStatus(unit);
  await unit.save();
  emitPortfolioEvent(req, { resource: 'unit', action: 'update', id: String(unit._id), data: unit });
  res.json(unit);
});

export const getUnitDetails = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const unitId = requireString(req.params.unitId, 'unitId');
  const unit = await Unit.findOne({ _id: unitId, propertyId }).populate('currentTenant', 'fullName phone email movedInDate createdAt');

  if (!unit) throw new HttpError(404, 'Unit not found');
  await syncUnitStatus(unit);

  const [tenants, payments, rentRecords, utilityBills] = await Promise.all([
    Tenant.find({ propertyId, assignedUnit: unit._id }).sort({ createdAt: -1 }).select('fullName phone email isActive movedInDate movedOutDate createdAt'),
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

  if (unit.currentTenant) {
    throw new HttpError(400, 'Cannot deactivate a unit with an active tenant. Move the tenant out first.');
  }

  unit.isArchived = true;
  await unit.save();
  emitPortfolioEvent(req, { resource: 'unit', action: 'archive', id: String(unit._id) });
  res.json({ message: 'Unit archived' });
});

export const restoreUnit = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const unitId = requireString(req.params.unitId, 'unitId');
  const unit = await Unit.findOne({ _id: unitId, propertyId });
  if (!unit) throw new HttpError(404, 'Unit not found');

  unit.isArchived = false;
  await unit.save();

  let propertyRestored = false;
  const property = await Property.findById(propertyId);
  if (property?.isArchived) {
    property.isArchived = false;
    await property.save();
    propertyRestored = true;
    emitPortfolioEvent(req, { resource: 'property', action: 'restore', id: String(property._id) });
  }

  emitPortfolioEvent(req, { resource: 'unit', action: 'restore', id: String(unit._id) });
  res.json({ message: propertyRestored ? 'Unit and its property restored' : 'Unit restored', propertyRestored });
});
