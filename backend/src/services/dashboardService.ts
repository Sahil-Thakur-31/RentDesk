import dayjs from 'dayjs';
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
        otherCashSpent: 0
      },
      charts: { rentCollection: [], maintenanceExpenses: [] },
      lists: { pendingRentTenants: [] }
    };
  }

  const accessiblePropertyIds = await getAccessiblePropertyIdsForUser(user);
  const scopedPropertyIds = propertyId ? accessiblePropertyIds.filter((id) => id === propertyId) : accessiblePropertyIds;
  const properties = await Property.find({ _id: { $in: scopedPropertyIds }, isArchived: false });
  const propertyIds = properties.map((p) => p._id);
  await syncMultiplePropertyUnitStatuses(propertyIds);

  const [totalUnits, occupiedUnits, vacantUnits] = await Promise.all([
    Unit.countDocuments({ propertyId: { $in: propertyIds }, isArchived: false }),
    Unit.countDocuments({ propertyId: { $in: propertyIds }, status: 'occupied', isArchived: false }),
    Unit.countDocuments({ propertyId: { $in: propertyIds }, status: 'vacant', isArchived: false })
  ]);

  const occupiedByProperty = await Unit.aggregate([
    { $match: { propertyId: { $in: propertyIds }, status: 'occupied', isArchived: false } },
    { $group: { _id: '$propertyId', count: { $sum: 1 } } }
  ]);
  const occupiedMap = new Map<string, number>(
    occupiedByProperty.map((item) => [item._id.toString(), item.count])
  );
  const maintenanceExpected = properties.reduce((sum, property) => {
    const count = occupiedMap.get(property._id.toString()) || 0;
    const rate = property.maintenanceCharge || 0;
    return sum + count * rate;
  }, 0);
  const monthStart = current.month(targetMonth - 1).year(targetYear).startOf('month').toDate();
  const monthEnd = current.month(targetMonth - 1).year(targetYear).endOf('month').toDate();

  const expectedRentAgg = await Unit.aggregate([
    { $match: { propertyId: { $in: propertyIds }, status: 'occupied', isArchived: false } },
    { $group: { _id: null, total: { $sum: '$monthlyRent' } } }
  ]);

  const expectedRent = expectedRentAgg[0]?.total || 0;

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

  const [maintenanceCollectedAgg, maintenanceSpentAgg, electricityStatusAgg, activeTenants, depositPayments, otherCashAgg] =
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
      Tenant.find({ propertyId: { $in: propertyIds }, isActive: true }).select('depositAmount'),
      Payment.find({
        propertyId: { $in: propertyIds },
        type: { $in: ['deposit', 'refund'] }
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

  const depositRequired = activeTenants.reduce((sum, tenant) => sum + (tenant.depositAmount || 0), 0);
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
  const depositCollected = activeTenants.reduce((sum, tenant) => {
    return sum + Math.max(0, depositHeldByTenant.get(tenant._id.toString()) || 0);
  }, 0);
  const otherCashIntake = otherCashAgg[0]?.inTotal || 0;
  const otherCashSpent = otherCashAgg[0]?.outTotal || 0;

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
      otherCashSpent
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
