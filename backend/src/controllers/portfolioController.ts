import { Types } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { Portfolio } from '../models/Portfolio';
import { Property } from '../models/Property';
import { User, UserRole } from '../models/User';
import {
  createPortfolioForUser,
  getMembershipForUser,
  getUniquePortfolioJoinCode,
  getUserPortfolio,
  listUserPortfolios,
  setActivePortfolioForUser
} from '../services/portfolioService';
import { deletePortfolioCascade } from '../services/destructiveActionService';
import { requireString } from '../utils/request';
import { emitPortfolioEvent } from '../ws/emit';

const getId = (value: any) => String(value?._id || value || '');
const MANAGEMENT_ROLES = new Set<UserRole>(['owner', 'warden']);
const ASSIGNABLE_ROLES: Record<'owner' | 'warden', UserRole[]> = {
  owner: ['warden', 'manager'],
  warden: ['manager']
};

type AccessRole = 'warden' | 'manager';

const ensureManagingMembership = (portfolio: any, req: any) => {
  const membership = getMembershipForUser(portfolio, req.user?._id);
  if (!membership || !MANAGEMENT_ROLES.has(membership.role)) {
    throw new HttpError(403, 'Only an owner or warden can manage this portfolio');
  }
  return membership as { role: UserRole; user: any; propertyIds: any[] };
};

const normalizePropertyIds = (propertyIds: any[], allowedPropertyIds: Set<string>) => {
  return (propertyIds || [])
    .map((propertyId) => getId(propertyId))
    .filter((propertyId) => allowedPropertyIds.has(propertyId))
    .map((propertyId) => new Types.ObjectId(propertyId));
};

const ensureAssignableRole = (actingRole: 'owner' | 'warden', role: UserRole) => {
  if (!ASSIGNABLE_ROLES[actingRole].includes(role)) {
    throw new HttpError(
      403,
      actingRole === 'owner'
        ? 'Owner can only assign manager or warden roles'
        : 'Warden can only assign manager role'
    );
  }
};

const ensureManageableTarget = (actingRole: 'owner' | 'warden', member: any) => {
  if (!member) throw new HttpError(404, 'Member not found');

  const targetRole = member.role as UserRole;
  if (targetRole === 'owner') {
    throw new HttpError(403, 'Owner cannot be changed from this screen');
  }

  if (actingRole === 'warden' && targetRole !== 'manager') {
    throw new HttpError(403, 'Warden can only manage managers');
  }
};

const ensurePropertySelection = (propertyIds: Types.ObjectId[], availableCount: number, role: UserRole) => {
  if (availableCount > 0 && role !== 'owner' && propertyIds.length === 0) {
    throw new HttpError(400, 'Select at least one property');
  }
};

const serializePortfolioSummary = (portfolio: any, userId: any) => {
  const membership = getMembershipForUser(portfolio, userId);
  return {
    _id: portfolio._id,
    name: portfolio.name,
    joinCode: portfolio.joinCode,
    membership: membership
      ? {
          _id: membership._id,
          role: membership.role,
          propertyIds: (membership.propertyIds || []).map((propertyId: any) => getId(propertyId))
        }
      : null,
    memberCount: portfolio.members?.length || 0,
    createdAt: portfolio.createdAt
  };
};

export const listPortfolios = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const portfolios = await listUserPortfolios(req.user);
  res.json({
    activePortfolioId: req.user.activePortfolioId || null,
    portfolios: portfolios.map((portfolio) => serializePortfolioSummary(portfolio, req.user?._id))
  });
});

export const createPortfolio = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const portfolio = await createPortfolioForUser(req.user as any, req.body?.name);
  res.status(201).json({
    message: 'Portfolio created',
    portfolio: serializePortfolioSummary(portfolio, req.user._id)
  });
});

export const switchPortfolio = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');
  const portfolioId = getId(req.body?.portfolioId);
  if (!portfolioId) throw new HttpError(400, 'portfolioId is required');

  const portfolio = await setActivePortfolioForUser(req.user, portfolioId);
  if (!portfolio) throw new HttpError(404, 'Portfolio not found');

  res.json({
    message: 'Portfolio switched',
    activePortfolioId: portfolio._id,
    portfolio: serializePortfolioSummary(portfolio, req.user._id)
  });
});

export const updatePortfolioSettings = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const portfolio = await getUserPortfolio(req.user);
  if (!portfolio) throw new HttpError(404, 'Portfolio not found');
  const actingMembership = ensureManagingMembership(portfolio, req);
  if (actingMembership.role !== 'owner') {
    throw new HttpError(403, 'Only the owner can update due date settings');
  }

  const normalizeDay = (value: any, field: string) => {
    const day = Number(value);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      throw new HttpError(400, `${field} must be between 1 and 28`);
    }
    return day;
  };

  const normalizeLeadDays = (value: any) => {
    const days = Number(value);
    if (!Number.isInteger(days) || days < 0 || days > 7) {
      throw new HttpError(400, 'Reminder lead days must be between 0 and 7');
    }
    return days;
  };

  portfolio.rentDueDay = normalizeDay(req.body?.rentDueDay ?? portfolio.rentDueDay, 'Rent due day');
  portfolio.electricityDueDay = normalizeDay(
    req.body?.electricityDueDay ?? portfolio.electricityDueDay,
    'Electricity due day'
  );
  portfolio.maintenanceDueDay = normalizeDay(
    req.body?.maintenanceDueDay ?? portfolio.maintenanceDueDay,
    'Maintenance due day'
  );
  portfolio.reminderLeadDays = normalizeLeadDays(req.body?.reminderLeadDays ?? portfolio.reminderLeadDays);
  await portfolio.save();

  emitPortfolioEvent(req, { resource: 'portfolio', action: 'update', id: getId(portfolio._id), portfolioId: getId(portfolio._id) });

  res.json({ message: 'Portfolio settings updated' });
});

