import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import TenantFormModal from '../components/TenantFormModal';
import DepositPaymentModal from '../components/DepositPaymentModal';
import Badge, { type BadgeTone } from '../components/Badge';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { AlertTriangleIcon, CloseIcon, EyeIcon, ShieldIcon, TenantsIcon, TransactionsIcon, UtilitiesIcon } from '../components/icons';
import { formatDate, formatMonthKey, formatMonthYear } from '../lib/dateFormat';
import { cachedGet, invalidateByTag, isCached } from '../lib/queryCache';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirmDialog';
import { SkeletonDetailHeader, SkeletonStatRow, SkeletonTable, SkeletonInfoCard } from '../components/Skeleton';
import { formatCurrency } from '../lib/format';
import FieldError from '../components/FieldError';
import DatePicker from '../components/DatePicker';
import ReceiptModal from '../components/ReceiptModal';
import { buildRentReceipt, buildUtilityBillReceipt, type ReceiptData } from '../lib/receipt';
import { isBlank, isPositiveNumber, isNonNegativeNumber, requiredMsg, type FieldErrors } from '../lib/validation';

const unitTypeLabels: Record<string, string> = {
  single_room: 'Single Room',
  '1rk': '1RK',
  '1bhk': '1BHK',
  '2bhk': '2BHK',
  '3bhk': '3BHK',
  shop: 'Shop',
  office: 'Office',
  warehouse: 'Warehouse',
  other: 'Other'
};

const formatUnitStatus = (status: string) => {
  if (status === 'maintenance') return 'Under Repair';
  if (status === 'occupied') return 'Occupied';
  return 'Vacant';
};

const unitStatusTone = (status: string): BadgeTone => {
  if (status === 'maintenance') return 'warning';
  if (status === 'occupied') return 'success';
  return 'neutral';
};

const paymentStatusTone = (status: string): BadgeTone => {
  if (status === 'paid') return 'success';
  if (status === 'partial') return 'warning';
  return 'danger';
};

const getPaymentCategory = (payment: any) => {
  if (payment.type === 'rent') return 'rent';
  if (payment.type === 'utility') return 'utility';
  if (payment.type === 'maintenance') return 'maintenance';
  if (payment.type === 'deposit' || payment.type === 'refund') return 'deposit';
  return 'other';
};

const formatPaymentType = (payment: any) => {
  if (payment.type === 'refund') return 'Deposit Refund';
  if (payment.type === 'deposit') return 'Deposit';
  if (payment.type === 'utility') return 'Utility';
  if (payment.type === 'maintenance') return 'Maintenance';
  if (payment.type === 'rent') return 'Rent';
  return payment.direction === 'out' ? 'Other (Cash Out)' : 'Other (Cash In)';
};

const buildGenericPaymentReceipt = (payment: any, propertyName: string, unitNumber?: string, propertyAddress?: string): ReceiptData => ({
  title: `${formatPaymentType(payment)} Receipt`,
  receiptNo: String(payment._id || '').slice(-8).toUpperCase(),
  propertyName,
  propertyAddress,
  tenantName: payment.tenantId?.fullName,
  unitNumber,
  amountLabel: payment.direction === 'out' ? 'Amount Paid Out' : 'Amount',
  amount: payment.amount || 0,
  date: formatDate(payment.date),
  items: [
    { label: 'Type', value: formatPaymentType(payment) },
    { label: 'Date', value: formatDate(payment.date) },
    ...(payment.tenantId?.depositAmount != null
      ? [{ label: 'Total Deposit Required', value: `₹${formatCurrency(payment.tenantId.depositAmount)}` }]
      : []),
    ...(payment.tenantId?.phone ? [{ label: 'Tenant Phone', value: payment.tenantId.phone }] : []),
    { label: 'Notes', value: payment.notes || '-' }
  ]
});

