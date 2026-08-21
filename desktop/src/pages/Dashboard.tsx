import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import PropertyPicker from '../components/PropertyPicker';
import DatePicker from '../components/DatePicker';
import Badge from '../components/Badge';
import { formatDate, formatMonthKey, formatMonthYear, getCurrentDateValue, getCurrentMonthValue, shiftMonthValue } from '../lib/dateFormat';
import { useI18n } from '../lib/i18n';
import { cachedGet, invalidateByTag, isCached, useCachedQuery } from '../lib/queryCache';
import { CashIcon, CloseIcon, ReportsIcon, ShieldIcon, TransactionsIcon, UnitsIcon, UtilitiesIcon, WrenchIcon } from '../components/icons';
import { toast } from '../lib/toast';
import { SkeletonStatCards, SkeletonDashboardSummary } from '../components/Skeleton';
import { formatCurrency } from '../lib/format';

const Dashboard = () => {
  const { t } = useI18n();
  const getId = (value: any) => String(value?._id || value || '');
  const getMonthKey = (targetYear: number, targetMonth: number) =>
    `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  const wasTenantPresentInMonth = (tenant: any, startDate: Date, endDate: Date) => {
    const movedInDate = tenant?.movedInDate ? new Date(tenant.movedInDate) : tenant?.createdAt ? new Date(tenant.createdAt) : null;
    const movedOutDate = tenant?.movedOutDate ? new Date(tenant.movedOutDate) : null;
    const startedBeforeMonthEnd = !movedInDate || movedInDate <= endDate;
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
  const { data: propertiesData, loading: propertiesLoading } = useCachedQuery<any[]>('/properties');
  const properties = propertiesData || [];
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
    tenantId: '',
    direction: 'in' as 'in' | 'out'
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

  const get = async (url: string, params?: Record<string, any>) => ({ data: await cachedGet(url, params) });

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
          get(`/properties/${scopePropertyId}/units`, { archived: false }),
          get(`/properties/${scopePropertyId}/tenants`),
          get(`/properties/${scopePropertyId}/rent-records`, {
            month: scopeMonthNum,
            year: scopeYear,
            status: 'unpaid,partial'
          }),
          get(`/properties/${scopePropertyId}/rent-records`, {
            month: scopeMonthNum,
            year: scopeYear,
            status: 'paid'
          }),
          get(`/properties/${scopePropertyId}/utility-bills`, {
            billType: 'electricity',
            month: monthKey,
            status: 'unpaid,partial'
          }),
          get(`/properties/${scopePropertyId}/utility-bills`, {
            billType: 'electricity',
            month: monthKey,
            status: 'paid'
          }),
          get(`/properties/${scopePropertyId}/payments`, {
            type: 'maintenance',
            startDate,
            endDate
          }),
          get(`/properties/${scopePropertyId}/payments`)
        ]);

      const allPayments = allPaymentsRes.data || [];
      const depositActivity = allPayments.filter((payment: any) => {
        if (!['deposit', 'refund'].includes(payment.type)) return false;
        const paymentDate = new Date(payment.date).getTime();
        return paymentDate >= new Date(startDate).getTime() && paymentDate <= new Date(endDate).getTime();
      });
      const depositBalanceByTenant = new Map<string, number>();
      allPayments
        .filter(
          (payment: any) =>
            ['deposit', 'refund'].includes(payment.type) &&
            payment.tenantId &&
            new Date(payment.date).getTime() <= monthEnd.getTime()
        )
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
        .filter((tenant: any) => tenant.assignedUnit?._id && wasTenantPresentInMonth(tenant, monthStart, monthEnd))
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
        (tenantsRes.data || []).filter((tenant: any) => wasTenantPresentInMonth(tenant, monthStart, monthEnd)),
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
        get(`/properties/${prop._id}/rent-records`, {
          month: scopeMonthNum,
          year: scopeYear,
          status: 'unpaid,partial'
        })
      )
    );
    const rentPaidBatches = await Promise.all(
      scopeProperties.map((prop) =>
        get(`/properties/${prop._id}/rent-records`, {
          month: scopeMonthNum,
          year: scopeYear,
          status: 'paid'
        })
      )
    );
    const billBatches = await Promise.all(
      scopeProperties.map((prop) =>
        get(`/properties/${prop._id}/utility-bills`, {
          billType: 'electricity',
          month: monthKey,
          status: 'unpaid,partial'
        })
      )
    );
    const billPaidBatches = await Promise.all(
      scopeProperties.map((prop) =>
        get(`/properties/${prop._id}/utility-bills`, {
          billType: 'electricity',
          month: monthKey,
          status: 'paid'
        })
      )
    );
    const tenantBatches = await Promise.all(
      scopeProperties.map((prop) => get(`/properties/${prop._id}/tenants`))
    );
    const maintenancePaidBatches = await Promise.all(
      scopeProperties.map((prop) =>
        get(`/properties/${prop._id}/payments`, {
          type: 'maintenance',
          startDate,
          endDate
        })
      )
    );
    const allPaymentBatches = await Promise.all(
      scopeProperties.map((prop) => get(`/properties/${prop._id}/payments`))
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
      .filter(
        (payment: any) =>
          ['deposit', 'refund'].includes(payment.type) &&
          payment.tenantId &&
          new Date(payment.date).getTime() <= monthEnd.getTime()
      )
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
      .filter((tenant: any) => tenant.assignedUnit?._id && wasTenantPresentInMonth(tenant, monthStart, monthEnd))
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
        (tenant: any) =>
          String(tenant.propertyId?._id || tenant.propertyId) === String(property._id) &&
          wasTenantPresentInMonth(tenant, monthStart, monthEnd)
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
    const [scopeYearRaw, scopeMonthRaw] = scopeMonth.split('-').map(Number);
    const scopeYear = Number.isNaN(scopeYearRaw) ? year : scopeYearRaw;
    const scopeMonthNum = Number.isNaN(scopeMonthRaw) ? month : scopeMonthRaw;

    const [dashboard, meta] = await Promise.all([
      cachedGet('/dashboard', {
        month: scopeMonthNum,
        year: scopeYear,
        propertyId: scopePropertyId || undefined
      }),
      buildMetaForScope(scopePropertyId, scopeMonth, scopeProperties)
    ]);

    return { dashboard, meta };
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

  const emptyMeta = {
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
  };

  const reloadMainScope = async (options?: { force?: boolean }) => {
    const scopeMonth = getMonthKey(year, month);
    const scopePropertyId = propertyId || '';
    if (options?.force) {
      const targets = scopePropertyId ? [scopePropertyId] : properties.map((property) => property._id);
      targets.forEach((id: string) => {
        invalidateByTag('dashboard', id);
        invalidateByTag('rentRecord', id);
        invalidateByTag('utilityBill', id);
        invalidateByTag('maintenance', id);
        invalidateByTag('payment', id);
        invalidateByTag('unit', id);
        invalidateByTag('tenant', id);
      });
      invalidateByTag('dashboard');
    }

    const dashboardCached = isCached('/dashboard', { month, year, propertyId: scopePropertyId || undefined });
    if (!dashboardCached) setLoading(true);
    try {
      const bundle = await fetchScopeBundle(scopePropertyId, scopeMonth, properties);
      setData(bundle.dashboard);
      applyMetaState(bundle.meta);
    } catch {
      setData(null);
      applyMetaState(emptyMeta);
    } finally {
      setLoading(false);
    }
  };

  const reloadModalScope = async () => {
    try {
      const bundle = await fetchScopeBundle(paymentPropertyId || '', modalMonth, properties);
      applyMetaState(bundle.meta);
    } catch {
      applyMetaState(emptyMeta);
    }
  };

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

  const mainScopeKey = `${propertyId}::${month}-${year}`;
  const [renderedMainScopeKey, setRenderedMainScopeKey] = useState(mainScopeKey);
  if (mainScopeKey !== renderedMainScopeKey) {
    setRenderedMainScopeKey(mainScopeKey);
    setData(null);
    setLoading(true);
  }

  useEffect(() => {
    if (propertiesLoading || showPaymentModal) return;
    void reloadMainScope();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, month, year, propertiesLoading, properties.length, showPaymentModal]);

  useEffect(() => {
    if (propertiesLoading || !showPaymentModal) return;
    void reloadModalScope();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPaymentModal, paymentPropertyId, modalMonth, propertiesLoading, properties.length]);

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
  const otherCashSpent = totals.otherCashSpent || 0;
  const monthlyRevenue = totals.monthlyRevenue || 0;
  const lifetimeRevenue = totals.lifetimeRevenue || 0;
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

      invalidateByTag('rentRecord', collectModal.propertyId);
      invalidateByTag('payment', collectModal.propertyId);
      invalidateByTag('dashboard', collectModal.propertyId);
      invalidateByTag('dashboard');
      void reloadMainScope();

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
          <button
            type="button"
            className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
          <DatePicker
            picker="month"
            className="w-[170px] px-3 py-2 rounded-xl border border-black/10"
            value={`${year}-${String(month).padStart(2, '0')}`}
            onChange={(next) => {
              const [yy, mm] = next.split('-').map(Number);
              if (!Number.isNaN(yy) && !Number.isNaN(mm)) {
                setYear(yy);
                setMonth(mm);
              }
            }}
          />
          <button
            type="button"
            className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
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

      {loading && !data ? (
        <div className="space-y-6">
          <SkeletonStatCards count={7} />
          <SkeletonDashboardSummary />
        </div>
      ) : (
      <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={`${'₹'}${formatCurrency(monthlyRevenue)}`}
          subLabel={`${'₹'}${formatCurrency(lifetimeRevenue)} lifetime, all properties`}
          tone={monthlyRevenue >= 0 ? 'success' : 'danger'}
          icon={<ReportsIcon width={18} height={18} />}
        />
        <StatCard
          label="Rent"
          value={`${'\u20B9'}${formatCurrency(collectedRent)} / ${'\u20B9'}${formatCurrency(expectedRent)}`}
          subLabel={`${'\u20B9'}${formatCurrency(pendingRent)} pending`}
          tone={pendingRent > 0 ? 'warning' : 'success'}
          icon={<TransactionsIcon width={18} height={18} />}
        />
        <StatCard
          label="Electricity"
          value={`${'\u20B9'}${formatCurrency(electricityCollected)} / ${'\u20B9'}${formatCurrency(electricityTotal)}`}
          subLabel={`${'\u20B9'}${formatCurrency(electricityUnpaid)} unpaid`}
          tone={electricityUnpaid > 0 ? 'warning' : 'success'}
          icon={<UtilitiesIcon width={18} height={18} />}
        />
        <StatCard
          label="Maintenance"
          value={`${'\u20B9'}${formatCurrency(maintenanceCollected)} / ${'\u20B9'}${formatCurrency(maintenanceExpected)}`}
          subLabel={
            <>
              {maintenancePending > 0 ? `${'\u20B9'}${formatCurrency(maintenancePending)} pending` : 'Fully collected'}
              {maintenanceSpent > 0 ? ` \u00B7 ${'\u20B9'}${formatCurrency(maintenanceSpent)} spent` : ''}
            </>
          }
          tone={maintenancePending > 0 ? 'warning' : 'success'}
          icon={<WrenchIcon width={18} height={18} />}
        />
        <StatCard
          label="Deposit"
          value={`${'\u20B9'}${formatCurrency(depositCollected)} / ${'\u20B9'}${formatCurrency(depositRequired)}`}
          subLabel={`${'\u20B9'}${formatCurrency(depositPending)} pending`}
          tone={depositPending > 0 ? 'warning' : 'success'}
          icon={<ShieldIcon width={18} height={18} />}
        />
        <StatCard
          label="Other Cash"
          value={`${'\u20B9'}${formatCurrency(otherCashIntake)}`}
          subLabel={otherCashSpent > 0 ? `${'\u20B9'}${formatCurrency(otherCashSpent)} spent` : 'Extra income received'}
          tone={otherCashIntake > 0 ? 'success' : 'default'}
          icon={<CashIcon width={18} height={18} />}
        />
        <StatCard
          label="Occupancy"
          value={`${occupancyRate}%`}
          subLabel={
            <span className="flex items-center gap-1.5">
              {totals.occupiedUnits || 0} of {totals.totalUnits || 0} units
              <Badge tone="neutral" dot={false}>
                {totals.totalProperties || 0} propert{(totals.totalProperties || 0) === 1 ? 'y' : 'ies'}
              </Badge>
            </span>
          }
          tone={occupancyRate >= 90 ? 'success' : occupancyRate >= 60 ? 'warning' : 'danger'}
          icon={<UnitsIcon width={18} height={18} />}
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
                  {'\u20B9'}{formatCurrency(Math.round(cashProgressSegments.grandCollected))} / {'\u20B9'}{formatCurrency(Math.round(cashProgressSegments.grandTotal))}
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
                      title={`${item.label}: ${'₹'}${formatCurrency(Math.round(item.collected))} ${t('of')} ${'₹'}${formatCurrency(Math.round(item.total))}`}
                    />
                  ))}
                  {cashProgressSegments.remainingShare > 0 && (
                    <div
                      className="h-full bg-black/10"
                      style={{ width: `${cashProgressSegments.remainingShare}%` }}
                      title={`${t('Remaining')}: ${'₹'}${formatCurrency(Math.round(cashProgressSegments.remaining))}`}
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
                    title={`${'₹'}${formatCurrency(Math.round(item.collected))} ${t('of')} ${'₹'}${formatCurrency(Math.round(item.total))}`}
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
                      {'₹'}{formatCurrency(Math.round(cashProgressSegments.remaining))} {t('pending')}
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
                className={`px-2 py-3 rounded-xl text-sm font-medium transition whitespace-nowrap overflow-hidden text-ellipsis ${
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
                          <div className="font-semibold">{'\u20B9'}{formatCurrency(remaining)}</div>
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
                          <div className="font-semibold">{'\u20B9'}{formatCurrency(bill.amount)}</div>
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
                          <div className="font-semibold">{'\u20B9'}{formatCurrency(item.amount)}</div>
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
                          <div className="font-semibold">{'\u20B9'}{formatCurrency(item.remaining)}</div>
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
      </>
      )}

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
                className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => setModalMonth((prev) => shiftMonthValue(prev, -1))}
                aria-label="Previous payment month"
              >
                ←
              </button>
              <DatePicker
                picker="month"
                className="w-[150px] px-3 py-2 rounded-xl border border-black/10"
                value={modalMonth}
                onChange={(next) => setModalMonth(next)}
              />
              <button
                type="button"
                className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
                                Paid {'\u20B9'}{formatCurrency(paidAmount)} of {'\u20B9'}{formatCurrency(record.rentAmount)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="font-semibold">{'\u20B9'}{formatCurrency(remaining)}</div>
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
                              <div className="font-semibold">{'\u20B9'}{formatCurrency(record.paidAmount || record.rentAmount)}</div>
                              <div className="text-xs text-[var(--muted)]">of {'\u20B9'}{formatCurrency(record.rentAmount)}</div>
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
                              <div className="font-semibold">{'\u20B9'}{formatCurrency(bill.amount)}</div>
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
                                  invalidateByTag('utilityBill', targetProperty);
                                  invalidateByTag('dashboard', targetProperty);
                                  invalidateByTag('dashboard');
                                  void reloadMainScope();
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
                            <div className="font-semibold">{'\u20B9'}{formatCurrency(bill.amount)}</div>
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
                              <div className="font-semibold">{'\u20B9'}{formatCurrency(item.amount)}</div>
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
                                  invalidateByTag('payment', targetProperty);
                                  invalidateByTag('dashboard', targetProperty);
                                  invalidateByTag('dashboard');
                                  void reloadMainScope();
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
                            <div className="font-semibold">{'\u20B9'}{formatCurrency(item.amount)}</div>
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
                                Paid {'\u20B9'}{formatCurrency(item.paid)} of {'\u20B9'}{formatCurrency(item.required)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="font-semibold">{'\u20B9'}{formatCurrency(item.remaining)}</div>
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
                            <div className="font-semibold">{'\u20B9'}{formatCurrency(item.amount)}</div>
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
                    const isDirectional = otherForm.type === 'other' || otherForm.type === 'maintenance';
                    const isMaintenanceSpent = otherForm.type === 'maintenance' && otherForm.direction === 'out';
                    const isMaintenanceCollected = otherForm.type === 'maintenance' && otherForm.direction === 'in';
                    const defaultNotes = isMaintenanceSpent
                      ? 'Maintenance spent'
                      : isMaintenanceCollected
                        ? 'Maintenance collected (extra)'
                        : undefined;
                    await api.post(`/properties/${paymentPropertyId}/payments`, {
                      type: otherForm.type,
                      amount: Number(otherForm.amount),
                      date: otherForm.date,
                      notes: otherForm.notes || defaultNotes,
                      unitId: otherForm.unitId || undefined,
                      tenantId: otherForm.tenantId || undefined,
                      direction: isDirectional ? otherForm.direction : undefined
                    });
                    invalidateByTag('payment', paymentPropertyId);
                    invalidateByTag('dashboard', paymentPropertyId);
                    invalidateByTag('dashboard');
                    setShowPaymentModal(false);
                    void reloadMainScope();
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
                      onChange={(e) =>
                        setOtherForm((prev) => ({
                          ...prev,
                          type: e.target.value,
                          direction: e.target.value === 'maintenance' ? 'out' : 'in'
                        }))
                      }
                    >
                      <option value="other">Other</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                  {(otherForm.type === 'other' || otherForm.type === 'maintenance') && (
                    <div>
                      <label className="text-xs text-[var(--muted)]">Direction</label>
                      <select
                        className="w-full px-3 py-2 mt-1"
                        value={otherForm.direction}
                        onChange={(e) => setOtherForm((prev) => ({ ...prev, direction: e.target.value as 'in' | 'out' }))}
                      >
                        {otherForm.type === 'maintenance' ? (
                          <>
                            <option value="in">Cash In (extra maintenance collected)</option>
                            <option value="out">Cash Out (maintenance/repair expense)</option>
                          </>
                        ) : (
                          <>
                            <option value="in">Cash In (income received)</option>
                            <option value="out">Cash Out (expense paid)</option>
                          </>
                        )}
                      </select>
                    </div>
                  )}
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
                    <DatePicker
                      className="w-full px-3 py-2 mt-1 rounded-xl border border-black/10"
                      value={otherForm.date}
                      onChange={(next) => setOtherForm((prev) => ({ ...prev, date: next }))}
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
                      Remaining {'\u20B9'}{formatCurrency(collectModal.remaining)}
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