export const deleteCurrentPortfolio = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');
  const portfolio = await getUserPortfolio(req.user);
  if (!portfolio) throw new HttpError(404, 'Portfolio not found');
  const membership = getMembershipForUser(portfolio, req.user._id);
  if (membership?.role !== 'owner') {
    throw new HttpError(403, 'Only the owner can delete this portfolio');
  }

  const deletedPortfolioId = getId(portfolio._id);
  await deletePortfolioCascade(deletedPortfolioId);
  const refreshedUser = await User.findById(req.user._id).select('activePortfolioId');

  emitPortfolioEvent(req, { resource: 'portfolio', action: 'delete', id: deletedPortfolioId, portfolioId: deletedPortfolioId });

  res.json({
    message: 'Portfolio deleted',
    activePortfolioId: refreshedUser?.activePortfolioId || null
  });
});

export const getPortfolio = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const portfolio = await getUserPortfolio(req.user);
  if (!portfolio) {
    res.json({ portfolio: null, properties: [], membership: null });
    return;
  }

  if (!portfolio.joinCode) {
    portfolio.joinCode = await getUniquePortfolioJoinCode();
    await portfolio.save();
  }

  const membership = getMembershipForUser(portfolio, req.user._id);
  const accessiblePropertyIds = new Set((membership?.propertyIds || []).map((propertyId: any) => getId(propertyId)));
  const allProperties = await Property.find({ portfolioId: portfolio._id, isArchived: false }).sort({ createdAt: -1 });
  const visibleProperties =
    membership?.role === 'owner'
      ? allProperties
      : allProperties.filter((property) => accessiblePropertyIds.has(getId(property._id)));

  const payload = portfolio.toObject();
  if (!MANAGEMENT_ROLES.has(membership?.role)) {
    payload.members = payload.members.filter((member: any) => getId(member.user) === getId(req.user?._id));
    payload.joinRequests = [];
  }

  res.json({
    portfolio: payload,
    properties: visibleProperties,
    membership
  });
});

export const invitePortfolioMember = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');
  const portfolio = await getUserPortfolio(req.user);
  if (!portfolio) throw new HttpError(404, 'Portfolio not found');
  const actingMembership = ensureManagingMembership(portfolio, req);

  const { userId, role, propertyIds } = req.body;
  if (!userId || !role) throw new HttpError(400, 'userId and role are required');
  if (!['warden', 'manager'].includes(role)) throw new HttpError(400, 'Invalid role');
  ensureAssignableRole(actingMembership.role as 'owner' | 'warden', role as UserRole);

  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'User not found');
  if (getId(user._id) === getId(req.user._id)) throw new HttpError(400, 'You are already in this portfolio');

  const alreadyMember = portfolio.members.some((member) => getId(member.user) === getId(user._id));
  if (alreadyMember) throw new HttpError(409, 'User already belongs to this portfolio');

  const portfolioProperties = await Property.find({ portfolioId: portfolio._id, isArchived: false }).select('_id');
  const allowedPropertyIds = new Set(portfolioProperties.map((property) => getId(property._id)));
  const normalizedPropertyIds = normalizePropertyIds(propertyIds || [], allowedPropertyIds);
  ensurePropertySelection(normalizedPropertyIds, portfolioProperties.length, role as UserRole);

  portfolio.members.push({
    user: user._id as any,
    role,
    propertyIds: normalizedPropertyIds,
    addedAt: new Date()
  });
  portfolio.joinRequests = portfolio.joinRequests.filter((request) => getId(request.user) !== getId(user._id));
  await portfolio.save();

  emitPortfolioEvent(req, { resource: 'portfolio', action: 'memberInvite', id: getId(portfolio._id), portfolioId: getId(portfolio._id) });

  res.status(201).json({ message: 'Member added to portfolio' });
});

