import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import DepositPaymentModal from '../components/DepositPaymentModal';
import Badge, { type BadgeTone } from '../components/Badge';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { AlertTriangleIcon, CloseIcon, EyeIcon, EyeOffIcon, ShieldIcon, TransactionsIcon, UserIcon } from '../components/icons';
import { formatDate, formatMonthKey, formatMonthYear, getCurrentDateValue, getCurrentMonthValue } from '../lib/dateFormat';
import { cachedGet, invalidateByTag, isCached } from '../lib/queryCache';
import { SkeletonDetailHeader, SkeletonStatRow, SkeletonTable } from '../components/Skeleton';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirmDialog';
import { formatCurrency } from '../lib/format';

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

const maskIdProofNumber = (value?: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length <= 4) return trimmed;
  const hiddenCount = trimmed.length - 4;
  return `${'•'.repeat(hiddenCount)} ${trimmed.slice(-4)}`;
};

const formatPaymentType = (payment: any) => {
  if (payment.type === 'refund') return 'Deposit Refund';
  if (payment.type === 'deposit') return 'Deposit';
  if (payment.type === 'utility') return 'Utility';
  if (payment.type === 'maintenance') return 'Maintenance';
  if (payment.type === 'rent') return 'Rent';
  return payment.direction === 'out' ? 'Other (Cash Out)' : 'Other (Cash In)';
};

