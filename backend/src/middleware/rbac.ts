import { Request } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { Property } from '../models/Property';
import { UserRole } from '../models/User';
import { ensurePropertyPortfolio, getMembershipForUser, getUserPortfolio } from '../services/portfolioService';

export type Action =
  | 'property:create'
  | 'property:update'
  | 'property:delete'
  | 'property:invite'
  | 'unit:manage'
  | 'tenant:manage'
  | 'rent:record'
  | 'utility:record'
  | 'maintenance:record'
  | 'payment:record'
  | 'report:export'
  | 'dashboard:view'
  | 'user:manage';

const permissions: Record<UserRole, Action[]> = {
  owner: [
    'property:create',
    'property:update',
    'property:delete',
    'property:invite',
    'unit:manage',
    'tenant:manage',
    'rent:record',
    'utility:record',
    'maintenance:record',
    'payment:record',
    'report:export',
    'dashboard:view',
    'user:manage'
  ],
  warden: [
    'property:create',
    'property:update',
    'property:delete',
    'property:invite',
    'unit:manage',
    'tenant:manage',
    'rent:record',
    'utility:record',
    'maintenance:record',
    'payment:record',
    'report:export',
    'dashboard:view',
    'user:manage'
  ],
  manager: [
    'property:create',
    'property:update',
    'property:delete',
    'unit:manage',
    'tenant:manage',
    'rent:record',
    'utility:record',
    'maintenance:record',
    'payment:record',
    'report:export',
    'dashboard:view'
  ]
};

const can = (role: UserRole, action: Action) => permissions[role]?.includes(action);
const getId = (value: any) => String(value?._id || value || '');

export const requireGlobalRole = (action: Action) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    if (!can(req.user.role, action)) throw new HttpError(403, 'Insufficient permissions');
    next();
  });

const resolvePropertyId = (req: Request) => {
  return (req.params.propertyId || req.body.propertyId || req.query.propertyId) as string | undefined;
};

const checkPropertyAccess = async (req: any, action: Action, allowArchived = false) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const propertyId = resolvePropertyId(req);
  if (!propertyId) throw new HttpError(400, 'propertyId is required');

  const property = await Property.findById(propertyId);
  if (!property || (!allowArchived && property.isArchived)) {
    throw new HttpError(404, 'Property not found');
  }

  const portfolio = await ensurePropertyPortfolio(property);
  const membership = getMembershipForUser(portfolio, req.user._id);
  if (!membership) throw new HttpError(403, 'Access denied for this property');
  if (req.user.activePortfolioId && getId(portfolio._id) !== getId(req.user.activePortfolioId)) {
    throw new HttpError(403, 'Switch to the correct portfolio to access this property');
  }

  const hasPropertyAccess =
    membership.role === 'owner' ||
    membership.propertyIds.some((entry: any) => getId(entry) === getId(property._id));
  if (!hasPropertyAccess) throw new HttpError(403, 'Access denied for this property');
  if (!can(membership.role, action)) throw new HttpError(403, 'Insufficient permissions');

  req.property = property;
  req.userRole = membership.role;
  req.portfolio = portfolio;
};

export const requirePropertyRole = (action: Action) =>
  asyncHandler(async (req, res, next) => {
    await checkPropertyAccess(req, action, false);
    next();
  });

export const requirePropertyRoleAllowArchived = (action: Action) =>
  asyncHandler(async (req, res, next) => {
    await checkPropertyAccess(req, action, true);
    next();
  });

export const requirePortfolioRole = (action: Action) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) throw new HttpError(401, 'Unauthorized');

    const portfolio = await getUserPortfolio(req.user);
    if (!portfolio) throw new HttpError(404, 'No portfolio found');

    const membership = getMembershipForUser(portfolio, req.user._id);
    if (!membership) throw new HttpError(403, 'Access denied for this portfolio');
    if (!can(membership.role, action)) throw new HttpError(403, 'Insufficient permissions');

    req.portfolio = portfolio as any;
    req.userRole = membership.role;
    next();
  });
