import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { Tenant } from '../models/Tenant';
import { Unit } from '../models/Unit';
import { Payment } from '../models/Payment';
import { RentRecord } from '../models/RentRecord';
import { ensureBase64OrThrow } from '../utils/base64';
import { getAutoMaintenanceUntil, syncUnitStatus } from '../services/unitStatusService';
import { requireString } from '../utils/request';

const getTenantDepositHeld = async (propertyId: string, tenantId: string) => {
  const payments = await Payment.find({
    propertyId,
    tenantId,
    type: { $in: ['deposit', 'refund'] }
  }).select('type amount');

  return payments.reduce((sum, payment) => {
    if (payment.type === 'deposit') return sum + (payment.amount || 0);
    if (payment.type === 'refund') return sum - (payment.amount || 0);
    return sum;
  }, 0);
};

export const listTenants = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const status = String(req.query.status || '').toLowerCase();
  const deletedParam = String(req.query.deleted || '').toLowerCase();

  const query: Record<string, unknown> = { propertyId };
  if (status === 'deleted' || deletedParam === 'true') {
    query.isActive = false;
  } else if (status === 'active') {
    query.isActive = true;
  }

  const tenants = await Tenant.find(query).sort({ createdAt: -1 }).populate('assignedUnit', 'unitNumber');
  res.json(tenants);
});

export const getTenant = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const tenantId = requireString(req.params.tenantId, 'tenantId');
  const tenant = await Tenant.findOne({ _id: tenantId, propertyId }).populate('assignedUnit', 'unitNumber');
  if (!tenant) throw new HttpError(404, 'Tenant not found');
  res.json(tenant);
});

export const getTenantDetails = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const tenantId = requireString(req.params.tenantId, 'tenantId');
  const tenant = await Tenant.findOne({ _id: tenantId, propertyId }).populate('assignedUnit', 'unitNumber');
  if (!tenant) throw new HttpError(404, 'Tenant not found');

  const [payments, rentRecords] = await Promise.all([
    Payment.find({ propertyId, tenantId: tenant._id }).sort({ date: -1 }),
    RentRecord.find({ propertyId, tenantId: tenant._id }).sort({ year: -1, month: -1 })
  ]);

  res.json({ tenant, payments, rentRecords });
});

export const createTenant = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const {
    fullName,
    phone,
    email,
    idProofType,
    idProofNumber,
    emergencyContact,
    assignedUnit,
    depositPaid,
    photoBase64,
    documents
  } = req.body;

  if (!fullName || !phone || !assignedUnit) {
    throw new HttpError(400, 'Missing required tenant fields');
  }

  ensureBase64OrThrow(photoBase64, 'photoBase64');
  ensureBase64OrThrow(documents?.idProofBase64, 'documents.idProofBase64');
  ensureBase64OrThrow(documents?.policeVerificationBase64, 'documents.policeVerificationBase64');

  const unit = await Unit.findOne({ _id: assignedUnit, propertyId, isArchived: false });
  if (!unit) throw new HttpError(404, 'Assigned unit not found');
  const initialDepositPaid = Number(depositPaid || 0);
  if (initialDepositPaid < 0) {
    throw new HttpError(400, 'depositPaid cannot be negative');
  }
  if (initialDepositPaid > (unit.deposit || 0)) {
    throw new HttpError(400, 'depositPaid cannot be greater than unit deposit');
  }

  const tenant = await Tenant.create({
    propertyId,
    unitId: unit._id,
    fullName,
    phone,
    email,
    idProofType,
    idProofNumber,
    emergencyContact,
    rentAmount: unit.monthlyRent,
    depositAmount: unit.deposit,
    assignedUnit: unit._id,
    photoBase64,
    documents,
    isActive: true
  });

  unit.currentTenant = tenant._id;
  unit.maintenanceMode = false;
  unit.maintenanceUntil = undefined;
  await syncUnitStatus(unit);

  if (initialDepositPaid > 0) {
    await Payment.create({
      type: 'deposit',
      amount: initialDepositPaid,
      date: new Date(),
      propertyId: tenant.propertyId,
      unitId: tenant.unitId,
      tenantId: tenant._id,
      notes: 'Security deposit collected',
      sourceType: 'tenant',
      sourceId: tenant._id
    });
  }

  res.status(201).json(tenant);
});

