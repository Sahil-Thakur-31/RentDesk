import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import PropertyPicker from '../components/PropertyPicker';
import { formatDate, formatMonthKey, formatMonthYear, getCurrentDateValue, getCurrentMonthValue, shiftMonthValue } from '../lib/dateFormat';
import { useDataVersion } from '../lib/dataSync';
import { appStorage } from '../lib/appStorage';
import { useI18n } from '../lib/i18n';
import { getCachedResponse } from '../lib/offlineSync';
import { BuildingIcon, CashIcon, CloseIcon, ShieldIcon, TransactionsIcon, UnitsIcon, UtilitiesIcon, WrenchIcon } from '../components/icons';
import { toast } from '../lib/toast';

const dashboardSessionCache = {
  token: '',
  properties: [] as any[],
  propertiesLoaded: false,
  bundleCache: new Map<string, any>(),
  dataVersion: -1
};

const Dashboard = () => {
  const { t } = useI18n();
  const MIN_LOADING_MS = 1000;
  const LOADING_MESSAGES = [
    'Loading properties...',
    'Loading units...',
    'Loading tenants...',
    'Loading transactions...',
    'Loading remaining metadata...'
  ];
  const getId = (value: any) => String(value?._id || value || '');
  const getMonthKey = (targetYear: number, targetMonth: number) =>
    `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  const getScopeKey = (scopePropertyId: string, scopeMonth: string) =>
    `${scopePropertyId || 'all'}::${scopeMonth}`;
  const getMonthStamp = (value: string) => {
    const [yy, mm] = value.split('-').map(Number);
    return yy * 12 + (mm - 1);
  };
  const compareMonthKeys = (left: string, right: string) => getMonthStamp(left) - getMonthStamp(right);
  const getMonthRange = (startMonth: string, endMonth: string) => {
    const months: string[] = [];
    let cursor = startMonth;
    while (compareMonthKeys(cursor, endMonth) <= 0) {
      months.push(cursor);
      cursor = shiftMonthValue(cursor, 1);
    }
    return months;
  };
  const getLoadingMessageByProgress = (progress: number) => {
    const stageIndex = Math.min(
      LOADING_MESSAGES.length - 1,
      Math.floor((Math.max(progress, 1) / 100) * LOADING_MESSAGES.length)
    );
    return LOADING_MESSAGES[stageIndex];
  };
  const localFirstGet = async (url: string, params?: Record<string, any>) => {
    const cached = getCachedResponse({ url, method: 'get', params });
    if (cached !== undefined) {
      return { data: cached };
    }
    return api.get(url, params ? { params } : undefined);
  };
  const hasCachedGet = (url: string, params?: Record<string, any>) =>
    getCachedResponse({ url, method: 'get', params }) !== undefined;
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const wasTenantPresentInMonth = (tenant: any, startDate: Date, endDate: Date) => {
    const createdAt = tenant?.createdAt ? new Date(tenant.createdAt) : null;
    const movedOutDate = tenant?.movedOutDate ? new Date(tenant.movedOutDate) : null;
    const startedBeforeMonthEnd = !createdAt || createdAt <= endDate;
    const leftAfterMonthStart = !movedOutDate || movedOutDate >= startDate;
    return startedBeforeMonthEnd && leftAfterMonthStart;
  };
  const buildMissingRentRows = (tenantsList: any[], existingRecords: any[], targetMonth: number, targetYear: number, targetPropertyId?: string) => {
    const existingKeys = new Set(
      existingRecords.map((record: any) =>
        `${getId(record.tenantId)}-${getId(record.unitId)}`
      )
    );

    return tenantsList
      .filter((tenant: any) => tenant.assignedUnit?._id)
      .map((tenant: any) => {
        const tenantId = getId(tenant._id);
        const unitId = getId(tenant.assignedUnit?._id || tenant.unitId);
        return {
          tenant,
          tenantId,
          unitId,
          key: `${tenantId}-${unitId}`
        };
      })
      .filter((item) => !existingKeys.has(item.key))
      .map(({ tenant, tenantId, unitId }) => ({
        _id: `virtual-rent-${tenantId}-${targetYear}-${String(targetMonth).padStart(2, '0')}`,
        _virtual: true,
        propertyId: targetPropertyId || tenant.propertyId?._id || tenant.propertyId,
        tenantId: {
          _id: tenant._id,
          fullName: tenant.fullName
        },
        unitId: {
          _id: unitId,
          unitNumber: tenant.assignedUnit?.unitNumber || '-'
        },
        month: targetMonth,
        year: targetYear,
        rentAmount: Number(tenant.rentAmount || tenant.assignedUnit?.monthlyRent || 0),
        paidAmount: 0,
        status: 'unpaid'
      }));
  };
  const dataVersion = useDataVersion();
  const bundleCacheRef = useRef<Map<string, any>>(dashboardSessionCache.bundleCache);
  const loadingSessionRef = useRef(0);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(1);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [properties, setProperties] = useState<any[]>(dashboardSessionCache.properties);
  const [propertiesLoaded, setPropertiesLoaded] = useState(dashboardSessionCache.propertiesLoaded);
  const [propertyId, setPropertyId] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTab, setPaymentTab] = useState<'rent' | 'electricity' | 'maintenance' | 'deposit' | 'other'>('rent');
  const [nextActionTab, setNextActionTab] = useState<'rent' | 'electricity' | 'maintenance' | 'deposit' | 'other'>('rent');
  const [paymentPropertyId, setPaymentPropertyId] = useState('');
  const [modalMonth, setModalMonth] = useState(getCurrentMonthValue());
  const [units, setUnits] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [pendingRentRecords, setPendingRentRecords] = useState<any[]>([]);
  const [paidRentRecords, setPaidRentRecords] = useState<any[]>([]);
  const [pendingElectricity, setPendingElectricity] = useState<any[]>([]);
  const [paidElectricity, setPaidElectricity] = useState<any[]>([]);
  const [pendingMaintenance, setPendingMaintenance] = useState<any[]>([]);
  const [paidMaintenance, setPaidMaintenance] = useState<any[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [paidDeposits, setPaidDeposits] = useState<any[]>([]);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [otherForm, setOtherForm] = useState({
    type: 'other',
    amount: '',
    date: getCurrentDateValue(),
    notes: '',
    unitId: '',
    tenantId: ''
  });
  const [collectModal, setCollectModal] = useState<null | {
    type: 'rent' | 'deposit';
    propertyId: string;
    record: any;
    title: string;
    subtitle: string;
    remaining: number;
    actionLabel: string;
  }>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectSaving, setCollectSaving] = useState(false);

  useEffect(() => {
    const currentToken = appStorage.getItem('rentdesk_token') || '';
    if (dashboardSessionCache.token !== currentToken || dashboardSessionCache.dataVersion !== dataVersion) {
      dashboardSessionCache.token = currentToken;
      dashboardSessionCache.dataVersion = dataVersion;
      dashboardSessionCache.properties = [];
      dashboardSessionCache.propertiesLoaded = false;
      dashboardSessionCache.bundleCache.clear();
      bundleCacheRef.current = dashboardSessionCache.bundleCache;
      setProperties([]);
      setPropertiesLoaded(false);
      setData(null);
    }
  }, [dataVersion]);

  const buildMetaForScope = async (scopePropertyId: string, scopeMonth: string, scopeProperties: any[]) => {
    const [scopeYearRaw, scopeMonthRaw] = scopeMonth.split('-').map(Number);
    const scopeYear = Number.isNaN(scopeYearRaw) ? year : scopeYearRaw;
    const scopeMonthNum = Number.isNaN(scopeMonthRaw) ? month : scopeMonthRaw;
    const monthKey = getMonthKey(scopeYear, scopeMonthNum);
    const startDate = new Date(scopeYear, scopeMonthNum - 1, 1).toISOString();
    const endDate = new Date(scopeYear, scopeMonthNum, 0, 23, 59, 59, 999).toISOString();
    const monthStart = new Date(startDate);
    const monthEnd = new Date(endDate);

    if (scopePropertyId) {
      const [unitsRes, tenantsRes, rentRes, rentPaidRes, billRes, billPaidRes, maintenancePaidRes, allPaymentsRes] =
        await Promise.all([
          localFirstGet(`/properties/${scopePropertyId}/units`, { archived: false }),
          localFirstGet(`/properties/${scopePropertyId}/tenants`),
          localFirstGet(`/properties/${scopePropertyId}/rent-records`, {
            month: scopeMonthNum,
            year: scopeYear,
            status: 'unpaid,partial'
          }),
          localFirstGet(`/properties/${scopePropertyId}/rent-records`, {
            month: scopeMonthNum,
            year: scopeYear,
            status: 'paid'
          }),
          localFirstGet(`/properties/${scopePropertyId}/utility-bills`, {
            billType: 'electricity',
            month: monthKey,
            status: 'unpaid,partial'
          }),
          localFirstGet(`/properties/${scopePropertyId}/utility-bills`, {
            billType: 'electricity',
            month: monthKey,
            status: 'paid'
          }),
          localFirstGet(`/properties/${scopePropertyId}/payments`, {
            type: 'maintenance',
            startDate,
            endDate
          }),
          localFirstGet(`/properties/${scopePropertyId}/payments`)
        ]);

      const allPayments = allPaymentsRes.data || [];
      const depositActivity = allPayments.filter((payment: any) => {
        if (!['deposit', 'refund'].includes(payment.type)) return false;
        const paymentDate = new Date(payment.date).getTime();
        return paymentDate >= new Date(startDate).getTime() && paymentDate <= new Date(endDate).getTime();
      });
      const depositBalanceByTenant = new Map<string, number>();
      allPayments
        .filter((payment: any) => ['deposit', 'refund'].includes(payment.type) && payment.tenantId)
        .forEach((payment: any) => {
          const tenantKey = String(payment.tenantId?._id || payment.tenantId);
          const current = depositBalanceByTenant.get(tenantKey) || 0;
          const next =
            payment.type === 'deposit'
              ? current + (payment.amount || 0)
              : current - (payment.amount || 0);
          depositBalanceByTenant.set(tenantKey, next);
        });

      const prop = scopeProperties.find((item) => item._id === scopePropertyId);
      const rate = prop?.maintenanceCharge || 0;
      const paidCollected = (maintenancePaidRes.data || []).filter((payment: any) =>
        String(payment.notes || '').toLowerCase().includes('maintenance collected')
      );
      const maintenanceSourceRecords = [...(rentRes.data || []), ...(rentPaidRes.data || [])];
      const paidKeys = new Set(
        paidCollected
          .filter((payment: any) => payment.tenantId && payment.unitId)
          .map((payment: any) => `${getId(payment.tenantId)}-${getId(payment.unitId)}`)
      );
      const dueSource =
        maintenanceSourceRecords.length > 0
          ? maintenanceSourceRecords.map((record: any) => ({
              tenantId: record.tenantId?._id || record.tenantId,
              tenantName: record.tenantId?.fullName || 'Tenant',
              unitId: record.unitId?._id || record.unitId,
              unitNumber: record.unitId?.unitNumber || '-'
            }))
          : (tenantsRes.data || [])
              .filter((tenant: any) => tenant.assignedUnit?._id)
              .filter((tenant: any) => wasTenantPresentInMonth(tenant, monthStart, monthEnd))
              .map((tenant: any) => ({
                tenantId: tenant._id,
                tenantName: tenant.fullName,
                unitId: tenant.assignedUnit._id,
                unitNumber: tenant.assignedUnit.unitNumber
              }));
      const due = Array.from(
        new Map(
          dueSource.map((item: any) => [
            `${getId(item.tenantId)}-${getId(item.unitId)}`,
            {
              _id: `${getId(item.tenantId)}-${getId(item.unitId)}`,
              tenantId: item.tenantId,
              tenantName: item.tenantName,
              unitId: item.unitId,
              unitNumber: item.unitNumber,
              propertyId: scopePropertyId,
              amount: rate
            }
          ])
        ).values()
      );
      const zeroMaintenancePaid = rate <= 0
        ? due.map((item: any) => ({
            ...item,
            _id: `mnt-free-${item._id}`
          }))
        : [];
      const depositDue = (tenantsRes.data || [])
        .filter((tenant: any) => tenant.isActive && tenant.assignedUnit?._id)
        .map((tenant: any) => {
          const paid = depositBalanceByTenant.get(String(tenant._id)) || 0;
          const required = tenant.depositAmount || 0;
          return {
            _id: `dep-${tenant._id}`,
            tenantId: tenant._id,
            tenantName: tenant.fullName,
            unitId: tenant.assignedUnit._id,
            unitNumber: tenant.assignedUnit.unitNumber,
            propertyId: scopePropertyId,
            required,
            paid,
            remaining: Math.max(0, required - paid)
          };
        });
      const rentRecordsForMonth = [...(rentRes.data || []), ...(rentPaidRes.data || [])];
      const virtualPendingRent = buildMissingRentRows(
        (tenantsRes.data || []).filter((tenant: any) => tenant.isActive),
        rentRecordsForMonth,
        scopeMonthNum,
        scopeYear,
        scopePropertyId
      );

      return {
        units: unitsRes.data || [],
        tenants: tenantsRes.data || [],
        pendingRentRecords: [...(rentRes.data || []), ...virtualPendingRent],
        paidRentRecords: rentPaidRes.data || [],
        pendingElectricity: billRes.data || [],
        paidElectricity: billPaidRes.data || [],
        pendingMaintenance:
          rate <= 0
            ? []
            : due.filter((item: any) => !paidKeys.has(`${getId(item.tenantId)}-${getId(item.unitId)}`)),
        paidMaintenance: [...zeroMaintenancePaid, ...paidCollected],
        pendingDeposits: depositDue.filter((item: any) => item.remaining > 0),
        paidDeposits: depositActivity
      };
    }

    const rentBatches = await Promise.all(
      scopeProperties.map((prop) =>
        localFirstGet(`/properties/${prop._id}/rent-records`, {
          month: scopeMonthNum,
          year: scopeYear,
          status: 'unpaid,partial'
        })
      )
    );
    const rentPaidBatches = await Promise.all(
      scopeProperties.map((prop) =>
        localFirstGet(`/properties/${prop._id}/rent-records`, {
          month: scopeMonthNum,
          year: scopeYear,
          status: 'paid'
        })
      )
    );
    const billBatches = await Promise.all(
      scopeProperties.map((prop) =>
        localFirstGet(`/properties/${prop._id}/utility-bills`, {
          billType: 'electricity',
          month: monthKey,
          status: 'unpaid,partial'
        })
      )
    );
    const billPaidBatches = await Promise.all(
      scopeProperties.map((prop) =>
        localFirstGet(`/properties/${prop._id}/utility-bills`, {
          billType: 'electricity',
          month: monthKey,
          status: 'paid'
        })
      )
    );
    const tenantBatches = await Promise.all(
      scopeProperties.map((prop) => localFirstGet(`/properties/${prop._id}/tenants`))
    );
    const maintenancePaidBatches = await Promise.all(
      scopeProperties.map((prop) =>
        localFirstGet(`/properties/${prop._id}/payments`, {
          type: 'maintenance',
          startDate,
          endDate
        })
      )
    );
    const allPaymentBatches = await Promise.all(
      scopeProperties.map((prop) => localFirstGet(`/properties/${prop._id}/payments`))
    );

    const combinedTenants = tenantBatches.flatMap((response) => response.data || []);
    const combinedRent = rentBatches.flatMap((response, index) =>
      (response.data || []).map((item: any) => ({ ...item, _propertyId: scopeProperties[index]._id }))
    );
    const combinedRentPaid = rentPaidBatches.flatMap((response, index) =>
      (response.data || []).map((item: any) => ({ ...item, _propertyId: scopeProperties[index]._id }))
    );
    const combinedBills = billBatches.flatMap((response, index) =>
      (response.data || []).map((item: any) => ({ ...item, _propertyId: scopeProperties[index]._id }))
    );
    const combinedBillsPaid = billPaidBatches.flatMap((response, index) =>
      (response.data || []).map((item: any) => ({ ...item, _propertyId: scopeProperties[index]._id }))
    );
    const combinedMaintenancePaid = maintenancePaidBatches.flatMap((response, index) =>
      (response.data || [])
        .filter((item: any) => String(item.notes || '').toLowerCase().includes('maintenance collected'))
        .map((item: any) => ({ ...item, _propertyId: scopeProperties[index]._id }))
    );
    const combinedAllPayments = allPaymentBatches.flatMap((response, index) =>
      (response.data || []).map((item: any) => ({ ...item, _propertyId: scopeProperties[index]._id }))
    );
    const combinedDepositActivity = combinedAllPayments.filter((payment: any) => {
      if (!['deposit', 'refund'].includes(payment.type)) return false;
      const paymentDate = new Date(payment.date).getTime();
      return paymentDate >= new Date(startDate).getTime() && paymentDate <= new Date(endDate).getTime();
    });
    const combinedMaintenanceSource = [...combinedRent, ...combinedRentPaid];
    const paidKeys = new Set(
      combinedMaintenancePaid
        .filter((payment: any) => payment.tenantId && payment.unitId)
        .map((payment: any) => `${getId(payment.tenantId)}-${getId(payment.unitId)}`)
    );
    const combinedDue =
      combinedMaintenanceSource.length > 0
        ? Array.from(
            new Map(
              combinedMaintenanceSource.map((record: any) => {
                const targetPropertyId = record._propertyId || record.propertyId;
                const prop = scopeProperties.find((item) => item._id === targetPropertyId);
                return [
                  `${getId(record.tenantId)}-${getId(record.unitId)}`,
                  {
                    _id: `${getId(record.tenantId)}-${getId(record.unitId)}`,
                    tenantId: record.tenantId?._id || record.tenantId,
                    tenantName: record.tenantId?.fullName || 'Tenant',
                    unitId: record.unitId?._id || record.unitId,
                    unitNumber: record.unitId?.unitNumber || '-',
                    propertyId: targetPropertyId,
                    _propertyId: targetPropertyId,
                    amount: prop?.maintenanceCharge || 0
                  }
                ];
              })
            ).values()
          )
        : tenantBatches.flatMap((response, index) => {
            const prop = scopeProperties[index];
            const rate = prop?.maintenanceCharge || 0;
            return (response.data || [])
              .filter((tenant: any) => tenant.assignedUnit?._id)
              .filter((tenant: any) => wasTenantPresentInMonth(tenant, monthStart, monthEnd))
              .map((tenant: any) => ({
                _id: `${tenant._id}-${tenant.assignedUnit._id}`,
                tenantId: tenant._id,
                tenantName: tenant.fullName,
                unitId: tenant.assignedUnit._id,
                unitNumber: tenant.assignedUnit.unitNumber,
                propertyId: prop._id,
                _propertyId: prop._id,
                amount: rate
              }));
          });
    const paidZero = combinedDue
      .filter((item: any) => item.amount <= 0)
      .map((item: any) => ({
        ...item,
        _id: `mnt-free-${item._id}`
      }));
    const depositBalanceByTenant = new Map<string, number>();
    combinedAllPayments
      .filter((payment: any) => ['deposit', 'refund'].includes(payment.type) && payment.tenantId)
      .forEach((payment: any) => {
        const tenantKey = String(payment.tenantId?._id || payment.tenantId);
        const current = depositBalanceByTenant.get(tenantKey) || 0;
        const next =
          payment.type === 'deposit'
            ? current + (payment.amount || 0)
            : current - (payment.amount || 0);
        depositBalanceByTenant.set(tenantKey, next);
      });
    const combinedDepositDue = combinedTenants
      .filter((tenant: any) => tenant.isActive && tenant.assignedUnit?._id)
      .map((tenant: any) => {
        const paid = depositBalanceByTenant.get(String(tenant._id)) || 0;
        const required = tenant.depositAmount || 0;
        const targetProperty = tenant.propertyId?._id || tenant.propertyId;
        return {
          _id: `dep-${tenant._id}`,
          tenantId: tenant._id,
          tenantName: tenant.fullName,
          unitId: tenant.assignedUnit._id,
          unitNumber: tenant.assignedUnit.unitNumber,
          propertyId: targetProperty,
          _propertyId: targetProperty,
          required,
          paid,
          remaining: Math.max(0, required - paid)
        };
      });
    const virtualCombinedRent = properties.flatMap((property) => {
      const propertyTenants = combinedTenants.filter(
        (tenant: any) => String(tenant.propertyId?._id || tenant.propertyId) === String(property._id) && tenant.isActive
      );
      const propertyRecords = [...combinedRent, ...combinedRentPaid].filter(
        (record: any) => String(record._propertyId || record.propertyId) === String(property._id)
      );
      return buildMissingRentRows(propertyTenants, propertyRecords, scopeMonthNum, scopeYear, property._id).map(
        (record: any) => ({
          ...record,
          _propertyId: property._id
        })
      );
    });

    return {
      units: [],
      tenants: combinedTenants,
      pendingRentRecords: [...combinedRent, ...virtualCombinedRent],
      paidRentRecords: combinedRentPaid,
      pendingElectricity: combinedBills,
      paidElectricity: combinedBillsPaid,
      pendingMaintenance: combinedDue
        .filter((item: any) => item.amount > 0)
        .filter((item: any) => !paidKeys.has(`${getId(item.tenantId)}-${getId(item.unitId)}`)),
      paidMaintenance: [...paidZero, ...combinedMaintenancePaid],
      pendingDeposits: combinedDepositDue.filter((item: any) => item.remaining > 0),
      paidDeposits: combinedDepositActivity
    };
  };

  const fetchScopeBundle = async (scopePropertyId: string, scopeMonth: string, scopeProperties: any[]) => {
    const cacheKey = getScopeKey(scopePropertyId, scopeMonth);
    const cached = bundleCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }

    const [scopeYearRaw, scopeMonthRaw] = scopeMonth.split('-').map(Number);
    const scopeYear = Number.isNaN(scopeYearRaw) ? year : scopeYearRaw;
    const scopeMonthNum = Number.isNaN(scopeMonthRaw) ? month : scopeMonthRaw;
    const localDashboard = isScopeBundleLocallyAvailable(scopePropertyId, scopeMonth, scopeProperties)
      ? buildDashboardFromLocal(scopePropertyId, scopeMonth, scopeProperties)
      : null;
    const [dashboardResponse, meta] = await Promise.all([
      localDashboard
        ? Promise.resolve({ data: localDashboard })
        : api.get('/dashboard', {
            params: {
              month: scopeMonthNum,
              year: scopeYear,
              propertyId: scopePropertyId || undefined
            }
          }),
      buildMetaForScope(scopePropertyId, scopeMonth, scopeProperties)
    ]);

    const bundle = {
      dashboard: dashboardResponse.data,
      meta
    };
    bundleCacheRef.current.set(cacheKey, bundle);
    return bundle;
  };

  const buildDashboardFromLocal = (scopePropertyId: string, scopeMonth: string, scopeProperties: any[]) => {
    const [scopeYearRaw, scopeMonthRaw] = scopeMonth.split('-').map(Number);
    const scopeYear = Number.isNaN(scopeYearRaw) ? year : scopeYearRaw;
    const scopeMonthNum = Number.isNaN(scopeMonthRaw) ? month : scopeMonthRaw;
    const monthKey = getMonthKey(scopeYear, scopeMonthNum);
    const monthStart = new Date(scopeYear, scopeMonthNum - 1, 1);
    const monthEnd = new Date(scopeYear, scopeMonthNum, 0, 23, 59, 59, 999);
    const scopedPropertyList = (scopePropertyId
      ? scopeProperties.filter((property) => String(property._id) === String(scopePropertyId))
      : scopeProperties
    ).filter((property) => !property?.isArchived);

    if (!scopedPropertyList.length) {
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
          otherCashIntake: 0
        },
        charts: { rentCollection: [], maintenanceExpenses: [] },
        lists: { pendingRentTenants: [] }
      };
    }

    const scopedPropertyIds = new Set(scopedPropertyList.map((property) => String(property._id)));
    const allUnits = scopedPropertyList.flatMap(
      (property) => (getCachedResponse({ url: `/properties/${property._id}/units`, method: 'get', params: { archived: false } }) as any[]) || []
    );
    const allTenants = scopedPropertyList.flatMap(
      (property) => (getCachedResponse({ url: `/properties/${property._id}/tenants`, method: 'get' }) as any[]) || []
    );
    const allRentRecords = scopedPropertyList.flatMap(
      (property) => (getCachedResponse({ url: `/properties/${property._id}/rent-records`, method: 'get' }) as any[]) || []
    );
    const allUtilityBills = scopedPropertyList.flatMap(
      (property) => (getCachedResponse({ url: `/properties/${property._id}/utility-bills`, method: 'get' }) as any[]) || []
    );
    const allMaintenanceExpenses = scopedPropertyList.flatMap(
      (property) => (getCachedResponse({ url: `/properties/${property._id}/maintenance`, method: 'get' }) as any[]) || []
    );
    const allPayments = scopedPropertyList.flatMap(
      (property) => (getCachedResponse({ url: `/properties/${property._id}/payments`, method: 'get' }) as any[]) || []
    );

    const totalUnits = allUnits.filter((unit: any) => !unit?.isArchived).length;
    const occupiedUnits = allUnits.filter((unit: any) => !unit?.isArchived && unit?.status === 'occupied').length;
    const vacantUnits = allUnits.filter((unit: any) => !unit?.isArchived && unit?.status === 'vacant').length;
    const expectedRent = allUnits
      .filter((unit: any) => !unit?.isArchived && unit?.status === 'occupied')
      .reduce((sum: number, unit: any) => sum + Number(unit?.monthlyRent || 0), 0);

    const monthRentRecords = allRentRecords.filter(
      (record: any) => Number(record?.month) === scopeMonthNum && Number(record?.year) === scopeYear
    );
    const collectedRent = monthRentRecords.reduce((sum: number, record: any) => {
      if (record?.status === 'paid') return sum + Number(record?.rentAmount || 0);
      if (record?.status === 'partial') return sum + Number(record?.paidAmount || 0);
      return sum;
    }, 0);

    const occupiedMap = new Map<string, number>();
    allUnits
      .filter((unit: any) => !unit?.isArchived && unit?.status === 'occupied')
      .forEach((unit: any) => {
        const key = String(unit?.propertyId?._id || unit?.propertyId || '');
        occupiedMap.set(key, (occupiedMap.get(key) || 0) + 1);
      });

    const maintenanceExpected = scopedPropertyList.reduce((sum: number, property: any) => {
      const occupiedCount = occupiedMap.get(String(property._id)) || 0;
      return sum + occupiedCount * Number(property?.maintenanceCharge || 0);
    }, 0);

    const maintenanceCollected = allPayments
      .filter((payment: any) => {
        const paymentDate = new Date(payment?.date);
        return (
          payment?.type === 'maintenance' &&
          String(payment?.notes || '').toLowerCase().includes('maintenance collected') &&
          paymentDate >= monthStart &&
          paymentDate <= monthEnd
        );
      })
      .reduce((sum: number, payment: any) => sum + Number(payment?.amount || 0), 0);

    const maintenanceSpent = allMaintenanceExpenses
      .filter((expense: any) => {
        const expenseDate = new Date(expense?.date);
        return expenseDate >= monthStart && expenseDate <= monthEnd;
      })
      .reduce((sum: number, expense: any) => sum + Number(expense?.amount || 0), 0);

    const monthElectricityBills = allUtilityBills.filter(
      (bill: any) => bill?.billType === 'electricity' && String(bill?.month) === monthKey
    );
    const electricityTotal = monthElectricityBills.reduce((sum: number, bill: any) => sum + Number(bill?.amount || 0), 0);
    const electricityUnpaid = monthElectricityBills
      .filter((bill: any) => bill?.status === 'unpaid')
      .reduce((sum: number, bill: any) => sum + Number(bill?.amount || 0), 0);
    const electricityCollected = Math.max(0, electricityTotal - electricityUnpaid);

    const activeTenants = allTenants.filter(
      (tenant: any) =>
        tenant?.isActive &&
        scopedPropertyIds.has(String(tenant?.propertyId?._id || tenant?.propertyId || ''))
    );
    const depositRequired = activeTenants.reduce((sum: number, tenant: any) => sum + Number(tenant?.depositAmount || 0), 0);
    const depositHeldByTenant = new Map<string, number>();
    allPayments
      .filter((payment: any) => ['deposit', 'refund'].includes(String(payment?.type || '')) && payment?.tenantId)
      .forEach((payment: any) => {
        const tenantKey = String(payment?.tenantId?._id || payment?.tenantId || '');
        const currentHeld = depositHeldByTenant.get(tenantKey) || 0;
        const nextHeld =
          payment?.type === 'deposit'
            ? currentHeld + Number(payment?.amount || 0)
            : currentHeld - Number(payment?.amount || 0);
        depositHeldByTenant.set(tenantKey, nextHeld);
      });
    const depositCollected = activeTenants.reduce(
      (sum: number, tenant: any) => sum + Math.max(0, depositHeldByTenant.get(String(tenant?._id)) || 0),
      0
    );

    const otherCashIntake = allPayments
      .filter((payment: any) => {
        const paymentDate = new Date(payment?.date);
        return payment?.type === 'other' && paymentDate >= monthStart && paymentDate <= monthEnd;
      })
      .reduce((sum: number, payment: any) => sum + Number(payment?.amount || 0), 0);

    const tenantNameById = new Map(
      allTenants.map((tenant: any) => [String(tenant?._id), tenant?.fullName || 'Tenant'])
    );
    const unitNumberById = new Map(
      allUnits.map((unit: any) => [String(unit?._id), unit?.unitNumber || '-'])
    );
    const pendingRentTenants = monthRentRecords
      .filter((record: any) => ['unpaid', 'partial'].includes(String(record?.status || '')))
      .slice(0, 10)
      .map((record: any) => ({
        ...record,
        tenantId:
          typeof record?.tenantId === 'object'
            ? record.tenantId
            : {
                _id: record?.tenantId,
                fullName: tenantNameById.get(String(record?.tenantId)) || 'Tenant'
              },
        unitId:
          typeof record?.unitId === 'object'
            ? record.unitId
            : {
                _id: record?.unitId,
                unitNumber: unitNumberById.get(String(record?.unitId)) || '-'
              }
      }));

    return {
      totals: {
        totalProperties: scopedPropertyList.length,
        totalUnits,
        occupiedUnits,
        vacantUnits,
        monthlyExpectedRent: expectedRent,
        collectedRent,
        pendingRent: Math.max(0, expectedRent - collectedRent),
        monthlyMaintenanceExpected: maintenanceExpected,
        monthlyMaintenanceCollected: maintenanceCollected,
        monthlyMaintenancePending: Math.max(0, maintenanceExpected - maintenanceCollected),
        monthlyMaintenance: maintenanceSpent,
        monthlyElectricity: {
          total: electricityTotal,
          collected: electricityCollected,
          unpaid: electricityUnpaid
        },
        depositRequired,
        depositCollected,
        depositPending: Math.max(0, depositRequired - depositCollected),
        otherCashIntake
      },
      charts: { rentCollection: [], maintenanceExpenses: [] },
      lists: { pendingRentTenants }
    };
  };

  const isScopeBundleLocallyAvailable = (scopePropertyId: string, scopeMonth: string, scopeProperties: any[]) => {
    const [scopeYearRaw, scopeMonthRaw] = scopeMonth.split('-').map(Number);
    const scopeYear = Number.isNaN(scopeYearRaw) ? year : scopeYearRaw;
    const scopeMonthNum = Number.isNaN(scopeMonthRaw) ? month : scopeMonthRaw;

    const scopedProperties = scopePropertyId
      ? scopeProperties.filter((property) => String(property._id) === String(scopePropertyId))
      : scopeProperties;

    if (!scopedProperties.length) {
      return true;
    }

    return scopedProperties.every((property) => {
      const propertyKey = String(property._id);
      const commonChecks = [
        hasCachedGet(`/properties/${propertyKey}/tenants`),
        hasCachedGet(`/properties/${propertyKey}/rent-records`),
        hasCachedGet(`/properties/${propertyKey}/utility-bills`),
        hasCachedGet(`/properties/${propertyKey}/payments`),
        hasCachedGet(`/properties/${propertyKey}/maintenance`),
        hasCachedGet(`/properties/${propertyKey}/units`, { archived: false })
      ];

      return commonChecks.every(Boolean);
    });
  };

  const applyMetaState = (meta: any) => {
    setUnits(meta.units || []);
    setTenants(meta.tenants || []);
    setPendingRentRecords(meta.pendingRentRecords || []);
    setPaidRentRecords(meta.paidRentRecords || []);
    setPendingElectricity(meta.pendingElectricity || []);
    setPaidElectricity(meta.paidElectricity || []);
    setPendingMaintenance(meta.pendingMaintenance || []);
    setPaidMaintenance(meta.paidMaintenance || []);
    setPendingDeposits(meta.pendingDeposits || []);
    setPaidDeposits(meta.paidDeposits || []);
  };

  useEffect(() => {
    if (dashboardSessionCache.propertiesLoaded) {
      setProperties(dashboardSessionCache.properties);
      setPropertiesLoaded(true);
      return;
    }

    const loadProperties = async () => {
      try {
        const response = await api.get('/properties');
        const list = response.data || [];
        dashboardSessionCache.properties = list;
        dashboardSessionCache.propertiesLoaded = true;
        setProperties(list);
      } finally {
        setPropertiesLoaded(true);
      }
    };
    setPropertiesLoaded(false);
    loadProperties();
  }, [dataVersion]);

  useEffect(() => {
    if (!showPaymentModal) {
      setPaymentPropertyId(propertyId || '');
      setModalMonth(getMonthKey(year, month));
    }
  }, [propertyId, month, year, showPaymentModal]);

  useEffect(() => {
    if (!showPaymentModal) return;
    setPaymentPropertyId(propertyId || '');
    setModalMonth(getMonthKey(year, month));
    setPaymentTab('rent');
  }, [showPaymentModal, propertyId]);

  useEffect(() => {
    if (!propertiesLoaded || showPaymentModal) return;

    const scopeMonth = getMonthKey(year, month);
    const scopePropertyId = propertyId || '';
    const scopedProperties = properties;
    let cancelled = false;
    const sessionId = Date.now();
    const finishLoading = async (startedAt: number) => {
      const remaining = Math.max(0, MIN_LOADING_MS - (Date.now() - startedAt));
      if (remaining > 0) {
        await wait(remaining);
      }
      if (cancelled || loadingSessionRef.current !== sessionId) return;
      setLoadingProgress(100);
      await wait(140);
      if (cancelled || loadingSessionRef.current !== sessionId) return;
      setLoading(false);
    };

    const applyEmptyState = () => {
      setData(null);
      applyMetaState({
        units: [],
        tenants: [],
        pendingRentRecords: [],
        paidRentRecords: [],
        pendingElectricity: [],
        paidElectricity: [],
        pendingMaintenance: [],
        paidMaintenance: [],
        pendingDeposits: [],
        paidDeposits: []
      });
    };

    const loadDashboardScope = async () => {
      try {
        const currentCacheKey = getScopeKey(scopePropertyId, scopeMonth);
        const currentMonthInMemory = bundleCacheRef.current.has(currentCacheKey);
        const currentMonthCached =
          currentMonthInMemory ||
          isScopeBundleLocallyAvailable(scopePropertyId, scopeMonth, scopedProperties);
        const shouldShowLoader = !currentMonthCached;
        const startedAt = Date.now();

        if (shouldShowLoader) {
          loadingSessionRef.current = sessionId;
          setLoadingMessage('Loading properties...');
          setLoadingProgress(12);
          setLoading(true);
        }

        const currentBundle = currentMonthInMemory
          ? bundleCacheRef.current.get(currentCacheKey)
          : await fetchScopeBundle(scopePropertyId, scopeMonth, scopedProperties);
        if (cancelled) return;
        setData(currentBundle.dashboard);
        applyMetaState(currentBundle.meta);

        if (!shouldShowLoader) {
          setLoading(false);
          setLoadingProgress(100);
          return;
        }

        setLoadingProgress(68);
        setLoadingMessage('Loading transactions...');
        await wait(220);
        if (cancelled || loadingSessionRef.current !== sessionId) return;
        setLoadingProgress(88);
        setLoadingMessage('Loading remaining metadata...');
        await finishLoading(startedAt);
      } catch {
        if (cancelled) return;
        setLoading(false);
        applyEmptyState();
      }
    };

    loadDashboardScope();

    return () => {
      cancelled = true;
    };
  }, [propertyId, month, year, propertiesLoaded, properties, showPaymentModal, dataVersion]);

  useEffect(() => {
    if (!propertiesLoaded || !showPaymentModal) return;
    let cancelled = false;

    const loadModalScope = async () => {
      try {
        const bundle = await fetchScopeBundle(paymentPropertyId || '', modalMonth, properties);
        if (cancelled) return;
        applyMetaState(bundle.meta);
      } catch {
        if (cancelled) return;
        applyMetaState({
          units: [],
          tenants: [],
          pendingRentRecords: [],
          paidRentRecords: [],
          pendingElectricity: [],
          paidElectricity: [],
          pendingMaintenance: [],
          paidMaintenance: [],
          pendingDeposits: [],
          paidDeposits: []
        });
      }
    };

    loadModalScope();

    return () => {
      cancelled = true;
    };
  }, [showPaymentModal, paymentPropertyId, modalMonth, propertiesLoaded, properties, dataVersion]);

  const totals = data?.totals || {};
  const collectedRent = totals.collectedRent || 0;
  const expectedRent = totals.monthlyExpectedRent || 0;
  const pendingRent = totals.pendingRent || 0;
  const maintenanceSpent = totals.monthlyMaintenance || 0;
  const maintenanceExpected = totals.monthlyMaintenanceExpected || 0;
  const maintenanceCollected = totals.monthlyMaintenanceCollected || 0;
  const maintenancePending = totals.monthlyMaintenancePending || 0;
  const electricityTotal = totals.monthlyElectricity?.total || 0;
  const electricityCollected = totals.monthlyElectricity?.collected || 0;
  const electricityUnpaid = totals.monthlyElectricity?.unpaid || 0;
  const depositRequired = totals.depositRequired || 0;
  const depositCollected = totals.depositCollected || 0;
  const depositPending = totals.depositPending || 0;
  const otherCashIntake = totals.otherCashIntake || 0;
  const occupancyRate = totals.totalUnits
    ? Math.round((totals.occupiedUnits / totals.totalUnits) * 100)
    : 0;
  const cashProgressSegments = useMemo(() => {
    const items = [
      { label: 'Rent', collected: collectedRent, total: expectedRent, color: 'bg-teal-500' },
      { label: 'Electricity', collected: electricityCollected, total: electricityTotal, color: 'bg-amber-500' },
      { label: 'Maintenance', collected: maintenanceCollected, total: maintenanceExpected, color: 'bg-sky-500' },
      { label: 'Other', collected: otherCashIntake, total: otherCashIntake, color: 'bg-emerald-500' }
    ]
      .map((item) => ({
        ...item,
        total: Math.max(item.total, item.collected)
      }))
      .filter((item) => item.total > 0 || item.collected > 0);

    const grandTotal = items.reduce((sum, item) => sum + item.total, 0);
    const grandCollected = items.reduce((sum, item) => sum + Math.min(item.collected, item.total), 0);
    const remaining = Math.max(0, grandTotal - grandCollected);

    return {
      items: items.map((item) => {
        const collected = Math.min(item.collected, item.total);
        return {
          ...item,
          collected,
          share: grandTotal ? (collected / grandTotal) * 100 : 0,
          collectedRate: item.total ? Math.min(100, (collected / item.total) * 100) : 0
        };
      }),
      remaining,
      remainingShare: grandTotal ? (remaining / grandTotal) * 100 : 0,
      grandTotal,
      grandCollected,
      overallRate: grandTotal ? Math.round((grandCollected / grandTotal) * 100) : 0
    };
  }, [
    collectedRent,
    expectedRent,
    electricityCollected,
    electricityTotal,
    maintenanceCollected,
    maintenanceExpected,
    otherCashIntake
  ]);
  const propertyNameById = useMemo(
    () => new Map(properties.map((prop) => [prop._id, prop.name])),
    [properties]
  );
  const tenantByUnitId = useMemo(() => {
    const map = new Map<string, string>();
    tenants.forEach((tenant) => {
      const unitId = tenant.assignedUnit?._id || tenant.unitId;
      if (unitId) {
        map.set(String(unitId), tenant.fullName);
      }
    });
    return map;
  }, [tenants]);
  const unitNumberById = useMemo(() => {
    const map = new Map<string, string>();
    units.forEach((unit) => {
      if (unit._id) map.set(String(unit._id), unit.unitNumber);
    });
    tenants.forEach((tenant) => {
      const unit = tenant.assignedUnit;
      if (unit?._id && unit.unitNumber) {
        map.set(String(unit._id), unit.unitNumber);
      }
    });
    return map;
  }, [units, tenants]);

  const nextActionTabs = [
    { key: 'rent', label: 'Rent' },
    { key: 'electricity', label: 'Electricity Bill' },
    { key: 'maintenance', label: 'Maintenance' },
    { key: 'deposit', label: 'Deposit' },
    { key: 'other', label: 'Others' }
  ] as const;
  const getSelectedMonthActionDate = () => {
    const [selectedYear, selectedMonth] = modalMonth.split('-').map(Number);
    const now = new Date();
    if (
      selectedYear === now.getFullYear() &&
      selectedMonth === now.getMonth() + 1
    ) {
      return now.toISOString();
    }

    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    return new Date(selectedYear, selectedMonth - 1, lastDay, 12, 0, 0, 0).toISOString();
  };
  const openCollectModal = (config: {
    type: 'rent' | 'deposit';
    propertyId: string;
    record: any;
    title: string;
    subtitle: string;
    remaining: number;
    actionLabel: string;
  }) => {
    setCollectAmount(String(config.remaining || ''));
    setCollectModal(config);
  };
  const closeCollectModal = (force = false) => {
    if (collectSaving && !force) return;
    setCollectModal(null);
    setCollectAmount('');
  };
  const submitCollectModal = async () => {
    if (!collectModal) return;
    const amount = Number(collectAmount);
    if (!amount || amount <= 0 || amount > collectModal.remaining) {
      toast.error(
        collectModal.type === 'rent'
          ? 'Rent amount must be greater than 0 and not exceed remaining rent.'
          : 'Deposit amount must be greater than 0 and not exceed remaining deposit.'
      );
      return;
    }

    setCollectSaving(true);

    try {
      if (collectModal.type === 'rent') {
        const record = collectModal.record;
        const paidDate = getSelectedMonthActionDate();
        let updated;

        if (record._virtual) {
          const createResponse = await api.post(
            `/properties/${collectModal.propertyId}/rent-records`,
            {
              unitId: record.unitId?._id || record.unitId,
              tenantId: record.tenantId?._id || record.tenantId,
              month: record.month,
              year: record.year,
              rentAmount: record.rentAmount,
              paidAmount: amount,
              paidDate,
              paymentMode: 'cash',
              status: amount >= Number(record.rentAmount || 0) ? 'paid' : 'partial'
            }
          );
          updated = createResponse.data;
        } else {
          const response = await api.post(
            `/properties/${collectModal.propertyId}/rent-records/${record._id}/collect`,
            {
              amount,
              paidDate,
              paymentMode: 'cash'
            }
          );
          updated = response.data;
        }

        if (updated.status === 'paid') {
          setPendingRentRecords((prev) => prev.filter((item) => item._id !== record._id));
          setPaidRentRecords((prev) => [updated, ...prev.filter((item) => item._id !== updated._id)]);
        } else {
          setPendingRentRecords((prev) => {
            const withoutOld = prev.filter((item) => item._id !== record._id && item._id !== updated._id);
            return [updated, ...withoutOld];
          });
        }
      } else {
        const item = collectModal.record;
        const actionDate = getSelectedMonthActionDate();
        const tenantId = getId(item.tenantId);
        const unitId = getId(item.unitId);

        await api.post(`/properties/${collectModal.propertyId}/payments`, {
          type: 'deposit',
          amount,
          date: actionDate,
          unitId,
          tenantId,
          notes: 'Security deposit collected'
        });

        setPendingDeposits((prev) =>
          prev
            .map((row) =>
              row._id === item._id
                ? {
                    ...row,
                    paid: row.paid + amount,
                    remaining: Math.max(0, row.remaining - amount)
                  }
                : row
            )
            .filter((row) => row.remaining > 0)
        );
        setPaidDeposits((prev) => [
          {
            _id: `dep-${Date.now()}`,
            type: 'deposit',
            amount,
            date: actionDate,
            tenantId: { _id: tenantId, fullName: item.tenantName },
            unitId: { _id: unitId, unitNumber: item.unitNumber },
            _propertyId: collectModal.propertyId,
            propertyId: collectModal.propertyId,
            notes: 'Security deposit collected'
          },
          ...prev
        ]);
      }

      closeCollectModal(true);
      toast.success(collectModal.type === 'rent' ? 'Rent collected.' : 'Deposit collected.');
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          (collectModal.type === 'rent' ? 'Unable to collect rent right now.' : 'Unable to collect deposit right now.')
      );
    } finally {
      setCollectSaving(false);
    }
  };

  return (
    <div className="relative space-y-6">
      {loading && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/18 backdrop-blur-md p-6">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_40px_90px_rgba(15,23,42,0.18)]">
            <div className="flex items-center gap-5">
              <div className="min-w-[84px] text-left">
                <div className="text-4xl font-semibold text-[var(--text)]">{loadingProgress}%</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">{t('Portfolio')}</div>
                <div className="mt-2 truncate text-lg font-medium text-[var(--text)]">{loadingMessage}</div>
              </div>
            </div>
            <div className="mt-5 rounded-full bg-slate-200/80 p-1 shadow-inner">
              <div className="relative h-4 overflow-hidden rounded-full bg-white/60">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#0f766e_0%,#14b8a6_30%,#38bdf8_62%,#8b5cf6_100%)] transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.max(1, loadingProgress)}%` }}
                />
                <div
                  className="absolute inset-y-0 w-24 -translate-x-full bg-white/35 blur-md"
                  style={{
                    left: `${Math.max(12, loadingProgress)}%`,
                    transition: 'left 300ms ease-out'
                  }}
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
          <button
            type="button"
            className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 active:translate-y-0"
            onClick={() => {
              const next = shiftMonthValue(`${year}-${String(month).padStart(2, '0')}`, -1);
              const [yy, mm] = next.split('-').map(Number);
              setYear(yy);
              setMonth(mm);
            }}
            aria-label="Previous month"
          >
            ←
          </button>
          <input
            type="month"
            className="border border-black/10 rounded-lg px-3 py-2 text-sm"
            value={`${year}-${String(month).padStart(2, '0')}`}
            onChange={(e) => {
              const [yy, mm] = e.target.value.split('-').map(Number);
              if (!Number.isNaN(yy) && !Number.isNaN(mm)) {
                setYear(yy);
                setMonth(mm);
              }
            }}
          />
          <button
            type="button"
            className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 active:translate-y-0"
            onClick={() => {
              const next = shiftMonthValue(`${year}-${String(month).padStart(2, '0')}`, 1);
              const [yy, mm] = next.split('-').map(Number);
              setYear(yy);
              setMonth(mm);
            }}
            aria-label="Next month"
          >
            →
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowPaymentModal(true)}
          >
            {t('Add Payment')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Rent"
          value={`${'\u20B9'}${collectedRent} / ${'\u20B9'}${expectedRent}`}
          subLabel={`${'\u20B9'}${pendingRent} pending`}
          tone={pendingRent > 0 ? 'warning' : 'success'}
          icon={<TransactionsIcon width={18} height={18} />}
        />
        <StatCard
          label="Electricity"
          value={`${'\u20B9'}${electricityCollected} / ${'\u20B9'}${electricityTotal}`}
          subLabel={`${'\u20B9'}${electricityUnpaid} unpaid`}
          tone={electricityUnpaid > 0 ? 'warning' : 'success'}
          icon={<UtilitiesIcon width={18} height={18} />}
        />
        <StatCard
          label="Maintenance"
          value={`${'\u20B9'}${maintenanceCollected} / ${'\u20B9'}${maintenanceExpected}`}
          subLabel={`${'\u20B9'}${maintenancePending} pending`}
          tone={maintenancePending > 0 ? 'warning' : 'success'}
          icon={<WrenchIcon width={18} height={18} />}
        />
        <StatCard
          label="Maintenance Spent"
          value={`${'\u20B9'}${maintenanceSpent}`}
          subLabel="Property expenses"
          tone="default"
          icon={<WrenchIcon width={18} height={18} />}
        />
        <StatCard
          label="Deposit"
          value={`${'\u20B9'}${depositCollected} / ${'\u20B9'}${depositRequired}`}
          subLabel={`${'\u20B9'}${depositPending} pending`}
          tone={depositPending > 0 ? 'warning' : 'success'}
          icon={<ShieldIcon width={18} height={18} />}
        />
        <StatCard
          label="Other Cash"
          value={`${'\u20B9'}${otherCashIntake}`}
          subLabel="Extra income received"
          tone={otherCashIntake > 0 ? 'success' : 'default'}
          icon={<CashIcon width={18} height={18} />}
        />
        <StatCard
          label="Occupancy"
          value={`${occupancyRate}%`}
          subLabel={`${totals.occupiedUnits || 0} of ${totals.totalUnits || 0} units occupied`}
          tone={occupancyRate >= 90 ? 'success' : occupancyRate >= 60 ? 'warning' : 'danger'}
          icon={<UnitsIcon width={18} height={18} />}
        />
        <StatCard
          label="Properties"
          value={totals.totalProperties || 0}
          subLabel="Total buildings and flats"
          icon={<BuildingIcon width={18} height={18} />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-6 space-y-4">
          <div className="text-sm font-semibold">{t('Summary')}</div>
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-semibold text-[var(--text)]">
                {cashProgressSegments.overallRate}%
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-[var(--text)]">
                  {'\u20B9'}{Math.round(cashProgressSegments.grandCollected)} / {'\u20B9'}{Math.round(cashProgressSegments.grandTotal)}
                </div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t('Cash Received / Expected')}
                </div>
              </div>
            </div>
            <div className="h-5 rounded-full bg-[var(--surface-2)] overflow-hidden flex">
              {cashProgressSegments.items.length ? (
                <>
                  {cashProgressSegments.items.map((item) => (
                    <div
                      key={item.label}
                      className={`${item.color} h-full`}
                      style={{ width: `${item.share}%` }}
                      title={`${item.label}: ${'₹'}${Math.round(item.collected)} ${t('of')} ${'₹'}${Math.round(item.total)}`}
                    />
                  ))}
                  {cashProgressSegments.remainingShare > 0 && (
                    <div
                      className="h-full bg-black/10"
                      style={{ width: `${cashProgressSegments.remainingShare}%` }}
                      title={`${t('Remaining')}: ${'₹'}${Math.round(cashProgressSegments.remaining)}`}
                    />
                  )}
                </>
              ) : (
                <div className="h-full w-full bg-[var(--surface-2)]" />
              )}
            </div>
            {cashProgressSegments.items.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cashProgressSegments.items.map((item) => (
                  <div
                    key={`${item.label}-legend`}
                    className="flex items-center justify-between rounded-xl border border-black/5 bg-[var(--surface-1)] px-3 py-2 text-xs"
                    title={`${'₹'}${Math.round(item.collected)} ${t('of')} ${'₹'}${Math.round(item.total)}`}
                  >
                    <div className="flex items-center gap-2 text-[var(--muted)]">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                      <span>{item.label}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        item.collectedRate >= 100
                          ? 'bg-emerald-50 text-emerald-600'
                          : item.collectedRate > 0
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-black/5 text-[var(--muted)]'
                      }`}
                    >
                      {Math.round(item.collectedRate)}% {t('collected')}
                    </span>
                  </div>
                ))}
                {cashProgressSegments.remaining > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-black/5 bg-[var(--surface-1)] px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 text-[var(--muted)]">
                      <span className="h-2.5 w-2.5 rounded-full bg-black/20" />
                      <span>{t('Remaining')}</span>
                    </div>
                    <div className="font-medium text-[var(--text)]">
                      {'₹'}{Math.round(cashProgressSegments.remaining)} {t('pending')}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-[var(--muted)]">{t('No pending other payments.')}</div>
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="grid grid-cols-5 gap-1.5 p-1.5 border-b border-black/5">
            {nextActionTabs.map((item) => (
              <button
                key={item.key}
                className={`px-3 py-3 rounded-xl text-sm font-medium transition ${
                  nextActionTab === item.key
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-white text-[var(--muted)] hover:bg-[var(--surface-1)]'
                }`}
                onClick={() => setNextActionTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="p-6 text-sm">
            {nextActionTab === 'rent' && (
              pendingRentRecords.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingRentRecords.map((item: any) => {
                    const pid = propertyId || item._propertyId || item.propertyId;
                    const remaining = Math.max(0, (item.rentAmount || 0) - (item.paidAmount || 0));
                    return (
                      <div key={item._id} className="rounded-2xl border border-black/5 bg-[var(--surface-1)] px-3 py-2.5 flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="font-medium">{item.tenantId?.fullName || 'Tenant'}</div>
                          <div className="text-xs text-[var(--muted)] truncate">
                            {item.unitId?.unitNumber || '-'} • {propertyNameById.get(pid) || 'Property'}
                          </div>
                          <div className="text-xs text-[var(--muted)]">{formatMonthYear(item.month, item.year)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{'\u20B9'}{remaining}</div>
                          <div className="text-xs text-[var(--muted)]">Remaining</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[var(--muted)]">{t('No pending rent.')}</div>
              )
            )}

            {nextActionTab === 'electricity' && (
              pendingElectricity.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingElectricity.map((bill: any) => {
                    const pid = propertyId || bill._propertyId || bill.propertyId;
                    const tenantName = tenantByUnitId.get(String(bill.unitId?._id || bill.unitId)) || 'Tenant';
                    return (
                      <div key={bill._id} className="rounded-2xl border border-black/5 bg-[var(--surface-1)] px-3 py-2.5 flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="font-medium">{bill.unitId?.unitNumber || '-'}</div>
                          <div className="text-xs text-[var(--muted)] truncate">
                            {tenantName} • {propertyNameById.get(pid) || 'Property'}
                          </div>
                          <div className="text-xs text-[var(--muted)]">{formatMonthKey(bill.month)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{'\u20B9'}{bill.amount}</div>
                          <div className="text-xs text-[var(--muted)]">{t('pending')}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[var(--muted)]">{t('No pending electricity bills.')}</div>
              )
            )}

            {nextActionTab === 'maintenance' && (
              pendingMaintenance.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingMaintenance.map((item: any) => {
                    const pid = propertyId || item._propertyId || item.propertyId;
                    return (
                      <div key={item._id} className="rounded-2xl border border-black/5 bg-[var(--surface-1)] px-3 py-2.5 flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="font-medium">{item.tenantName || 'Tenant'}</div>
                          <div className="text-xs text-[var(--muted)] truncate">
                            {item.unitNumber || '-'} • {propertyNameById.get(pid) || 'Property'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{'\u20B9'}{item.amount}</div>
                          <div className="text-xs text-[var(--muted)]">{t('pending')}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[var(--muted)]">{t('No pending maintenance.')}</div>
              )
            )}

            {nextActionTab === 'deposit' && (
              pendingDeposits.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingDeposits.map((item: any) => {
                    const pid = propertyId || item._propertyId || item.propertyId;
                    return (
                      <div key={item._id} className="rounded-2xl border border-black/5 bg-[var(--surface-1)] px-3 py-2.5 flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="font-medium">{item.tenantName || 'Tenant'}</div>
                          <div className="text-xs text-[var(--muted)] truncate">
                            {item.unitNumber || '-'} • {propertyNameById.get(pid) || 'Property'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{'\u20B9'}{item.remaining}</div>
                          <div className="text-xs text-[var(--muted)]">{t('pending')}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[var(--muted)]">{t('No pending deposit.')}</div>
              )
            )}

            {nextActionTab === 'other' && (
              <div className="text-[var(--muted)]">{t('No pending other payments.')}</div>
            )}
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-[var(--muted)]">{t('Add Payment')}</div>
                <div className="text-lg font-semibold">{t('Transactions')}</div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowPaymentModal(false)} aria-label={t('Close')}>
                <CloseIcon width={18} height={18} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="text-xs text-[var(--muted)]">Property</div>
              <select
                className="px-3 py-2 rounded-lg border border-black/10 text-sm"
                value={paymentPropertyId}
                onChange={(e) => setPaymentPropertyId(e.target.value)}
              >
                <option value="">All properties</option>
                {properties.map((prop) => (
                  <option key={prop._id} value={prop._id}>
                    {prop.name}
                  </option>
                ))}
              </select>
              <div className="text-xs text-[var(--muted)]">Month</div>
              <button
                type="button"
                className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 active:translate-y-0"
                onClick={() => setModalMonth((prev) => shiftMonthValue(prev, -1))}
                aria-label="Previous payment month"
              >
                ←
              </button>
              <input
                type="month"
                className="px-3 py-2 rounded-lg border border-black/10 text-sm"
                value={modalMonth}
                onChange={(e) => setModalMonth(e.target.value)}
              />
              <button
                type="button"
                className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 active:translate-y-0"
                onClick={() => setModalMonth((prev) => shiftMonthValue(prev, 1))}
                aria-label="Next payment month"
              >
                →
              </button>
              {!paymentPropertyId && (
                <div className="text-xs text-[var(--muted)]">
                  Select a property to add a new payment.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mb-4">
              {(
                [
                  { key: 'rent', label: 'Rent' },
                  { key: 'electricity', label: 'Electricity Bill' },
                  { key: 'maintenance', label: 'Maintenance' },
                  { key: 'deposit', label: 'Deposit' },
                  { key: 'other', label: 'Others' }
                ] as Array<{ key: 'rent' | 'electricity' | 'maintenance' | 'deposit' | 'other'; label: string }>
              ).map((item) => (
                <button
                  key={item.key}
                  className={`px-4 py-2 rounded-full text-sm border ${
                    paymentTab === item.key
                      ? 'bg-[var(--accent)] text-white border-transparent'
                      : 'border-black/10 text-[var(--muted)]'
                  }`}
                  onClick={() => setPaymentTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {paymentTab === 'rent' && (
              <div className="space-y-4">
                {pendingRentRecords.length ? (
                  <div className="rounded-2xl border border-black/5 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-3">
                      Pending Rent
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {pendingRentRecords.map((record: any) => {
                        const pid = paymentPropertyId || record._propertyId || record.propertyId;
                        const paidAmount = record.paidAmount || 0;
                        const remaining = Math.max(0, (record.rentAmount || 0) - paidAmount);
                        return (
                          <div key={record._id} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium">{record.tenantId?.fullName || 'Tenant'}</div>
                              <div className="text-xs text-[var(--muted)]">
                                Unit {record.unitId?.unitNumber || '-'} •{' '}
                                {propertyNameById.get(pid) || 'Property'}
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                {formatMonthYear(record.month, record.year)}
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                Paid {'\u20B9'}{paidAmount} of {'\u20B9'}{record.rentAmount}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="font-semibold">{'\u20B9'}{remaining}</div>
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                onClick={() => {
                                  const targetProperty = paymentPropertyId || record._propertyId || record.propertyId;
                                  if (!targetProperty) return;
                                  openCollectModal({
                                    type: 'rent',
                                    propertyId: targetProperty,
                                    record,
                                    title: 'Collect Rent',
                                    subtitle: `${record.tenantId?.fullName || 'Tenant'} - ${formatMonthYear(record.month, record.year)}`,
                                    remaining,
                                    actionLabel: 'Collect Rent'
                                  });
                                }}
                              >
                                Collect
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-black/5 bg-white p-4 text-xs text-[var(--muted)]">
                    No pending rent for this month.
                  </div>
                )}

                {paidRentRecords.length ? (
                  <div className="rounded-2xl border border-black/5 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-3">Paid Rent</div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {paidRentRecords.map((record: any) => {
                        const pid = paymentPropertyId || record._propertyId || record.propertyId;
                        const paidOn = record.paidDate || record.updatedAt;
                        return (
                          <div key={record._id} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium">{record.tenantId?.fullName || 'Tenant'}</div>
                              <div className="text-xs text-[var(--muted)]">
                                Unit {record.unitId?.unitNumber || '-'} •{' '}
                                {propertyNameById.get(pid) || 'Property'}
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                {formatMonthYear(record.month, record.year)}
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                Paid on {formatDate(paidOn)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{'\u20B9'}{record.paidAmount || record.rentAmount}</div>
                              <div className="text-xs text-[var(--muted)]">of {'\u20B9'}{record.rentAmount}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-black/5 bg-white p-4 text-xs text-[var(--muted)]">
                    No paid rent yet.
                  </div>
                )}
              </div>
            )}

            {paymentTab === 'electricity' && (
              <div className="space-y-4">
                {pendingElectricity.length ? (
                  <div className="rounded-2xl border border-black/5 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-3">
                      Pending Electricity Bills
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {pendingElectricity.map((bill: any) => {
                        const pid = paymentPropertyId || bill._propertyId || bill.propertyId;
                        const tenantName = tenantByUnitId.get(String(bill.unitId?._id || bill.unitId)) || 'Tenant';
                        return (
                          <div key={bill._id} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium">Unit {bill.unitId?.unitNumber || '-'}</div>
                              <div className="text-xs text-[var(--muted)]">
                                {tenantName} • {propertyNameById.get(pid) || 'Property'} • {formatMonthKey(bill.month)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="font-semibold">{'\u20B9'}{bill.amount}</div>
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                onClick={async () => {
                                  const targetProperty = paymentPropertyId || bill._propertyId || bill.propertyId;
                                  if (!targetProperty) return;
                                  await api.patch(
                                    `/properties/${targetProperty}/utility-bills/${bill._id}`,
                                    { status: 'paid' }
                                  );
                                  setPendingElectricity((prev) => prev.filter((item) => item._id !== bill._id));
                                  setPaidElectricity((prev) => [
                                    { ...bill, updatedAt: new Date().toISOString() },
                                    ...prev
                                  ]);
                                }}
                              >
                                Mark Paid
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-black/5 bg-white p-4 text-xs text-[var(--muted)]">
                    No pending electricity bills for this month.
                  </div>
                )}

                {paidElectricity.length ? (
                  <div className="rounded-2xl border border-black/5 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-3">Paid Electricity Bills</div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {paidElectricity.map((bill: any) => {
                        const pid = paymentPropertyId || bill._propertyId || bill.propertyId;
                        const tenantName = tenantByUnitId.get(String(bill.unitId?._id || bill.unitId)) || 'Tenant';
                        const paidOn = bill.updatedAt || bill.createdAt;
                        return (
                          <div key={bill._id} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium">Unit {bill.unitId?.unitNumber || '-'}</div>
                              <div className="text-xs text-[var(--muted)]">
                                {tenantName} • {propertyNameById.get(pid) || 'Property'} • {formatMonthKey(bill.month)}
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                Paid on {formatDate(paidOn)}
                              </div>
                            </div>
                            <div className="font-semibold">{'\u20B9'}{bill.amount}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-black/5 bg-white p-4 text-xs text-[var(--muted)]">
                    No paid electricity bills yet.
                  </div>
                )}
              </div>
            )}

            {paymentTab === 'maintenance' && (
              <div className="space-y-4">
                {pendingMaintenance.length ? (
                  <div className="rounded-2xl border border-black/5 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-3">
                      Maintenance Due
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {pendingMaintenance.map((item: any) => {
                        const pid = paymentPropertyId || item._propertyId || item.propertyId;
                        return (
                          <div key={item._id} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium">{item.tenantName || 'Tenant'}</div>
                              <div className="text-xs text-[var(--muted)]">
                                Unit {item.unitNumber || '-'} • {propertyNameById.get(pid) || 'Property'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="font-semibold">{'\u20B9'}{item.amount}</div>
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                onClick={async () => {
                                  const targetProperty = paymentPropertyId || item._propertyId || item.propertyId;
                                  if (!targetProperty) return;
                                  const actionDate = getSelectedMonthActionDate();
                                  await api.post(`/properties/${targetProperty}/payments`, {
                                    type: 'maintenance',
                                    amount: item.amount,
                                    date: actionDate,
                                    unitId: item.unitId,
                                    tenantId: item.tenantId,
                                    notes: `Maintenance collected for ${modalMonth}`
                                  });
                                  setPendingMaintenance((prev) =>
                                    prev.filter((row) => row._id !== item._id)
                                  );
                                  setPaidMaintenance((prev) => [
                                    {
                                      _id: `mnt-${Date.now()}`,
                                      amount: item.amount,
                                      tenantId: item.tenantId,
                                      unitId: item.unitId,
                                      date: actionDate,
                                      _propertyId: targetProperty,
                                      propertyId: targetProperty,
                                      notes: `Maintenance collected for ${modalMonth}`
                                    },
                                    ...prev
                                  ]);
                                }}
                              >
                                Mark Paid
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-black/5 bg-white p-4 text-xs text-[var(--muted)]">
                    No maintenance dues.
                  </div>
                )}

                {paidMaintenance.length ? (
                  <div className="rounded-2xl border border-black/5 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-3">
                      Maintenance Paid
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {paidMaintenance.map((item: any) => {
                        const pid = paymentPropertyId || item._propertyId || item.propertyId;
                        const tenantName =
                          item.tenantId?.fullName ||
                          tenants.find((t) => getId(t._id) === getId(item.tenantId))?.fullName ||
                          'Tenant';
                        const unitNumber =
                          item.unitId?.unitNumber || unitNumberById.get(getId(item.unitId)) || '-';
                        const paidOn = item.date || item.createdAt || item.updatedAt;
                        return (
                          <div key={item._id} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium">{tenantName}</div>
                              <div className="text-xs text-[var(--muted)]">
                                Unit {unitNumber} • {propertyNameById.get(pid) || 'Property'}
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                Paid on {formatDate(paidOn)}
                              </div>
                            </div>
                            <div className="font-semibold">{'\u20B9'}{item.amount}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-black/5 bg-white p-4 text-xs text-[var(--muted)]">
                    No maintenance paid yet.
                  </div>
                )}
              </div>
            )}

            {paymentTab === 'deposit' && (
              <div className="space-y-4">
                {pendingDeposits.length ? (
                  <div className="rounded-2xl border border-black/5 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-3">
                      Remaining Deposit
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {pendingDeposits.map((item: any) => {
                        const pid = paymentPropertyId || item._propertyId || item.propertyId;
                        return (
                          <div key={item._id} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium">{item.tenantName || 'Tenant'}</div>
                              <div className="text-xs text-[var(--muted)]">
                                Unit {item.unitNumber || '-'} • {propertyNameById.get(pid) || 'Property'}
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                Paid {'\u20B9'}{item.paid} of {'\u20B9'}{item.required}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="font-semibold">{'\u20B9'}{item.remaining}</div>
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                onClick={() => {
                                  const targetProperty = paymentPropertyId || item._propertyId || item.propertyId;
                                  if (!targetProperty) return;
                                  openCollectModal({
                                    type: 'deposit',
                                    propertyId: targetProperty,
                                    record: item,
                                    title: 'Collect Deposit',
                                    subtitle: `${item.tenantName || 'Tenant'} - ${item.unitNumber || '-'}`,
                                    remaining: item.remaining,
                                    actionLabel: 'Collect Deposit'
                                  });
                                }}
                              >
                                Collect
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-black/5 bg-white p-4 text-xs text-[var(--muted)]">
                    No remaining deposit dues.
                  </div>
                )}

                {paidDeposits.length ? (
                  <div className="rounded-2xl border border-black/5 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-3">
                      Deposit Activity
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {paidDeposits.map((item: any) => {
                        const pid = paymentPropertyId || item._propertyId || item.propertyId;
                        const tenantName = item.tenantId?.fullName || tenants.find((t) => String(t._id) === String(item.tenantId))?.fullName || 'Tenant';
                        const unitNumber = item.unitId?.unitNumber || unitNumberById.get(String(item.unitId)) || '-';
                        return (
                          <div key={item._id} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium">{tenantName}</div>
                              <div className="text-xs text-[var(--muted)]">
                                Unit {unitNumber} - {propertyNameById.get(pid) || 'Property'} - {item.type === 'refund' ? 'Deposit Returned' : 'Deposit Collected'}
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                {formatDate(item.date)}
                              </div>
                            </div>
                            <div className="font-semibold">{'\u20B9'}{item.amount}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-black/5 bg-white p-4 text-xs text-[var(--muted)]">
                    No deposit activity for this period.
                  </div>
                )}
              </div>
            )}

            {paymentTab === 'other' && (
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!paymentPropertyId || !otherForm.amount) {
                    toast.error('Enter an amount.');
                    return;
                  }
                  setPaymentSaving(true);
                  try {
                    const isMaintenanceSpent = otherForm.type === 'maintenance';
                    await api.post(`/properties/${paymentPropertyId}/payments`, {
                      type: otherForm.type,
                      amount: Number(otherForm.amount),
                      date: otherForm.date,
                      notes: otherForm.notes || (isMaintenanceSpent ? 'Maintenance spent' : undefined),
                      unitId: otherForm.unitId || undefined,
                      tenantId: otherForm.tenantId || undefined
                    });
                    setShowPaymentModal(false);
                    toast.success('Payment recorded.');
                  } catch (err: any) {
                    toast.error(err?.response?.data?.message || 'Failed to save payment.');
                  } finally {
                    setPaymentSaving(false);
                  }
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--muted)]">Payment Type</label>
                    <select
                      className="w-full px-3 py-2 mt-1"
                      value={otherForm.type}
                      onChange={(e) => setOtherForm((prev) => ({ ...prev, type: e.target.value }))}
                    >
                      <option value="other">Other</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Amount</label>
                    <input
                      className="w-full px-3 py-2 mt-1"
                      value={otherForm.amount}
                      onChange={(e) => setOtherForm((prev) => ({ ...prev, amount: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 mt-1"
                      value={otherForm.date}
                      onChange={(e) => setOtherForm((prev) => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Unit (Optional)</label>
                    <select
                      className="w-full px-3 py-2 mt-1"
                      value={otherForm.unitId}
                      onChange={(e) => setOtherForm((prev) => ({ ...prev, unitId: e.target.value }))}
                    >
                      <option value="">No unit</option>
                      {units.map((unit) => (
                        <option key={unit._id} value={unit._id}>
                          {unit.unitNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Tenant (Optional)</label>
                    <select
                      className="w-full px-3 py-2 mt-1"
                      value={otherForm.tenantId}
                      onChange={(e) => setOtherForm((prev) => ({ ...prev, tenantId: e.target.value }))}
                    >
                      <option value="">No tenant</option>
                      {tenants.map((tenant) => (
                        <option key={tenant._id} value={tenant._id}>
                          {tenant.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-[var(--muted)]">Notes (Optional)</label>
                    <input
                      className="w-full px-3 py-2 mt-1"
                      value={otherForm.notes}
                      onChange={(e) => setOtherForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Describe this payment"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={paymentSaving}
                  >
                    {paymentSaving ? 'Saving...' : 'Save Payment'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-cancel"
                    onClick={() => setShowPaymentModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
          {collectModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/20 backdrop-blur-sm p-6">
              <div className="w-full max-w-md rounded-3xl border border-black/5 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold">{collectModal.title}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{collectModal.subtitle}</div>
                    <div className="mt-2 text-xs uppercase tracking-wide text-[var(--muted)]">
                      Remaining {'\u20B9'}{collectModal.remaining}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="modal-close-btn"
                    onClick={() => closeCollectModal()}
                    disabled={collectSaving}
                    aria-label="Close"
                  >
                    <CloseIcon width={18} height={18} />
                  </button>
                </div>
                <div className="mt-5">
                  <label className="text-xs text-[var(--muted)]">Amount Received</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    placeholder="Enter amount"
                    autoFocus
                  />
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={submitCollectModal}
                    disabled={collectSaving}
                  >
                    {collectSaving ? 'Saving...' : collectModal.actionLabel}
                  </button>
                  <button
                    type="button"
                    className="btn btn-cancel"
                    onClick={() => closeCollectModal()}
                    disabled={collectSaving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