const UnitDetails = () => {
  const { propertyId, unitId } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [rentRecords, setRentRecords] = useState<any[]>([]);
  const [utilityBills, setUtilityBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showTenantHistory, setShowTenantHistory] = useState(false);
  const [recordsTab, setRecordsTab] = useState<'payments' | 'rentRecords' | 'utilityBills' | 'maintenance' | 'others'>('payments');
  const [collectRentRecord, setCollectRentRecord] = useState<any>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectSaving, setCollectSaving] = useState(false);
  const [utilitySavingId, setUtilitySavingId] = useState<string | null>(null);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [form, setForm] = useState({
    unitNumber: '',
    unitType: '1bhk',
    floor: '',
    size: '',
    activeSince: '',
    monthlyRent: '',
    deposit: '',
    lastMeterReading: ''
  });
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [collectError, setCollectError] = useState<string | undefined>();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const load = async (options?: { force?: boolean }) => {
    if (!propertyId || !unitId) return;
    if (options?.force) {
      invalidateByTag('property', propertyId);
      invalidateByTag('unitDetails', propertyId);
    }
    const allCached = isCached(`/properties/${propertyId}`) && isCached(`/properties/${propertyId}/units/${unitId}/details`);
    if (!allCached) setLoading(true);
    try {
      const [propertyData, unitData] = await Promise.all([
        cachedGet(`/properties/${propertyId}`),
        cachedGet(`/properties/${propertyId}/units/${unitId}/details`)
      ]);
      setProperty(propertyData);
      setUnit(unitData.unit);
      setTenants(unitData.tenants || []);
      setPayments(unitData.payments || []);
      setRentRecords(unitData.rentRecords || []);
      setUtilityBills(unitData.utilityBills || []);
      setForm({
        unitNumber: unitData.unit.unitNumber || '',
        unitType: unitData.unit.unitType || '1bhk',
        floor: unitData.unit.floor || '',
        size: unitData.unit.size || '',
        activeSince: unitData.unit.activeSince ? String(unitData.unit.activeSince).slice(0, 10) : '',
        monthlyRent: String(unitData.unit.monthlyRent ?? ''),
        deposit: String(unitData.unit.deposit ?? ''),
        lastMeterReading: String(unitData.unit.lastMeterReading ?? '')
      });
    } finally {
      setLoading(false);
    }
  };

  const scopeKey = `${propertyId}::${unitId}`;
  const [renderedScopeKey, setRenderedScopeKey] = useState(scopeKey);
  if (scopeKey !== renderedScopeKey) {
    setRenderedScopeKey(scopeKey);
    setUnit(null);
    setLoading(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, unitId]);

  const refresh = async () => {
    if (!propertyId || !unitId) return;
    invalidateByTag('unitDetails', propertyId);
    const data = await cachedGet(`/properties/${propertyId}/units/${unitId}/details`);
    setUnit(data.unit);
    setTenants(data.tenants || []);
    setPayments(data.payments || []);
    setRentRecords(data.rentRecords || []);
    setUtilityBills(data.utilityBills || []);
  };

  const collectRent = async () => {
    if (!collectRentRecord || !propertyId) return;
    const amount = Number(collectAmount);
    const remaining = Math.max(0, (collectRentRecord.rentAmount || 0) - (collectRentRecord.paidAmount || 0));
    if (!amount || amount <= 0) {
      setCollectError('Enter an amount greater than 0');
      return;
    }
    if (amount > remaining) {
      setCollectError('Cannot exceed remaining rent');
      return;
    }
    setCollectError(undefined);
    setCollectSaving(true);
    try {
      await api.post(`/properties/${propertyId}/rent-records/${collectRentRecord._id}/collect`, {
        amount,
        paymentMode: 'cash'
      });
      setCollectRentRecord(null);
      setCollectAmount('');
      await refresh();
      toast.success('Rent collected.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to collect rent.');
    } finally {
      setCollectSaving(false);
    }
  };

  const markUtilityBillPaid = async (bill: any) => {
    if (!propertyId) return;
    setUtilitySavingId(bill._id);
    try {
      await api.patch(`/properties/${propertyId}/utility-bills/${bill._id}`, { status: 'paid' });
      await refresh();
      toast.success('Utility bill marked paid.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update utility bill.');
    } finally {
      setUtilitySavingId(null);
    }
  };

  const collectMaintenance = async () => {
    if (!propertyId || !unit?.currentTenant?._id) return;
    setMaintenanceSaving(true);
    try {
      const now = new Date();
      await api.post(`/properties/${propertyId}/payments`, {
        type: 'maintenance',
        amount: property?.maintenanceCharge || 0,
        date: now.toISOString(),
        unitId: unit._id,
        tenantId: unit.currentTenant._id,
        notes: `Maintenance collected for ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      });
      await refresh();
      toast.success('Maintenance collected.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to collect maintenance.');
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const validateForm = () => {
    const next: FieldErrors = {};
    if (isBlank(form.unitNumber)) next.unitNumber = requiredMsg('Unit number');
    if (!isPositiveNumber(form.monthlyRent)) next.monthlyRent = 'Monthly rent must be greater than 0';
    if (!isNonNegativeNumber(form.deposit)) next.deposit = 'Deposit must be a valid amount';
    setFormErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const saveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !unitId) return;
    if (!validateForm()) return;
    setLoading(true);
    try {
      await api.patch(`/properties/${propertyId}/units/${unitId}`, {
        unitNumber: form.unitNumber,
        unitType: form.unitType,
        floor: form.floor || undefined,
        size: form.size || undefined,
        activeSince: form.activeSince || undefined,
        monthlyRent: Number(form.monthlyRent),
        deposit: Number(form.deposit),
        lastMeterReading: form.lastMeterReading ? Number(form.lastMeterReading) : undefined
      });
      await load({ force: true });
      setShowEdit(false);
      toast.success('Unit updated.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update unit.');
    } finally {
      setLoading(false);
    }
  };

  const deleteUnit = async () => {
    if (!propertyId || !unitId || !unit?.unitNumber) return;
    if (unit.currentTenant) {
      toast.error('Cannot deactivate a unit with an active tenant. Move the tenant out first.');
      return;
    }
    const ok = await confirmDialog({
      title: `Mark unit "${unit.unitNumber}" as inactive?`,
      description: 'This will hide it from active lists. You can restore it later.',
      confirmLabel: 'Deactivate',
      danger: true
    });
    if (!ok) return;
    setLoading(true);
    try {
      await api.delete(`/properties/${propertyId}/units/${unitId}`);
      invalidateByTag('unit', propertyId);
      navigate(`/properties/${propertyId}`);
      toast.success('Unit marked inactive.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update unit.');
    } finally {
      setLoading(false);
    }
  };

  const removeTenant = async () => {
    if (!propertyId || !unit?.currentTenant?._id) return;
    const ok = await confirmDialog({
      title: `Move "${unit.currentTenant.fullName}" out?`,
      description: 'This moves them out of the active tenant list.',
      confirmLabel: 'Move Out',
      danger: true
    });
    if (!ok) return;
    setLoading(true);
    try {
      await api.patch(`/properties/${propertyId}/tenants/${unit.currentTenant._id}/move-out`);
      await refresh();
      toast.success('Tenant moved out.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update tenant.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMaintenance = async () => {
    if (!propertyId || !unitId) return;
    const turningOn = !unit.maintenanceMode;
    if (turningOn && unit.currentTenant) {
      toast.error('Cannot turn on repair mode while a tenant is living in this unit. Move the tenant out first.');
      return;
    }
    const ok = await confirmDialog({
      title: turningOn ? 'Turn on repair mode for this unit?' : 'Turn off repair mode for this unit?',
      description: turningOn
        ? 'This marks the unit as under repair and blocks new tenant assignment until it is turned off.'
        : 'This makes the unit available for tenant assignment again.',
      confirmLabel: turningOn ? 'Turn On' : 'Turn Off',
      danger: turningOn
    });
    if (!ok) return;
    setLoading(true);
    try {
      const response = await api.patch(`/properties/${propertyId}/units/${unitId}`, {
        maintenanceMode: !unit.maintenanceMode
      });
      await load({ force: true });
      toast.success(response.data.maintenanceMode ? 'Repair mode turned on.' : 'Repair mode turned off.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update repair mode.');
    } finally {
      setLoading(false);
    }
  };

  if (!unit && loading) {
    return (
      <div className="space-y-6">
        <SkeletonDetailHeader actions={4} />
        <SkeletonStatRow count={4} />
        <SkeletonInfoCard fields={4} actions={3} />
        <SkeletonTable columns={5} rows={5} tabCount={5} />
      </div>
    );
  }

  if (!unit) {
    return <div className="text-sm text-[var(--muted)]">Unit not found.</div>;
  }

  const currentTenantPayments = payments.filter(
    (payment) => unit.currentTenant?._id && String(payment.tenantId) === String(unit.currentTenant._id)
  );
  const depositPaid = currentTenantPayments.reduce((sum, payment) => {
    if (payment.type === 'deposit') return sum + (payment.amount || 0);
    if (payment.type === 'refund') return sum - (payment.amount || 0);
    return sum;
  }, 0);
  const depositRemaining = Math.max(0, (unit.deposit || 0) - depositPaid);
  const maintenancePayments = payments.filter((payment) => getPaymentCategory(payment) === 'maintenance');
  const otherPayments = payments.filter((payment) => getPaymentCategory(payment) === 'deposit' || getPaymentCategory(payment) === 'other');

  const rentDue = rentRecords
    .filter((record) => record.status !== 'paid')
    .reduce((sum, record) => sum + Math.max(0, (record.rentAmount || 0) - (record.paidAmount || 0)), 0);

  const unitUtilityDue = utilityBills
    .filter((bill) => bill.status !== 'paid')
    .reduce((sum, bill) => sum + (bill.amount || 0), 0);

  const nowForDues = new Date();
  const maintenanceCollectedThisMonth = payments.some((payment) => {
    if (payment.type !== 'maintenance' || !/maintenance collected/i.test(String(payment.notes || ''))) return false;
    const paymentDate = new Date(payment.date);
    return paymentDate.getMonth() === nowForDues.getMonth() && paymentDate.getFullYear() === nowForDues.getFullYear();
  });
  const unitMaintenanceDue =
    unit.currentTenant && (property?.maintenanceCharge || 0) > 0 && !maintenanceCollectedThisMonth
      ? property.maintenanceCharge
      : 0;
  const currentMonthKey = `${nowForDues.getFullYear()}-${String(nowForDues.getMonth() + 1).padStart(2, '0')}`;
  const maintenanceRows = [
    ...(unitMaintenanceDue > 0
      ? [
          {
            _id: 'maintenance-due-current',
            _isDue: true,
            amount: unitMaintenanceDue,
            date: nowForDues.toISOString(),
            notes: `Maintenance due for ${formatMonthKey(currentMonthKey)}`
          }
        ]
      : []),
    ...maintenancePayments
  ];

  const oldestUnpaidRentRecord = rentRecords
    .filter((record) => record.status !== 'paid')
    .sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month))[0];

  const oldestUnpaidUtilityBill = utilityBills
    .filter((bill) => bill.status !== 'paid')
    .sort((a, b) => String(a.month).localeCompare(String(b.month)))[0];

  const dueAlerts = [
    unit.currentTenant && depositRemaining > 0
      ? { key: 'deposit', label: `₹${formatCurrency(depositRemaining)} deposit due`, actionLabel: 'Pay', onAction: () => setShowDepositModal(true) }
      : null,
    rentDue > 0 && oldestUnpaidRentRecord
      ? {
          key: 'rent',
          label: `₹${formatCurrency(rentDue)} rent due`,
          actionLabel: 'Pay',
          onAction: () => {
            setRecordsTab('rentRecords');
            setCollectRentRecord(oldestUnpaidRentRecord);
            setCollectAmount(String(Math.max(0, (oldestUnpaidRentRecord.rentAmount || 0) - (oldestUnpaidRentRecord.paidAmount || 0))));
            setCollectError(undefined);
          }
        }
      : null,
    unitUtilityDue > 0 && oldestUnpaidUtilityBill
      ? {
          key: 'utility',
          label: `₹${formatCurrency(unitUtilityDue)} utility due`,
          actionLabel: 'Pay',
          onAction: () => {
            setRecordsTab('utilityBills');
            markUtilityBillPaid(oldestUnpaidUtilityBill);
          }
        }
      : null,
    unitMaintenanceDue > 0
      ? {
          key: 'maintenance',
          label: `₹${formatCurrency(unitMaintenanceDue)} maintenance due`,
          actionLabel: 'Pay',
          onAction: () => {
            setRecordsTab('maintenance');
            collectMaintenance();
          }
        }
      : null
  ].filter((alert): alert is { key: string; label: string; actionLabel: string; onAction: () => void } => Boolean(alert));

  const paymentColumns: TableColumn<any>[] = [
    { key: 'type', label: 'Type', accessor: (payment) => formatPaymentType(payment) },
    { key: 'amount', label: 'Amount', accessor: (payment) => payment.amount, render: (payment) => `₹${formatCurrency(payment.amount)}` },
    { key: 'date', label: 'Date', accessor: (payment) => new Date(payment.date).getTime(), render: (payment) => formatDate(payment.date) },
    { key: 'notes', label: 'Notes', accessor: (payment) => payment.notes || '-' },
    { key: 'status', label: 'Status', sortable: false, render: () => <Badge tone="success">Paid</Badge> },
    {
      key: 'view',
      label: '',
      sortable: false,
      render: (payment) => (
        <button
          type="button"
          className="icon-btn h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            setReceipt(buildGenericPaymentReceipt(payment, property?.name || '-', unit?.unitNumber, property?.address));
          }}
          title="View Receipt"
        >
          <EyeIcon width={15} height={15} />
        </button>
      )
    }
  ];

  const maintenanceColumns: TableColumn<any>[] = [
    { key: 'amount', label: 'Amount', accessor: (row) => row.amount, render: (row) => `₹${formatCurrency(row.amount)}` },
    { key: 'date', label: 'Date', accessor: (row) => new Date(row.date).getTime(), render: (row) => formatDate(row.date) },
    { key: 'notes', label: 'Notes', accessor: (row) => row.notes || '-' },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (row) => <Badge tone={row._isDue ? 'danger' : 'success'}>{row._isDue ? 'Due' : 'Paid'}</Badge>
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) =>
        row._isDue ? (
          <button className="btn btn-sm btn-success" disabled={maintenanceSaving} onClick={collectMaintenance}>
            {maintenanceSaving ? 'Saving...' : 'Pay'}
          </button>
        ) : (
          <button
            type="button"
            className="icon-btn h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setReceipt(buildGenericPaymentReceipt(row, property?.name || '-', unit?.unitNumber, property?.address));
            }}
            title="View Receipt"
          >
            <EyeIcon width={15} height={15} />
          </button>
        )
    }
  ];

  const rentRecordColumns: TableColumn<any>[] = [
    { key: 'month', label: 'Month', accessor: (record) => record.year * 100 + record.month, render: (record) => formatMonthYear(record.month, record.year) },
    { key: 'amount', label: 'Amount', accessor: (record) => record.rentAmount, render: (record) => `₹${formatCurrency(record.rentAmount)}` },
    {
      key: 'status',
      label: 'Status',
      accessor: (record) => record.status,
      filterOptions: [
        { value: 'paid', label: 'Paid' },
        { value: 'partial', label: 'Partial' },
        { value: 'unpaid', label: 'Unpaid' }
      ],
      render: (record) => <Badge tone={paymentStatusTone(record.status)}>{record.status}</Badge>
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (record) => (
        <div className="flex items-center gap-1.5">
          {record.status !== 'paid' && (
            <button
              className="btn btn-sm btn-success"
              onClick={() => {
                setCollectRentRecord(record);
                setCollectAmount(String(Math.max(0, (record.rentAmount || 0) - (record.paidAmount || 0))));
                setCollectError(undefined);
              }}
            >
              Pay
            </button>
          )}
          {(record.paidAmount || 0) > 0 && (
            <button
              type="button"
              className="icon-btn h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                setReceipt(buildRentReceipt(record, property?.name || '-', property?.address));
              }}
              title="View Receipt"
            >
              <EyeIcon width={15} height={15} />
            </button>
          )}
          {record.status === 'paid' && !(record.paidAmount > 0) && <span className="text-xs text-[var(--muted)]">-</span>}
        </div>
      )
    }
  ];

  const tenantHistoryColumns: TableColumn<any>[] = [
    { key: 'fullName', label: 'Name', accessor: (tenant) => tenant.fullName },
    { key: 'phone', label: 'Phone', accessor: (tenant) => tenant.phone },
    { key: 'email', label: 'Email', accessor: (tenant) => tenant.email || '-' },
    {
      key: 'movedInDate',
      label: 'In',
      accessor: (tenant) => new Date(tenant.movedInDate || tenant.createdAt).getTime(),
      render: (tenant) => formatDate(tenant.movedInDate || tenant.createdAt)
    },
    {
      key: 'movedOutDate',
      label: 'Out',
      accessor: (tenant) => (tenant.movedOutDate ? new Date(tenant.movedOutDate).getTime() : null),
      render: (tenant) => formatDate(tenant.movedOutDate)
    },
    {
      key: 'status',
      label: 'Status',
      accessor: (tenant) => (tenant.isActive ? 'Active' : 'Moved Out'),
      filterOptions: [
        { value: 'Active', label: 'Active' },
        { value: 'Moved Out', label: 'Moved Out' }
      ],
      render: (tenant) => <Badge tone={tenant.isActive ? 'success' : 'neutral'}>{tenant.isActive ? 'Active' : 'Moved Out'}</Badge>
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (tenant) => (
        <button
          className="btn btn-sm btn-info"
          onClick={() => navigate(`/properties/${propertyId}/tenants/${tenant._id}`)}
        >
          View
        </button>
      )
    }
  ];

  const utilityBillColumns: TableColumn<any>[] = [
    { key: 'billType', label: 'Type', accessor: (bill) => bill.billType },
    { key: 'month', label: 'Month', accessor: (bill) => bill.month, render: (bill) => formatMonthKey(bill.month) },
    { key: 'units', label: 'Units', accessor: (bill) => bill.unitsConsumed },
    { key: 'amount', label: 'Amount', accessor: (bill) => bill.amount, render: (bill) => `₹${formatCurrency(bill.amount)}` },
    {
      key: 'status',
      label: 'Status',
      accessor: (bill) => bill.status,
      filterOptions: [
        { value: 'paid', label: 'Paid' },
        { value: 'partial', label: 'Partial' },
        { value: 'unpaid', label: 'Unpaid' }
      ],
      render: (bill) => <Badge tone={paymentStatusTone(bill.status)}>{bill.status}</Badge>
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (bill) => (
        <div className="flex items-center gap-1.5">
          {bill.status !== 'paid' && (
            <button
              className="btn btn-sm btn-success"
              disabled={utilitySavingId === bill._id}
              onClick={() => markUtilityBillPaid(bill)}
            >
              {utilitySavingId === bill._id ? 'Saving...' : 'Pay'}
            </button>
          )}
          <button
            type="button"
            className="icon-btn h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setReceipt(buildUtilityBillReceipt(bill, property?.name || '-', property?.address));
            }}
            title="View Receipt"
          >
            <EyeIcon width={15} height={15} />
          </button>
        </div>
      )
    }
  ];

  const recordsTabBar = (
    [
      { key: 'payments', label: 'Payments' },
      { key: 'rentRecords', label: 'Rent Records' },
      { key: 'utilityBills', label: 'Utility Bills' },
      { key: 'maintenance', label: 'Maintenance' },
      { key: 'others', label: 'Others' }
    ] as const
  ).map((tab) => (
    <button
      key={tab.key}
      className={`px-4 py-2 rounded-full text-sm border ${
        recordsTab === tab.key
          ? 'bg-[var(--accent)] text-white border-transparent'
          : 'border-black/10 text-[var(--muted)]'
      }`}
      onClick={() => setRecordsTab(tab.key)}
    >
      {tab.label}
    </button>
  ));

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold">Unit {unit.unitNumber}</span>
              {property?.name && <span className="text-sm font-normal text-[var(--muted)]">{property.name}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-[var(--text)]">
                {unitTypeLabels[unit.unitType] || unit.unitType}
              </span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-slate-600">
                Floor {unit.floor || '-'}
              </span>
              {unit.size && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-slate-600">
                  {unit.size} sq ft
                </span>
              )}
              {unit.activeSince && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-slate-600">
                  Active since {formatDate(unit.activeSince, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
              <Badge tone={unitStatusTone(unit.status)}>{formatUnitStatus(unit.status)}</Badge>
            </div>
            {unit.maintenanceMode && unit.maintenanceUntil && (
              <div className="text-xs text-[var(--muted)] mt-1">
                Under repair until {formatDate(unit.maintenanceUntil)}
              </div>
            )}
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <button
                className={`btn ${unit.maintenanceMode ? 'btn-maintenance-active' : 'btn-maintenance'}`}
                onClick={toggleMaintenance}
                disabled={!unit.maintenanceMode && Boolean(unit.currentTenant)}
                title={!unit.maintenanceMode && unit.currentTenant ? 'Move the tenant out before turning on repair mode.' : undefined}
              >
                {unit.maintenanceMode ? 'Turn Off Repair Mode' : 'Turn On Repair Mode'}
              </button>
              <button
                className="btn btn-info"
                onClick={() => navigate(`/properties/${propertyId}`)}
              >
                View Property
              </button>
              <button
                className="btn btn-warning"
                onClick={() => {
                  setFormErrors({});
                  setShowEdit(true);
                }}
              >
                Edit
              </button>
              <button
                className="btn btn-danger"
                onClick={deleteUnit}
                disabled={Boolean(unit.currentTenant)}
                title={unit.currentTenant ? 'Move the tenant out before deactivating this unit.' : undefined}
              >
                Deactivate
              </button>
            </div>
            {dueAlerts.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                {dueAlerts.map((alert) => (
                  <div key={alert.key} className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 pl-3 pr-1.5 py-1.5">
                    <AlertTriangleIcon width={13} height={13} className="text-amber-600 shrink-0" />
                    <span className="text-xs font-medium text-amber-700 whitespace-nowrap">{alert.label}</span>
                    <button
                      className="btn btn-sm btn-success !py-1"
                      onClick={alert.onAction}
                    >
                      {alert.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Monthly Rent" value={`₹${formatCurrency(unit.monthlyRent)}`} icon={<TransactionsIcon width={18} height={18} />} />
        <StatCard label="Deposit" value={`₹${formatCurrency(unit.deposit)}`} icon={<ShieldIcon width={18} height={18} />} />
        <StatCard
          label="Deposit Paid"
          value={`₹${formatCurrency(depositPaid)}`}
          subLabel={`₹${formatCurrency(depositRemaining)} remaining`}
          tone={depositRemaining > 0 ? 'warning' : 'success'}
          icon={<ShieldIcon width={18} height={18} />}
        />
        <StatCard
          label="Meter Reading"
          value={unit.lastMeterReading ?? 0}
          subLabel={
            <>
              Last read <span className="font-semibold text-[var(--text)]">{formatDate(unit.lastMeterReadingDate)}</span>
            </>
          }
          icon={<UtilitiesIcon width={18} height={18} />}
        />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">Current Tenant</div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setShowTenantHistory(true)}
            >
              Show History
            </button>
            {unit.currentTenant ? (
              <>
                <button
                  className="btn btn-sm btn-info"
                  onClick={() => navigate(`/properties/${propertyId}/tenants/${unit.currentTenant._id}`)}
                >
                  View
                </button>
                {depositRemaining > 0 && (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => setShowDepositModal(true)}
                  >
                    Pay Remaining Deposit
                  </button>
                )}
                <button
                  className="btn btn-sm btn-danger"
                  onClick={removeTenant}
                >
                  Move Out
                </button>
              </>
            ) : (
              unit.maintenanceMode ? (
                <span className="text-xs text-[var(--muted)]">Turn off repair mode to assign tenant</span>
              ) : (
                <button
                  className="btn btn-sm btn-success"
                  onClick={() => setShowTenantModal(true)}
                >
                  Assign Tenant
                </button>
              )
            )}
          </div>
        </div>
        {unit.currentTenant ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Name</div>
              <div className="font-medium">{unit.currentTenant.fullName}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Phone</div>
              <div className="font-medium">{unit.currentTenant.phone}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Email</div>
              <div className="font-medium">{unit.currentTenant.email || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--muted)] uppercase tracking-wide">In</div>
              <div className="font-medium">{formatDate(unit.currentTenant.movedInDate || unit.currentTenant.createdAt)}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-[var(--muted)]">No active tenant.</div>
        )}
      </div>

      {showTenantHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">Tenant History</div>
              <button className="modal-close-btn" onClick={() => setShowTenantHistory(false)} aria-label="Close">
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <SortableTable
              columns={tenantHistoryColumns}
              data={tenants}
              rowKey={(tenant) => tenant._id}
              searchPlaceholder="Search tenant history by name, phone, email..."
              emptyIcon={<TenantsIcon width={22} height={22} />}
              emptyTitle="No tenant history"
            />
          </div>
        </div>
      )}

      <div>
        {recordsTab === 'payments' && (
          <SortableTable
            columns={paymentColumns}
            data={payments}
            rowKey={(payment) => payment._id}
            tabs={recordsTabBar}
            searchPlaceholder="Search payments by type, notes..."
            emptyIcon={<TransactionsIcon width={22} height={22} />}
            emptyTitle="No payments yet"
          />
        )}
        {recordsTab === 'rentRecords' && (
          <SortableTable
            columns={rentRecordColumns}
            data={rentRecords}
            rowKey={(record) => record._id}
            tabs={recordsTabBar}
            searchPlaceholder="Search rent records..."
            emptyIcon={<TransactionsIcon width={22} height={22} />}
            emptyTitle="No rent records yet"
          />
        )}
        {recordsTab === 'utilityBills' && (
          <SortableTable
            columns={utilityBillColumns}
            data={utilityBills}
            rowKey={(bill) => bill._id}
            tabs={recordsTabBar}
            searchPlaceholder="Search utility bills..."
            emptyIcon={<TransactionsIcon width={22} height={22} />}
            emptyTitle="No utility bills yet"
          />
        )}
        {recordsTab === 'maintenance' && (
          <SortableTable
            columns={maintenanceColumns}
            data={maintenanceRows}
            rowKey={(row) => row._id}
            tabs={recordsTabBar}
            searchPlaceholder="Search maintenance..."
            emptyIcon={<TransactionsIcon width={22} height={22} />}
            emptyTitle="No maintenance records yet"
          />
        )}
        {recordsTab === 'others' && (
          <SortableTable
            columns={paymentColumns}
            data={otherPayments}
            rowKey={(payment) => payment._id}
            tabs={recordsTabBar}
            searchPlaceholder="Search other payments..."
            emptyIcon={<TransactionsIcon width={22} height={22} />}
            emptyTitle="No other payments yet"
          />
        )}
      </div>

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">Edit Unit</div>
              <button
                className="modal-close-btn"
                onClick={() => {
                  setFormErrors({});
                  setShowEdit(false);
                }}
                aria-label="Close"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <form onSubmit={saveUnit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">Unit Number</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${formErrors.unitNumber ? 'input-error' : ''}`}
                    placeholder="Unit number"
                    value={form.unitNumber}
                    onChange={(e) => updateField('unitNumber', e.target.value)}
                  />
                  <FieldError message={formErrors.unitNumber} />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Unit Type</label>
                  <select
                    className="w-full px-3 py-2 mt-1"
                    value={form.unitType}
                    onChange={(e) => updateField('unitType', e.target.value)}
                  >
                    {Object.entries(unitTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Floor</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Floor"
                    value={form.floor}
                    onChange={(e) => updateField('floor', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Size in sq ft</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="e.g. 850"
                    value={form.size}
                    onChange={(e) => updateField('size', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Active Since (Optional)</label>
                  <DatePicker
                    className="w-full px-3 py-2 mt-1 rounded-xl border border-black/10"
                    value={form.activeSince}
                    onChange={(next) => updateField('activeSince', next)}
                  />
                </div>
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">Monthly Rent</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${formErrors.monthlyRent ? 'input-error' : ''}`}
                    placeholder="Monthly rent"
                    value={form.monthlyRent}
                    onChange={(e) => updateField('monthlyRent', e.target.value)}
                  />
                  <FieldError message={formErrors.monthlyRent} />
                </div>
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">Deposit</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${formErrors.deposit ? 'input-error' : ''}`}
                    placeholder="Deposit"
                    value={form.deposit}
                    onChange={(e) => updateField('deposit', e.target.value)}
                  />
                  <FieldError message={formErrors.deposit} />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Last Meter Reading</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Meter reading"
                    value={form.lastMeterReading}
                    onChange={(e) => updateField('lastMeterReading', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="btn btn-cancel"
                  onClick={() => {
                    setFormErrors({});
                    setShowEdit(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TenantFormModal
        open={showTenantModal}
        onClose={() => setShowTenantModal(false)}
        propertyId={propertyId || ''}
        assignedUnitId={unit._id}
        assignedUnitLabel={unit.unitNumber}
        onSaved={refresh}
      />
      {unit.currentTenant && (
        <DepositPaymentModal
          open={showDepositModal}
          onClose={() => setShowDepositModal(false)}
          propertyId={propertyId || ''}
          tenantId={unit.currentTenant._id}
          unitId={unit._id}
          tenantName={unit.currentTenant.fullName}
          requiredDeposit={unit.deposit || 0}
          paidDeposit={depositPaid}
          onSaved={refresh}
        />
      )}

      {collectRentRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="w-full max-w-md bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-lg font-semibold">Collect Rent</div>
                <div className="text-sm text-[var(--muted)]">{formatMonthYear(collectRentRecord.month, collectRentRecord.year)}</div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => {
                  setCollectError(undefined);
                  setCollectRentRecord(null);
                }}
                disabled={collectSaving}
                aria-label="Close"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <div className="relative">
              <label className="text-xs text-[var(--muted)]">Amount Received</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={`mt-1 w-full px-3 py-2 ${collectError ? 'input-error' : ''}`}
                value={collectAmount}
                onChange={(e) => {
                  setCollectAmount(e.target.value);
                  setCollectError(undefined);
                }}
                autoFocus
              />
              <FieldError message={collectError} />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button className="btn btn-primary" disabled={collectSaving} onClick={collectRent}>
                {collectSaving ? 'Saving...' : 'Collect'}
              </button>
              <button
                className="btn btn-cancel"
                disabled={collectSaving}
                onClick={() => {
                  setCollectError(undefined);
                  setCollectRentRecord(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
};

export default UnitDetails;
