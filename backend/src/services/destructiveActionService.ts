import { Types } from 'mongoose';
import { Portfolio } from '../models/Portfolio';
import { Property } from '../models/Property';
import { Unit } from '../models/Unit';
import { Tenant } from '../models/Tenant';
import { RentRecord } from '../models/RentRecord';
import { UtilityBill } from '../models/UtilityBill';
import { MaintenanceExpense } from '../models/MaintenanceExpense';
import { Payment } from '../models/Payment';
import { Document } from '../models/Document';
import { User } from '../models/User';

const getId = (value: any) => String(value?._id || value || '');

const refreshActivePortfolioForUsers = async (userIds: string[], removedPortfolioId?: string) => {
  if (!userIds.length) return;

  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  for (const userId of uniqueUserIds) {
    const user = await User.findById(userId);
    if (!user) continue;
    if (removedPortfolioId && getId(user.activePortfolioId) !== getId(removedPortfolioId)) continue;

    const nextPortfolio = await Portfolio.findOne({ 'members.user': user._id }).sort({ createdAt: 1 }).select('_id');
    user.activePortfolioId = nextPortfolio?._id as any;
    await user.save();
  }
};

export const deletePortfolioCascade = async (portfolioId: string) => {
  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) return { deleted: false, nextActivePortfolioId: null };

  const propertyIds = await Property.find({ portfolioId: portfolio._id }).distinct('_id');
  const unitIds = propertyIds.length ? await Unit.find({ propertyId: { $in: propertyIds } }).distinct('_id') : [];
  const tenantIds = propertyIds.length ? await Tenant.find({ propertyId: { $in: propertyIds } }).distinct('_id') : [];

  if (propertyIds.length) {
    await Promise.all([
      RentRecord.deleteMany({ propertyId: { $in: propertyIds } }),
      UtilityBill.deleteMany({ propertyId: { $in: propertyIds } }),
      MaintenanceExpense.deleteMany({ propertyId: { $in: propertyIds } }),
      Payment.deleteMany({ propertyId: { $in: propertyIds } }),
      Property.deleteMany({ _id: { $in: propertyIds } })
    ]);
  }

  if (unitIds.length) {
    await Unit.deleteMany({ _id: { $in: unitIds } });
  }

  if (tenantIds.length) {
    await Promise.all([
      Tenant.deleteMany({ _id: { $in: tenantIds } }),
      Document.deleteMany({ ownerId: { $in: tenantIds } })
    ]);
  }

  const relatedUserIds = [
    ...portfolio.members.map((member) => getId(member.user)),
    ...portfolio.joinRequests.map((request) => getId(request.user))
  ];

  await Portfolio.deleteOne({ _id: portfolio._id });
  await refreshActivePortfolioForUsers(relatedUserIds, getId(portfolio._id));

  return { deleted: true };
};

export const deleteUserAccountCascade = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) return { deleted: false };

  const ownedPortfolios = await Portfolio.find({ ownerUser: user._id }).select('_id');
  for (const portfolio of ownedPortfolios) {
    await deletePortfolioCascade(getId(portfolio._id));
  }

  const remainingMembershipPortfolios = await Portfolio.find({ 'members.user': user._id });
  for (const portfolio of remainingMembershipPortfolios) {
    portfolio.members = portfolio.members.filter((member: any) => getId(member.user) !== getId(user._id)) as any;
    portfolio.joinRequests = portfolio.joinRequests.filter((request: any) => getId(request.user) !== getId(user._id)) as any;
    await portfolio.save();
  }

  const requestOnlyPortfolios = await Portfolio.find({ 'joinRequests.user': user._id });
  for (const portfolio of requestOnlyPortfolios) {
    portfolio.joinRequests = portfolio.joinRequests.filter((request: any) => getId(request.user) !== getId(user._id)) as any;
    await portfolio.save();
  }

  await User.deleteOne({ _id: user._id });
  await refreshActivePortfolioForUsers(
    remainingMembershipPortfolios.flatMap((portfolio) => portfolio.members.map((member: any) => getId(member.user)))
  );

  return { deleted: true };
};