const TenantDetails = () => {
  const { propertyId, tenantId } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [rentRecords, setRentRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [recordsTab, setRecordsTab] = useState<'payments' | 'rentRecords' | 'utility' | 'maintenance' | 'others'>('payments');
  const [utilityBills, setUtilityBills] = useState<any[]>([]);
  const [maintenanceCharge, setMaintenanceCharge] = useState(0);
  const [showIdProof, setShowIdProof] = useState(false);
  const [collectRentRecord, setCollectRentRecord] = useState<any>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectSaving, setCollectSaving] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [utilitySavingId, setUtilitySavingId] = useState<string | null>(null);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [addPaymentSaving, setAddPaymentSaving] = useState(false);
  const [addPaymentForm, setAddPaymentForm] = useState({
    type: 'rent' as 'rent' | 'utility' | 'maintenance' | 'deposit' | 'refund' | 'other',
    month: getCurrentMonthValue(),
    amount: '',
    date: getCurrentDateValue(),
    paymentMode: 'cash',
    notes: '',
    direction: 'in' as 'in' | 'out'
  });
  const [showEditTenant, setShowEditTenant] = useState(false);
  const [editTenantSaving, setEditTenantSaving] = useState(false);
  const [editTenantForm, setEditTenantForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    idProofType: '',
    idProofNumber: '',
    emergencyContact: ''
  });

  const load = async (options?: { force?: boolean }) => {
    if (!propertyId || !tenantId) return;
    if (options?.force) invalidateByTag('tenantDetails', propertyId);
    if (!isCached(`/properties/${propertyId}/tenants/${tenantId}/details`)) setLoading(true);
    try {
      const data = await cachedGet(`/properties/${propertyId}/tenants/${tenantId}/details`);
      setTenant(data.tenant);
      setPayments(data.payments || []);
      setRentRecords(data.rentRecords || []);
    } finally {
      setLoading(false);
    }
  };

  const loadDueExtras = async (options?: { force?: boolean }) => {
    if (!propertyId || !tenant) return;
    const unitId = tenant.assignedUnit?._id;
    if (options?.force && unitId) invalidateByTag('utilityBill', propertyId);
    const [bills, propertyData] = await Promise.all([
      unitId ? cachedGet(`/properties/${propertyId}/utility-bills`, { unitId }) : Promise.resolve([]),
      cachedGet(`/properties/${propertyId}`)
    ]);
    setUtilityBills(bills || []);
    setMaintenanceCharge(propertyData?.maintenanceCharge || 0);
  };

  useEffect(() => {
    loadDueExtras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, tenant?._id, tenant?.assignedUnit?._id]);

  const scopeKey = `${propertyId}::${tenantId}`;
  const [renderedScopeKey, setRenderedScopeKey] = useState(scopeKey);
  if (scopeKey !== renderedScopeKey) {
    setRenderedScopeKey(scopeKey);
    setTenant(null);
    setLoading(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, tenantId]);

  if (!tenant && loading) {
    return (
      <div className="space-y-6">
        <SkeletonDetailHeader avatar actions={4} fields={6} />
        <SkeletonStatRow count={3} />
        <SkeletonTable columns={5} rows={5} tabCount={5} />
      </div>
    );
  }

  if (!tenant) {
    return <div className="text-sm text-[var(--muted)]">Tenant not found.</div>;
  }

  const depositPaid = payments.reduce((sum, payment) => {
    if (payment.type === 'deposit') return sum + (payment.amount || 0);
    if (payment.type === 'refund') return sum - (payment.amount || 0);
    return sum;
  }, 0);
  const depositRemaining = Math.max(0, (tenant.depositAmount || 0) - depositPaid);
  const maintenancePayments = payments.filter((payment) => getPaymentCategory(payment) === 'maintenance');
  const otherPayments = payments.filter((payment) => getPaymentCategory(payment) === 'deposit' || getPaymentCategory(payment) === 'other');

  const rentDue = rentRecords
    .filter((record) => record.status !== 'paid')
    .reduce((sum, record) => sum + Math.max(0, (record.rentAmount || 0) - (record.paidAmount || 0)), 0);

  const utilityDue = utilityBills
    .filter((bill) => bill.status !== 'paid')
    .reduce((sum, bill) => sum + (bill.amount || 0), 0);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const maintenanceCollectedThisMonth = payments.some((payment) => {
    if (payment.type !== 'maintenance' || !/maintenance collected/i.test(String(payment.notes || ''))) return false;
    const paymentDate = new Date(payment.date);
    return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
  });
  const maintenanceDue = tenant.isActive && maintenanceCharge > 0 && !maintenanceCollectedThisMonth ? maintenanceCharge : 0;

  const maintenanceRows = [
    ...(maintenanceDue > 0
      ? [
          {
            _id: 'maintenance-due-current',
            _isDue: true,
            amount: maintenanceDue,
            date: now.toISOString(),
            notes: `Maintenance due for ${formatMonthKey(currentMonthKey)}`
          }
        ]
      : []),
    ...maintenancePayments
  ];

  const collectRent = async () => {
    if (!collectRentRecord || !propertyId) return;
    const amount = Number(collectAmount);
    const remaining = Math.max(0, (collectRentRecord.rentAmount || 0) - (collectRentRecord.paidAmount || 0));
    if (!amount || amount <= 0 || amount > remaining) {
      toast.error('Enter an amount greater than 0 and not exceeding the remaining rent.');
      return;
    }
    setCollectSaving(true);
    try {
      await api.post(`/properties/${propertyId}/rent-records/${collectRentRecord._id}/collect`, {
        amount,
        paymentMode: 'cash'
      });
      setCollectRentRecord(null);
      setCollectAmount('');
      await load({ force: true });
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
      await loadDueExtras({ force: true });
      toast.success('Utility bill marked paid.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update utility bill.');
    } finally {
      setUtilitySavingId(null);
    }
  };

  const collectMaintenance = async () => {
    if (!propertyId || !tenant.assignedUnit?._id) return;
    setMaintenanceSaving(true);
    try {
      await api.post(`/properties/${propertyId}/payments`, {
        type: 'maintenance',
        amount: maintenanceCharge,
        date: now.toISOString(),
        unitId: tenant.assignedUnit._id,
        tenantId: tenant._id,
        notes: `Maintenance collected for ${currentMonthKey}`
      });
      await load({ force: true });
      toast.success('Maintenance collected.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to collect maintenance.');
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const submitAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !tenant) return;
    const amount = Number(addPaymentForm.amount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    setAddPaymentSaving(true);
    try {
      if (addPaymentForm.type === 'rent') {
        if (!tenant.assignedUnit?._id) {
          throw new Error('This tenant has no assigned unit.');
        }
        const [year, month] = addPaymentForm.month.split('-').map(Number);
        const existing = rentRecords.find((record) => record.month === month && record.year === year);
        if (existing) {
          const remaining = Math.max(0, (existing.rentAmount || 0) - (existing.paidAmount || 0));
          if (amount > remaining) {
            throw new Error(`Amount cannot exceed remaining rent of ₹${formatCurrency(remaining)}.`);
          }
          await api.post(`/properties/${propertyId}/rent-records/${existing._id}/collect`, {
            amount,
            paymentMode: addPaymentForm.paymentMode
          });
        } else {
          const totalRent = Number(tenant.rentAmount || 0) || amount;
          await api.post(`/properties/${propertyId}/rent-records`, {
            unitId: tenant.assignedUnit._id,
            tenantId: tenant._id,
            month,
            year,
            rentAmount: totalRent,
            paidAmount: amount,
            paymentMode: addPaymentForm.paymentMode,
            status: amount >= totalRent ? 'paid' : 'partial'
          });
        }
      } else {
        await api.post(`/properties/${propertyId}/payments`, {
          type: addPaymentForm.type,
          amount,
          date: addPaymentForm.date,
          unitId: tenant.assignedUnit?._id,
          tenantId: tenant._id,
          notes: addPaymentForm.notes || undefined,
          direction: addPaymentForm.type === 'other' ? addPaymentForm.direction : undefined
        });
      }
      setShowAddPayment(false);
      setAddPaymentForm({
        type: 'rent',
        month: getCurrentMonthValue(),
        amount: '',
        date: getCurrentDateValue(),
        paymentMode: 'cash',
        notes: '',
        direction: 'in'
      });
      await Promise.all([load({ force: true }), loadDueExtras({ force: true })]);
      toast.success('Payment recorded.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to record payment.');
    } finally {
      setAddPaymentSaving(false);
    }
  };

  const openEditTenant = () => {
    setEditTenantForm({
      fullName: tenant.fullName || '',
      phone: tenant.phone || '',
      email: tenant.email || '',
      idProofType: tenant.idProofType || '',
      idProofNumber: tenant.idProofNumber || '',
      emergencyContact: tenant.emergencyContact || ''
    });
    setShowEditTenant(true);
  };

  const updateEditTenantField = (key: string, value: string) => {
    setEditTenantForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveTenantEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !tenantId) return;
    setEditTenantSaving(true);
    try {
      await api.patch(`/properties/${propertyId}/tenants/${tenantId}`, {
        fullName: editTenantForm.fullName,
        phone: editTenantForm.phone,
        email: editTenantForm.email || undefined,
        idProofType: editTenantForm.idProofType || undefined,
        idProofNumber: editTenantForm.idProofNumber || undefined,
        emergencyContact: editTenantForm.emergencyContact || undefined
      });
      setShowEditTenant(false);
      await load({ force: true });
      toast.success('Tenant updated.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update tenant.');
    } finally {
      setEditTenantSaving(false);
    }
  };

  const moveOutTenant = async () => {
    if (!propertyId || !tenantId) return;
    const ok = await confirmDialog({
      title: `Move "${tenant.fullName}" out?`,
      description: 'This moves them out of the active tenant list.',
      confirmLabel: 'Move Out',
      danger: true
    });
    if (!ok) return;
    setLoading(true);
    try {
      await api.patch(`/properties/${propertyId}/tenants/${tenantId}/move-out`);
      await load({ force: true });
      toast.success('Tenant moved out.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update tenant.');
    } finally {
      setLoading(false);
    }
  };

  const oldestUnpaidRentRecord = rentRecords
    .filter((record) => record.status !== 'paid')
    .sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month))[0];

  const oldestUnpaidUtilityBill = utilityBills
    .filter((bill) => bill.status !== 'paid')
    .sort((a, b) => String(a.month).localeCompare(String(b.month)))[0];

  const dueAlerts = [
    tenant.isActive && depositRemaining > 0
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
          }
        }
      : null,
    utilityDue > 0 && oldestUnpaidUtilityBill
      ? {
          key: 'utility',
          label: `₹${formatCurrency(utilityDue)} utility due`,
          actionLabel: 'Pay',
          onAction: () => {
            setRecordsTab('utility');
            markUtilityBillPaid(oldestUnpaidUtilityBill);
          }
        }
      : null,
    maintenanceDue > 0
      ? {
          key: 'maintenance',
          label: `₹${formatCurrency(maintenanceDue)} maintenance due`,
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
    { key: 'status', label: 'Status', sortable: false, render: () => <Badge tone="success">Paid</Badge> }
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
      render: (record) =>
        record.status !== 'paid' ? (
          <button
            className="btn btn-sm btn-success"
            onClick={() => {
              setCollectRentRecord(record);
              setCollectAmount(String(Math.max(0, (record.rentAmount || 0) - (record.paidAmount || 0))));
            }}
          >
            Pay
          </button>
        ) : (
          <span className="text-xs text-[var(--muted)]">-</span>
        )
    }
  ];

  const utilityBillColumns: TableColumn<any>[] = [
    { key: 'billType', label: 'Type', accessor: (bill) => bill.billType },
    { key: 'month', label: 'Month', accessor: (bill) => bill.month, render: (bill) => formatMonthKey(bill.month) },
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
      render: (bill) =>
        bill.status !== 'paid' ? (
          <button
            className="btn btn-sm btn-success"
            disabled={utilitySavingId === bill._id}
            onClick={() => markUtilityBillPaid(bill)}
          >
            {utilitySavingId === bill._id ? 'Saving...' : 'Pay'}
          </button>
        ) : (
          <span className="text-xs text-[var(--muted)]">-</span>
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
          <span className="text-xs text-[var(--muted)]">-</span>
        )
    }
  ];

  const recordsTabBar = (
    [
      { key: 'payments', label: 'Payments' },
      { key: 'rentRecords', label: 'Rent Records' },
      { key: 'utility', label: 'Utility' },
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
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white shadow-[0_10px_20px_rgba(15,118,110,0.25)]">
                <UserIcon width={22} height={22} />
              </div>
              <div>
                <div className="text-xl font-semibold">{tenant.fullName}</div>
                <Badge tone={tenant.isActive ? 'success' : 'neutral'}>{tenant.isActive ? 'Active' : 'Moved Out'}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-4 text-sm">
              <div>
                <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Phone</div>
                <div className="font-medium">{tenant.phone}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Email</div>
                <div className="font-medium">{tenant.email || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Unit</div>
                <div className="font-medium">{tenant.assignedUnit?.unitNumber || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] uppercase tracking-wide">In{tenant.movedOutDate ? ' / Out' : ''}</div>
                <div className="font-medium">
                  {formatDate(tenant.movedInDate || tenant.createdAt)}
                  {tenant.movedOutDate ? ` - ${formatDate(tenant.movedOutDate)}` : ''}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] uppercase tracking-wide">ID Proof</div>
                <div className="font-medium flex items-center gap-2 whitespace-nowrap">
                  {tenant.idProofType && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
                      {tenant.idProofType}
                    </span>
                  )}
                  <span className="font-mono tracking-wider">
                    {tenant.idProofNumber ? (showIdProof ? tenant.idProofNumber : maskIdProofNumber(tenant.idProofNumber)) : (!tenant.idProofType ? '-' : '')}
                  </span>
                  {tenant.idProofNumber && (
                    <button
                      type="button"
                      className="text-[var(--muted)] hover:text-[var(--text)] shrink-0"
                      onClick={() => setShowIdProof((prev) => !prev)}
                      aria-label={showIdProof ? 'Hide ID proof number' : 'Show ID proof number'}
                    >
                      {showIdProof ? <EyeOffIcon width={14} height={14} /> : <EyeIcon width={14} height={14} />}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Emergency Contact</div>
                <div className="font-medium">{tenant.emergencyContact || '-'}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {tenant.assignedUnit?._id && (
                <button
                  className="btn btn-info"
                  onClick={() => navigate(`/properties/${propertyId}/units/${tenant.assignedUnit._id}`)}
                >
                  View Unit
                </button>
              )}
              <button
                className="btn btn-info"
                onClick={() => navigate(`/properties/${propertyId}`)}
              >
                View Property
              </button>
              <button
                className="btn btn-warning"
                onClick={openEditTenant}
              >
                Edit
              </button>
              {tenant.isActive && (
                <button
                  className="btn btn-danger"
                  onClick={moveOutTenant}
                >
                  Move Out
                </button>
              )}
            </div>
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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Rent Amount" value={`₹${formatCurrency(tenant.rentAmount || 0)}`} icon={<TransactionsIcon width={18} height={18} />} />
        <StatCard
          label="Deposit"
          value={`₹${formatCurrency(depositPaid)} / ₹${formatCurrency(tenant.depositAmount || 0)}`}
          subLabel={`₹${formatCurrency(depositRemaining)} remaining`}
          tone={depositRemaining > 0 ? 'warning' : 'success'}
          icon={<ShieldIcon width={18} height={18} />}
        />
        <StatCard label="Status" value={tenant.isActive ? 'Active' : 'Moved Out'} tone={tenant.isActive ? 'success' : 'default'} icon={<UserIcon width={18} height={18} />} />
      </div>

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
            extraToolbar={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddPayment(true)}>
                Add Payment
              </button>
            }
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
        {recordsTab === 'utility' && (
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
      {tenant.isActive && (
        <DepositPaymentModal
          open={showDepositModal}
          onClose={() => setShowDepositModal(false)}
          propertyId={propertyId || ''}
          tenantId={tenant._id}
          unitId={tenant.assignedUnit?._id}
          tenantName={tenant.fullName}
          requiredDeposit={tenant.depositAmount || 0}
          paidDeposit={depositPaid}
          onSaved={() => load({ force: true })}
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
                onClick={() => setCollectRentRecord(null)}
                disabled={collectSaving}
                aria-label="Close"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <label className="text-xs text-[var(--muted)]">Amount Received</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full px-3 py-2"
              value={collectAmount}
              onChange={(e) => setCollectAmount(e.target.value)}
              autoFocus
            />
            <div className="mt-4 flex items-center gap-3">
              <button className="btn btn-primary" disabled={collectSaving} onClick={collectRent}>
                {collectSaving ? 'Saving...' : 'Collect'}
              </button>
              <button className="btn btn-cancel" disabled={collectSaving} onClick={() => setCollectRentRecord(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-sm text-[var(--muted)]">Add Payment</div>
                <div className="text-lg font-semibold">{tenant.fullName}{tenant.assignedUnit?.unitNumber ? ` • Unit ${tenant.assignedUnit.unitNumber}` : ''}</div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowAddPayment(false)}
                disabled={addPaymentSaving}
                aria-label="Close"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>

            <form onSubmit={submitAddPayment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--muted)]">Payment Type</label>
                  <select
                    className="w-full px-3 py-2 mt-1"
                    value={addPaymentForm.type}
                    onChange={(e) => setAddPaymentForm((prev) => ({ ...prev, type: e.target.value as typeof prev.type }))}
                  >
                    <option value="rent">Rent</option>
                    <option value="utility">Utility</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="deposit">Deposit</option>
                    <option value="refund">Deposit Refund</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {addPaymentForm.type === 'rent' ? (
                  <div>
                    <label className="text-xs text-[var(--muted)]">Month</label>
                    <input
                      type="month"
                      className="w-full px-3 py-2 mt-1"
                      value={addPaymentForm.month}
                      onChange={(e) => setAddPaymentForm((prev) => ({ ...prev, month: e.target.value }))}
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-[var(--muted)]">Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 mt-1"
                      value={addPaymentForm.date}
                      onChange={(e) => setAddPaymentForm((prev) => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-[var(--muted)]">Amount</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Amount"
                    value={addPaymentForm.amount}
                    onChange={(e) => setAddPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>

                {addPaymentForm.type === 'other' && (
                  <div>
                    <label className="text-xs text-[var(--muted)]">Direction</label>
                    <select
                      className="w-full px-3 py-2 mt-1"
                      value={addPaymentForm.direction}
                      onChange={(e) => setAddPaymentForm((prev) => ({ ...prev, direction: e.target.value as 'in' | 'out' }))}
                    >
                      <option value="in">Cash In (income received)</option>
                      <option value="out">Cash Out (expense paid)</option>
                    </select>
                  </div>
                )}

                {addPaymentForm.type === 'rent' ? (
                  <div>
                    <label className="text-xs text-[var(--muted)]">Payment Mode</label>
                    <select
                      className="w-full px-3 py-2 mt-1"
                      value={addPaymentForm.paymentMode}
                      onChange={(e) => setAddPaymentForm((prev) => ({ ...prev, paymentMode: e.target.value }))}
                    >
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <label className="text-xs text-[var(--muted)]">Notes (Optional)</label>
                    <input
                      className="w-full px-3 py-2 mt-1"
                      placeholder="Notes"
                      value={addPaymentForm.notes}
                      onChange={(e) => setAddPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button type="submit" className="btn btn-primary" disabled={addPaymentSaving}>
                  {addPaymentSaving ? 'Saving...' : 'Save Payment'}
                </button>
                <button type="button" className="btn btn-cancel" disabled={addPaymentSaving} onClick={() => setShowAddPayment(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">Edit Tenant</div>
              <button className="modal-close-btn" onClick={() => setShowEditTenant(false)} aria-label="Close">
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <form onSubmit={saveTenantEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--muted)]">Full Name</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Full name"
                    value={editTenantForm.fullName}
                    onChange={(e) => updateEditTenantField('fullName', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Phone</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Phone"
                    value={editTenantForm.phone}
                    onChange={(e) => updateEditTenantField('phone', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Email (Optional)</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Email"
                    value={editTenantForm.email}
                    onChange={(e) => updateEditTenantField('email', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Emergency Contact (Optional)</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Emergency contact"
                    value={editTenantForm.emergencyContact}
                    onChange={(e) => updateEditTenantField('emergencyContact', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">ID Proof Type (Optional)</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="ID proof type"
                    value={editTenantForm.idProofType}
                    onChange={(e) => updateEditTenantField('idProofType', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">ID Proof Number (Optional)</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="ID proof number"
                    value={editTenantForm.idProofNumber}
                    onChange={(e) => updateEditTenantField('idProofNumber', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" className="btn btn-primary" disabled={editTenantSaving}>
                  {editTenantSaving ? 'Saving...' : 'Save Tenant'}
                </button>
                <button type="button" className="btn btn-cancel" disabled={editTenantSaving} onClick={() => setShowEditTenant(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantDetails;
