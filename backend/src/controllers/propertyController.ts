import { Types } from 'mongoose';
import dayjs from 'dayjs';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { Property } from '../models/Property';
import { Unit } from '../models/Unit';
import { RentRecord } from '../models/RentRecord';
import { syncPropertyUnitStatuses } from '../services/unitStatusService';
import {
  addPropertyAccessToMember,
  ensurePropertyPortfolio,
  getAccessiblePropertyIdsForUser,
  getMembershipForUser,
  getUserPortfolio
} from '../services/portfolioService';
import { requireString } from '../utils/request';
import { requireFields, requireNonNegative } from '../utils/validation';
import { emitPortfolioEvent } from '../ws/emit';

const getId = (value: any) => String(value?._id || value || '');

export const createProperty = asyncHandler(async (req, res) => {
  const {
    name,
    propertyType,
    address,
    city,
    state,
    pincode,
    size,
    notes,
    activeSince,
    maintenanceCharge,
    electricityUnitRate,
    commonElectricityCharge
  } = req.body;

  if (!req.user) throw new HttpError(401, 'Unauthorized');
  requireFields(req.body, ['name', 'propertyType', 'address', 'city', 'state', 'pincode']);
  if (maintenanceCharge != null) requireNonNegative(maintenanceCharge, 'maintenanceCharge');
  if (electricityUnitRate != null) requireNonNegative(electricityUnitRate, 'electricityUnitRate');
  if (commonElectricityCharge != null) requireNonNegative(commonElectricityCharge, 'commonElectricityCharge');

  const portfolio = await getUserPortfolio(req.user);
  if (!portfolio) {
    throw new HttpError(400, 'You must create or join a portfolio before adding properties');
  }

  const membership = getMembershipForUser(portfolio, req.user._id);
  if (!membership) {
    throw new HttpError(403, 'Portfolio access not found');
  }

  const property = await Property.create({
    portfolioId: portfolio._id,
    name,
    propertyType,
    address,
    city,
    state,
    pincode,
    size,
    notes,
    activeSince: activeSince ? new Date(activeSince) : undefined,
    maintenanceCharge,
    electricityUnitRate,
    commonElectricityCharge,
    createdBy: req.user._id,
    members: [],
    joinRequests: []
  });

  portfolio.members.forEach((member) => {
    if (member.role === 'owner' || getId(member.user) === getId(req.user?._id)) {
      addPropertyAccessToMember(member, property._id);
    }
  });
  await portfolio.save();

  emitPortfolioEvent(req, {
    resource: 'property',
    action: 'create',
    id: getId(property._id),
    data: property,
    portfolioId: getId(portfolio._id)
  });

  res.status(201).json(property);
});

export const listProperties = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const accessiblePropertyIds = await getAccessiblePropertyIdsForUser(req.user);
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

  const query: Record<string, any> = { _id: { $in: accessiblePropertyIds } };
  if (typeof isArchivedFilter === 'boolean') {
    query.isArchived = isArchivedFilter;
  }

  const properties = await Property.find(query).sort({ createdAt: -1 });
  res.json(properties);
});

export const getProperty = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const property = await Property.findById(propertyId);
  if (!property) throw new HttpError(404, 'Property not found');

  const portfolio = await ensurePropertyPortfolio(property);
  const membership = getMembershipForUser(portfolio, req.user._id);
  if (req.user.activePortfolioId && getId(portfolio._id) !== getId(req.user.activePortfolioId)) {
    throw new HttpError(403, 'Switch to the correct portfolio to access this property');
  }
  if (!membership || !membership.propertyIds.some((id: any) => getId(id) === getId(property._id))) {
    throw new HttpError(403, 'Access denied for this property');
  }

  res.json(property);
});

