import { Types } from 'mongoose';
import { Portfolio } from '../models/Portfolio';
import { Property } from '../models/Property';
import { IUserDocument } from '../models/User';

const getId = (value: any) => String(value?._id || value || '');
const makeJoinCode = () => String(Math.floor(1000000 + Math.random() * 9000000));

export const getUniquePortfolioJoinCode = async () => {
  let attempts = 0;
  while (attempts < 10) {
    const code = makeJoinCode();
    const exists = await Portfolio.exists({ joinCode: code });
    if (!exists) return code;
    attempts += 1;
  }
  throw new Error('Unable to generate portfolio join code');
};

const populatePortfolio = (portfolioId: any) =>
  Portfolio.findById(portfolioId)
    .populate('members.user', 'fullName email phone role isActive activePortfolioId')
    .populate('joinRequests.user', 'fullName email phone role isActive activePortfolioId');

export const createPortfolioForUser = async (
  user: Pick<IUserDocument, '_id' | 'fullName' | 'role' | 'save'>,
  name?: string
) => {
  const portfolio = await Portfolio.create({
    name: String(name || '').trim() || `${user.fullName.split(' ')[0] || 'Primary'} Portfolio`,
    ownerUser: user._id,
    joinCode: await getUniquePortfolioJoinCode(),
    rentDueDay: 5,
    electricityDueDay: 10,
    maintenanceDueDay: 7,
    reminderLeadDays: 1,
    members: [{ user: user._id, role: 'owner', propertyIds: [], addedAt: new Date() }],
    joinRequests: []
  });

  if (user.role !== 'owner') {
    user.role = 'owner' as any;
  }
  (user as any).activePortfolioId = portfolio._id;
  await user.save();

  return populatePortfolio(portfolio._id);
};

export const ensurePortfolioForOwner = async (user: Pick<IUserDocument, '_id' | 'fullName' | 'role' | 'save'>) => {
  let portfolio = await Portfolio.findOne({ ownerUser: user._id }).sort({ createdAt: 1 });
  if (!portfolio) {
    return createPortfolioForUser(user, `${user.fullName.split(' ')[0] || 'Primary'} Portfolio`);
  }

  if (String((user as any).activePortfolioId || '') !== getId(portfolio._id)) {
    (user as any).activePortfolioId = portfolio._id;
    if ((user as any).save) {
      await (user as any).save();
    }
  }

  return populatePortfolio(portfolio._id);
};

export const addPropertyAccessToMember = (member: any, propertyId: any) => {
  const propertyKey = getId(propertyId);
  if (!member.propertyIds.some((entry: any) => getId(entry) === propertyKey)) {
    member.propertyIds.push(new Types.ObjectId(propertyKey));
  }
};