export const updatePortfolioMember = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');
  const portfolio = await getUserPortfolio(req.user);
  if (!portfolio) throw new HttpError(404, 'Portfolio not found');
  const actingMembership = ensureManagingMembership(portfolio, req);

  const member = (portfolio.members as any).id(requireString(req.params.memberId, 'memberId'));
  ensureManageableTarget(actingMembership.role as 'owner' | 'warden', member);

  const portfolioProperties = await Property.find({ portfolioId: portfolio._id, isArchived: false }).select('_id');
  const allowedPropertyIds = new Set(portfolioProperties.map((property) => getId(property._id)));

  if (req.body.role) {
    if (!['warden', 'manager'].includes(req.body.role)) throw new HttpError(400, 'Invalid role');
    ensureAssignableRole(actingMembership.role as 'owner' | 'warden', req.body.role as UserRole);
    member.role = req.body.role;
  }

  if (req.body.propertyIds || req.body.role) {
    const normalizedPropertyIds = normalizePropertyIds(req.body.propertyIds ?? member.propertyIds, allowedPropertyIds);
    ensurePropertySelection(normalizedPropertyIds, portfolioProperties.length, member.role as UserRole);
    member.propertyIds = normalizedPropertyIds as any;
  }

  await portfolio.save();

  emitPortfolioEvent(req, { resource: 'portfolio', action: 'memberUpdate', id: getId(portfolio._id), portfolioId: getId(portfolio._id) });

  res.json({ message: 'Member updated' });
});

export const removePortfolioMember = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');
  const portfolio = await getUserPortfolio(req.user);
  if (!portfolio) throw new HttpError(404, 'Portfolio not found');
  const actingMembership = ensureManagingMembership(portfolio, req);

  const member = (portfolio.members as any).id(requireString(req.params.memberId, 'memberId'));
  ensureManageableTarget(actingMembership.role as 'owner' | 'warden', member);

  member.deleteOne();
  await portfolio.save();

  emitPortfolioEvent(req, { resource: 'portfolio', action: 'memberRemove', id: getId(portfolio._id), portfolioId: getId(portfolio._id) });

  res.json({ message: 'Member removed' });
});

export const requestPortfolioJoin = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');
  const code = String(req.body.code || '').trim();
  if (!code) throw new HttpError(400, 'Portfolio code is required');

  const portfolio = await Portfolio.findOne({ joinCode: code });
  if (!portfolio) throw new HttpError(404, 'Portfolio not found');

  const alreadyMember = portfolio.members.some((member) => getId(member.user) === getId(req.user?._id));
  if (alreadyMember) throw new HttpError(409, 'You already belong to this portfolio');
  const alreadyRequested = portfolio.joinRequests.some((request) => getId(request.user) === getId(req.user?._id));
  if (alreadyRequested) throw new HttpError(409, 'Join request already sent');

  portfolio.joinRequests.push({ user: req.user._id as any, requestedAt: new Date() });
  await portfolio.save();

  res.status(201).json({ message: 'Join request sent' });
});

export const approvePortfolioJoinRequest = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');
  const portfolio = await getUserPortfolio(req.user);
  if (!portfolio) throw new HttpError(404, 'Portfolio not found');
  const actingMembership = ensureManagingMembership(portfolio, req);

  const request = (portfolio.joinRequests as any).id(requireString(req.params.requestId, 'requestId'));
  if (!request) throw new HttpError(404, 'Join request not found');

  const requestedRole = String(req.body.role || 'manager') as UserRole;
  if (!['warden', 'manager'].includes(requestedRole)) throw new HttpError(400, 'Invalid role');
  ensureAssignableRole(actingMembership.role as 'owner' | 'warden', requestedRole);

  const portfolioProperties = await Property.find({ portfolioId: portfolio._id, isArchived: false }).select('_id');
  const allowedPropertyIds = new Set(portfolioProperties.map((property) => getId(property._id)));
  const selectedPropertyIds = normalizePropertyIds(req.body.propertyIds || [], allowedPropertyIds);
  ensurePropertySelection(selectedPropertyIds, portfolioProperties.length, requestedRole);

  const existingMember = portfolio.members.find((member) => getId(member.user) === getId(request.user));
  if (existingMember) {
    existingMember.role = requestedRole;
    existingMember.propertyIds = selectedPropertyIds as any;
  } else {
    portfolio.members.push({
      user: request.user as any,
      role: requestedRole,
      propertyIds: selectedPropertyIds,
      addedAt: new Date()
    });
  }

  const requestUser = await User.findById(request.user);
  if (requestUser && !requestUser.activePortfolioId) {
    requestUser.activePortfolioId = portfolio._id as any;
    await requestUser.save();
  }

  request.deleteOne();
  await portfolio.save();

  emitPortfolioEvent(req, { resource: 'portfolio', action: 'joinApproved', id: getId(portfolio._id), portfolioId: getId(portfolio._id) });

  res.json({ message: 'Join request approved' });
});

export const rejectPortfolioJoinRequest = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');
  const portfolio = await getUserPortfolio(req.user);
  if (!portfolio) throw new HttpError(404, 'Portfolio not found');
  ensureManagingMembership(portfolio, req);

  const request = (portfolio.joinRequests as any).id(requireString(req.params.requestId, 'requestId'));
  if (!request) throw new HttpError(404, 'Join request not found');
  request.deleteOne();
  await portfolio.save();

  emitPortfolioEvent(req, { resource: 'portfolio', action: 'joinRejected', id: getId(portfolio._id), portfolioId: getId(portfolio._id) });

  res.json({ message: 'Join request denied' });
});
