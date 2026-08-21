import dayjs from 'dayjs';
import { Types } from 'mongoose';
import { Property } from '../models/Property';
import { Unit } from '../models/Unit';
import { RentRecord } from '../models/RentRecord';
import { MaintenanceExpense } from '../models/MaintenanceExpense';
import { UtilityBill } from '../models/UtilityBill';
import { Tenant } from '../models/Tenant';
import { Payment } from '../models/Payment';
import { syncMultiplePropertyUnitStatuses } from './unitStatusService';
import { User } from '../models/User';
import { getAccessiblePropertyIdsForUser } from './portfolioService';

export const buildDashboard = async (userId: string, month?: number, year?: number, propertyId?: string) => {
  const current = dayjs();
  const targetMonth = month || current.month() + 1;
  const targetYear = year || current.year();

  const user = await User.findById(userId);
  if (!user) {
    return {
      totals: {
        totalProperties: 0,
        totalUnits: 0,
        occupiedUnits: 0,
        vacantUnits: 0,
        monthlyExpectedRent: 0,
        collectedRent: 0,
        pendingRent: 0,
        monthlyMaintenanceExpected: 0,
        monthlyMaintenanceCollected: 0,
        monthlyMaintenancePending: 0,
        monthlyMaintenance: 0,
        monthlyElectricity: { total: 0, collected: 0, unpaid: 0 },
        depositRequired: 0,
        depositCollected: 0,
        depositPending: 0,
        otherCashIntake: 0,
        otherCashSpent: 0,
        monthlyRevenue: 0,
        lifetimeRevenue: 0
      },
      charts: { rentCollection: [], maintenanceExpenses: [] },
      lists: { pendingRentTenants: [] }
    };
  }

  const monthStart = current.month(targetMonth - 1).year(targetYear).startOf('month').toDate();
  const monthEnd = current.month(targetMonth - 1).year(targetYear).endOf('month').toDate();

  const accessiblePropertyIds = await getAccessiblePropertyIdsForUser(user);
  const scopedPropertyIds = propertyId ? accessiblePropertyIds.filter((id) => id === propertyId) : accessiblePropertyIds;
  const allProperties = await Property.find({ _id: { $in: scopedPropertyIds }, isArchived: false });
  // Only count a property (and its units) for a month once it was actually active —
  // otherwise a property added this month would still show up in past months' totals.
  const properties = allProperties.filter((property) => !property.activeSince || property.activeSince <= monthEnd);
  const propertyIds = properties.map((p) => p._id);
  await syncMultiplePropertyUnitStatuses(propertyIds);

  const totalUnits = await Unit.countDocuments({
    propertyId: { $in: propertyIds },
    isArchived: false,
    $or: [{ activeSince: { $exists: false } }, { activeSince: null }, { activeSince: { $lte: monthEnd } }]
  });

  // "Expected" figures reflect who was actually a tenant during the selected month,
  // not who currently occupies a unit — otherwise past months would show rent/deposit
  // for tenants that hadn't moved in yet.
  const tenantsActiveDuringMonth = await Tenant.find({
    propertyId: { $in: propertyIds },
    movedInDate: { $lte: monthEnd },
    $or: [{ movedOutDate: { $exists: false } }, { movedOutDate: null }, { movedOutDate: { $gte: monthStart } }]
  }).select('propertyId assignedUnit rentAmount depositAmount');

  const occupiedUnitIds = new Set(tenantsActiveDuringMonth.map((tenant) => tenant.assignedUnit.toString()));
  const occupiedUnits = occupiedUnitIds.size;
  const vacantUnits = Math.max(0, totalUnits - occupiedUnits);

  const expectedRent = tenantsActiveDuringMonth.reduce((sum, tenant) => sum + (tenant.rentAmount || 0), 0);

  const maintenanceChargeByProperty = new Map<string, number>(
    properties.map((property) => [property._id.toString(), property.maintenanceCharge || 0])
  );
  const maintenanceExpected = tenantsActiveDuringMonth.reduce(
    (sum, tenant) => sum + (maintenanceChargeByProperty.get(tenant.propertyId.toString()) || 0),
    0
  );

  const rentRecords = await RentRecord.aggregate([
    {
      $match: {
        propertyId: { $in: propertyIds },
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
    .filter((r) => r._id === 'paid' || r._id === 'partial')
    .reduce((sum, r) => sum + (r._id === 'paid' ? r.total : r.paidAmount), 0);

  const rentCollectionChart = await RentRecord.aggregate([
    { $match: { propertyId: { $in: propertyIds } } },
    {
      $group: {
        _id: { year: '$year', month: '$month' },
        total: { $sum: '$rentAmount' },
        collected: {
          $sum: {
            $cond: [{ $eq: ['$status', 'paid'] }, '$rentAmount', { $ifNull: ['$paidAmount', 0] }]
          }
        }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    { $limit: 6 }
  ]);

  const maintenanceChart = await MaintenanceExpense.aggregate([
    { $match: { propertyId: { $in: propertyIds } } },
    {
      $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' } },
        total: { $sum: '$amount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    { $limit: 6 }
  ]);

  const pendingRentTenants = await RentRecord.find({
    propertyId: { $in: propertyIds },
    month: targetMonth,
    year: targetYear,
    status: { $in: ['unpaid', 'partial'] }
  })
    .populate('tenantId', 'fullName phone')
    .populate('unitId', 'unitNumber')
    .limit(10);

  const monthTenantIds = tenantsActiveDuringMonth.map((tenant) => tenant._id);

  const [maintenanceCollectedAgg, maintenanceSpentAgg, electricityStatusAgg, depositPayments, otherCashAgg] =
    await Promise.all([
      Payment.aggregate([
        {
          $match: {
            propertyId: { $in: propertyIds },
            type: 'maintenance',
            date: { $gte: monthStart, $lte: monthEnd },
            notes: /maintenance collected/i
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      MaintenanceExpense.aggregate([
        { $match: { propertyId: { $in: propertyIds }, date: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      UtilityBill.aggregate([
        {
          $match: {
            propertyId: { $in: propertyIds },
            billType: 'electricity',
            month: `${targetYear}-${String(targetMonth).padStart(2, '0')}`
          }
        },
        {
          $group: {
            _id: '$status',
            total: { $sum: '$amount' }
          }
        }
      ]),
      Payment.find({
        propertyId: { $in: propertyIds },
        tenantId: { $in: monthTenantIds },
        type: { $in: ['deposit', 'refund'] },
        date: { $lte: monthEnd }
      }).select('type amount tenantId'),
      Payment.aggregate([
        {
          $match: {
            propertyId: { $in: propertyIds },
            type: 'other',
            date: { $gte: monthStart, $lte: monthEnd }
          }
        },
        {
          $group: {
            _id: null,
            inTotal: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, 0, '$amount'] } },
            outTotal: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, '$amount', 0] } }
          }
        }
      ])
    ]);

  const actualMaintenanceCollected = maintenanceCollectedAgg[0]?.total || 0;
  const maintenanceSpent = maintenanceSpentAgg[0]?.total || 0;
  const electricityTotal = electricityStatusAgg.reduce((sum, item) => sum + item.total, 0);
  const electricityPending = electricityStatusAgg
    .filter((item) => item._id === 'unpaid')
    .reduce((sum, item) => sum + item.total, 0);
  const electricityCollected = Math.max(0, electricityTotal - electricityPending);

  const depositRequired = tenantsActiveDuringMonth.reduce((sum, tenant) => sum + (tenant.depositAmount || 0), 0);
  const depositHeldByTenant = new Map<string, number>();
  depositPayments.forEach((payment) => {
    const tenantKey = payment.tenantId?.toString();
    if (!tenantKey) return;
    const currentHeld = depositHeldByTenant.get(tenantKey) || 0;
    const nextHeld =
      payment.type === 'deposit'
        ? currentHeld + (payment.amount || 0)
        : currentHeld - (payment.amount || 0);
    depositHeldByTenant.set(tenantKey, nextHeld);
  });
  const depositCollected = tenantsActiveDuringMonth.reduce((sum, tenant) => {
    return sum + Math.max(0, depositHeldByTenant.get(tenant._id.toString()) || 0);
  }, 0);
  const otherCashIntake = otherCashAgg[0]?.inTotal || 0;
  const otherCashSpent = otherCashAgg[0]?.outTotal || 0;

  // Net revenue excludes electricity entirely (it's a pass-through collection, not landlord income)
  // and subtracts every outgoing expense: maintenance spent and other cash paid out.
  const monthlyRevenue = collectedRent + actualMaintenanceCollected + otherCashIntake - maintenanceSpent - otherCashSpent;

  const accessiblePropertyObjectIds = accessiblePropertyIds.map((id) => new Types.ObjectId(id));

  const [lifetimeRentAgg, lifetimeMaintenanceCollectedAgg, lifetimeMaintenanceSpentAgg, lifetimeOtherCashAgg] = await Promise.all([
    RentRecord.aggregate([
      { $match: { propertyId: { $in: accessiblePropertyObjectIds }, status: { $in: ['paid', 'partial'] } } },
      {
        $group: {
          _id: null,
          total: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$rentAmount', { $ifNull: ['$paidAmount', 0] }] } }
        }
      }
    ]),
    Payment.aggregate([
      { $match: { propertyId: { $in: accessiblePropertyObjectIds }, type: 'maintenance', notes: /maintenance collected/i } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    MaintenanceExpense.aggregate([
      { $match: { propertyId: { $in: accessiblePropertyObjectIds } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Payment.aggregate([
      { $match: { propertyId: { $in: accessiblePropertyObjectIds }, type: 'other' } },
      {
        $group: {
          _id: null,
          inTotal: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, 0, '$amount'] } },
          outTotal: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, '$amount', 0] } }
        }
      }
    ])
  ]);

  const lifetimeRevenue =
    (lifetimeRentAgg[0]?.total || 0) +
    (lifetimeMaintenanceCollectedAgg[0]?.total || 0) +
    (lifetimeOtherCashAgg[0]?.inTotal || 0) -
    (lifetimeMaintenanceSpentAgg[0]?.total || 0) -
    (lifetimeOtherCashAgg[0]?.outTotal || 0);

  return {
    totals: {
      totalProperties: properties.length,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      monthlyExpectedRent: expectedRent,
      collectedRent,
      pendingRent: Math.max(0, expectedRent - collectedRent),
      monthlyMaintenanceExpected: maintenanceExpected,
      monthlyMaintenanceCollected: actualMaintenanceCollected,
      monthlyMaintenancePending: Math.max(0, maintenanceExpected - actualMaintenanceCollected),
      monthlyMaintenance: maintenanceSpent,
      monthlyElectricity: {
        total: electricityTotal,
        collected: electricityCollected,
        unpaid: electricityPending
      },
      depositRequired,
      depositCollected,
      depositPending: Math.max(0, depositRequired - depositCollected),
      otherCashIntake,
      otherCashSpent,
      monthlyRevenue,
      lifetimeRevenue
    },
    charts: {
      rentCollection: rentCollectionChart,
      maintenanceExpenses: maintenanceChart
    },
    lists: {
      pendingRentTenants
    }
  };
};