export const ensurePropertyPortfolio = async (property: any) => {
  let portfolio = property.portfolioId ? await Portfolio.findById(property.portfolioId) : null;

  if (!portfolio) {
    portfolio = await Portfolio.findOne({ ownerUser: property.createdBy }).sort({ createdAt: 1 });
    if (!portfolio) {
      portfolio = await Portfolio.create({
        name: 'Primary Portfolio',
        ownerUser: property.createdBy,
        joinCode: await getUniquePortfolioJoinCode(),
        rentDueDay: 5,
        electricityDueDay: 10,
        maintenanceDueDay: 7,
        reminderLeadDays: 1,
        members: [{ user: property.createdBy, role: 'owner', propertyIds: [], addedAt: new Date() }],
        joinRequests: []
      });
    }
    property.portfolioId = portfolio._id;
  }

  let changed = false;
  for (const legacyMember of property.members || []) {
    const userId = getId(legacyMember.user);
    let portfolioMember = portfolio.members.find((member) => getId(member.user) === userId);
    if (!portfolioMember) {
      portfolio.members.push({
        user: new Types.ObjectId(userId),
        role: legacyMember.role,
        propertyIds: [property._id],
        addedAt: legacyMember.addedAt || new Date()
      });
      changed = true;
      continue;
    }

    if (portfolioMember.role !== 'owner' && legacyMember.role === 'owner') {
      portfolioMember.role = 'owner';
      changed = true;
    }

    const previousCount = portfolioMember.propertyIds.length;
    addPropertyAccessToMember(portfolioMember, property._id);
    if (portfolioMember.propertyIds.length !== previousCount) {
      changed = true;
    }
  }

  for (const legacyRequest of property.joinRequests || []) {
    const userId = getId(legacyRequest.user);
    const exists = portfolio.joinRequests.some((request) => getId(request.user) === userId);
    if (!exists) {
      portfolio.joinRequests.push({
        user: new Types.ObjectId(userId),
        requestedAt: legacyRequest.requestedAt || new Date()
      });
      changed = true;
    }
  }

  const ownerMember = portfolio.members.find((member) => getId(member.user) === getId(portfolio.ownerUser));
  if (ownerMember) {
    const previousCount = ownerMember.propertyIds.length;
    addPropertyAccessToMember(ownerMember, property._id);
    if (ownerMember.propertyIds.length !== previousCount) {
      changed = true;
    }
  }

  await property.save();
  if (changed) {
    await portfolio.save();
  }

  return portfolio;
};

export const ensureUserPortfolioAccess = async (user: IUserDocument) => {
  const legacyProperties = await Property.find({
    $or: [{ createdBy: user._id }, { 'members.user': user._id }]
  });

  await Promise.all(legacyProperties.map((property) => ensurePropertyPortfolio(property)));
};

export const listUserPortfolios = async (user: IUserDocument) => {
  await ensureUserPortfolioAccess(user);
  const portfolios = await Portfolio.find({ 'members.user': user._id })
    .sort({ createdAt: 1 })
    .populate('members.user', 'fullName email phone role isActive activePortfolioId')
    .populate('joinRequests.user', 'fullName email phone role isActive activePortfolioId');

  const hasActive = portfolios.some((portfolio) => getId(portfolio._id) === getId(user.activePortfolioId));
  if (portfolios.length && !hasActive) {
    user.activePortfolioId = portfolios[0]._id as any;
    await user.save();
  }

  return portfolios;
};

export const getUserPortfolio = async (user: IUserDocument) => {
  const portfolios = await listUserPortfolios(user);
  if (!portfolios.length) return null;
  return portfolios.find((portfolio) => getId(portfolio._id) === getId(user.activePortfolioId)) || portfolios[0];
};

export const setActivePortfolioForUser = async (user: IUserDocument, portfolioId: string) => {
  const portfolios = await listUserPortfolios(user);
  const target = portfolios.find((portfolio) => getId(portfolio._id) === getId(portfolioId));
  if (!target) return null;
  user.activePortfolioId = target._id as any;
  await user.save();
  return target;
};

export const getMembershipForUser = (portfolio: any, userId: any) =>
  portfolio?.members?.find((member: any) => getId(member.user) === getId(userId)) || null;

export const getAccessiblePropertyIdsForUser = async (
  user: IUserDocument,
  options?: { portfolioId?: string; activeOnly?: boolean }
) => {
  await ensureUserPortfolioAccess(user);

  let portfolios = await Portfolio.find({ 'members.user': user._id }).select('members');
  if (options?.portfolioId) {
    portfolios = portfolios.filter((portfolio) => getId(portfolio._id) === getId(options.portfolioId));
  } else if (options?.activeOnly !== false) {
    const activePortfolioId = getId(user.activePortfolioId);
    portfolios = portfolios.filter((portfolio) => getId(portfolio._id) === activePortfolioId);
  }

  const propertyIds = new Set<string>();
  portfolios.forEach((portfolio) => {
    const membership = getMembershipForUser(portfolio, user._id);
    (membership?.propertyIds || []).forEach((propertyId: any) => {
      propertyIds.add(getId(propertyId));
    });
  });

  return Array.from(propertyIds);
};