export const getPropertyOverview = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  await syncPropertyUnitStatuses(propertyId);
  const current = dayjs();
  const targetMonth = Number(req.query.month) || current.month() + 1;
  const targetYear = Number(req.query.year) || current.year();

  const propertyObjectId = new Types.ObjectId(propertyId);

  const [totalUnits, occupiedUnits, vacantUnits, maintenanceUnits] = await Promise.all([
    Unit.countDocuments({ propertyId, isArchived: false }),
    Unit.countDocuments({ propertyId, status: 'occupied', isArchived: false }),
    Unit.countDocuments({ propertyId, status: 'vacant', isArchived: false }),
    Unit.countDocuments({ propertyId, status: 'maintenance', isArchived: false })
  ]);

  const expectedRentAgg = await Unit.aggregate([
    { $match: { propertyId: propertyObjectId, status: 'occupied', isArchived: false } },
    { $group: { _id: null, total: { $sum: '$monthlyRent' } } }
  ]);

  const expectedRent = expectedRentAgg[0]?.total || 0;

  const rentRecords = await RentRecord.aggregate([
    {
      $match: {
        propertyId: propertyObjectId,
        month: targetMonth,
        year: targetYear
      }
    },
    {
      $group: {
        _id: '$status',
        total: { $sum: '$rentAmount' },
        paidAmount: { $sum: { $ifNull: ['$paidAmount', '$rentAmount'] } }
      }
    }
  ]);

  const collectedRent = rentRecords
    .filter((record) => record._id === 'paid' || record._id === 'partial')
    .reduce((sum, record) => sum + (record._id === 'paid' ? record.total : record.paidAmount), 0);

  res.json({
    totals: {
      totalUnits,
      occupiedUnits,
      vacantUnits,
      maintenanceUnits,
      monthlyExpectedRent: expectedRent,
      collectedRent,
      pendingRent: Math.max(0, expectedRent - collectedRent)
    }
  });
});

export const updateProperty = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const property = await Property.findById(propertyId);
  if (!property || property.isArchived) throw new HttpError(404, 'Property not found');

  const requiredIfPresent = ['name', 'propertyType', 'address', 'city', 'state', 'pincode'] as const;
  const emptyField = requiredIfPresent.find(
    (field) => Object.prototype.hasOwnProperty.call(req.body, field) && !String(req.body[field] ?? '').trim()
  );
  if (emptyField) {
    throw new HttpError(400, `${emptyField} cannot be empty`, { fields: [emptyField] });
  }
  if (req.body.maintenanceCharge != null) requireNonNegative(req.body.maintenanceCharge, 'maintenanceCharge');
  if (req.body.electricityUnitRate != null) requireNonNegative(req.body.electricityUnitRate, 'electricityUnitRate');
  if (req.body.commonElectricityCharge != null) requireNonNegative(req.body.commonElectricityCharge, 'commonElectricityCharge');

  Object.assign(property, req.body);
  await property.save();

  emitPortfolioEvent(req, { resource: 'property', action: 'update', id: getId(property._id), data: property });

  res.json(property);
});

export const archiveProperty = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const property = await Property.findById(propertyId);
  if (!property) throw new HttpError(404, 'Property not found');

  const occupiedUnitCount = await Unit.countDocuments({
    propertyId,
    isArchived: false,
    currentTenant: { $ne: null }
  });
  if (occupiedUnitCount > 0) {
    throw new HttpError(
      400,
      `Cannot deactivate this property because ${occupiedUnitCount} unit${occupiedUnitCount === 1 ? '' : 's'} still ${occupiedUnitCount === 1 ? 'has' : 'have'} an active tenant. Move all tenants out first.`
    );
  }

  property.isArchived = true;
  await property.save();

  const { modifiedCount } = await Unit.updateMany({ propertyId, isArchived: false }, { $set: { isArchived: true } });

  emitPortfolioEvent(req, { resource: 'property', action: 'archive', id: getId(property._id) });
  if (modifiedCount > 0) {
    emitPortfolioEvent(req, { resource: 'unit', action: 'bulkArchive', id: propertyId });
  }

  res.json({ message: 'Property and its units archived', unitsArchived: modifiedCount });
});

export const restoreProperty = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const property = await Property.findById(propertyId);
  if (!property) throw new HttpError(404, 'Property not found');
  property.isArchived = false;
  await property.save();
  emitPortfolioEvent(req, { resource: 'property', action: 'restore', id: getId(property._id) });
  res.json({ message: 'Property restored' });
});