export const updateTenant = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const tenantId = requireString(req.params.tenantId, 'tenantId');
  const tenant = await Tenant.findOne({ _id: tenantId, propertyId });
  if (!tenant) throw new HttpError(404, 'Tenant not found');

  ensureBase64OrThrow(req.body.photoBase64, 'photoBase64');
  if (req.body.documents) {
    ensureBase64OrThrow(req.body.documents.idProofBase64, 'documents.idProofBase64');
    ensureBase64OrThrow(req.body.documents.policeVerificationBase64, 'documents.policeVerificationBase64');
  }

  Object.assign(tenant, req.body);
  await tenant.save();

  res.json(tenant);
});

export const moveOutTenant = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const tenantId = requireString(req.params.tenantId, 'tenantId');
  const tenant = await Tenant.findOne({ _id: tenantId, propertyId });
  if (!tenant) throw new HttpError(404, 'Tenant not found');

  const heldDeposit = await getTenantDepositHeld(propertyId, tenantId);

  tenant.isActive = false;
  tenant.movedOutDate = new Date();
  await tenant.save();

  const unit = await Unit.findById(tenant.assignedUnit);
  if (unit) {
    unit.currentTenant = undefined;
    unit.maintenanceMode = true;
    unit.maintenanceUntil = getAutoMaintenanceUntil();
    await syncUnitStatus(unit);
  }

  if (heldDeposit > 0) {
    await Payment.create({
      type: 'refund',
      amount: heldDeposit,
      date: new Date(),
      propertyId: tenant.propertyId,
      unitId: tenant.unitId,
      tenantId: tenant._id,
      notes: 'Security deposit returned on move-out',
      sourceType: 'tenant',
      sourceId: tenant._id
    });
  }

  res.json({ message: 'Tenant moved out', tenant });
});

export const reactivateTenant = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const tenantId = requireString(req.params.tenantId, 'tenantId');
  const {
    assignedUnit,
    fullName,
    phone,
    email,
    idProofType,
    idProofNumber,
    emergencyContact,
    depositPaid
  } = req.body;

  if (!assignedUnit) {
    throw new HttpError(400, 'assignedUnit is required');
  }

  const tenant = await Tenant.findOne({ _id: tenantId, propertyId });
  if (!tenant) throw new HttpError(404, 'Tenant not found');

  const unit = await Unit.findOne({ _id: assignedUnit, propertyId, isArchived: false });
  if (!unit) throw new HttpError(404, 'Assigned unit not found');
  if (unit.currentTenant && unit.status === 'occupied') {
    throw new HttpError(409, 'Unit already occupied');
  }
  const initialDepositPaid = Number(depositPaid || 0);
  if (initialDepositPaid < 0) {
    throw new HttpError(400, 'depositPaid cannot be negative');
  }
  if (initialDepositPaid > (unit.deposit || 0)) {
    throw new HttpError(400, 'depositPaid cannot be greater than unit deposit');
  }

  tenant.assignedUnit = unit._id;
  tenant.unitId = unit._id;
  tenant.rentAmount = unit.monthlyRent;
  tenant.depositAmount = unit.deposit;
  tenant.isActive = true;
  tenant.movedOutDate = undefined;

  if (fullName) tenant.fullName = fullName;
  if (phone) tenant.phone = phone;
  if (email !== undefined) tenant.email = email;
  if (idProofType !== undefined) tenant.idProofType = idProofType;
  if (idProofNumber !== undefined) tenant.idProofNumber = idProofNumber;
  if (emergencyContact !== undefined) tenant.emergencyContact = emergencyContact;

  await tenant.save();

  unit.currentTenant = tenant._id;
  unit.maintenanceMode = false;
  unit.maintenanceUntil = undefined;
  await syncUnitStatus(unit);

  if (initialDepositPaid > 0) {
    await Payment.create({
      type: 'deposit',
      amount: initialDepositPaid,
      date: new Date(),
      propertyId: tenant.propertyId,
      unitId: tenant.unitId,
      tenantId: tenant._id,
      notes: 'Security deposit collected',
      sourceType: 'tenant',
      sourceId: tenant._id
    });
  }

  res.json({ message: 'Tenant reactivated', tenant });
});
