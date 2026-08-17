import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import DepositPaymentModal from '../components/DepositPaymentModal';
import Badge, { type BadgeTone } from '../components/Badge';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { ShieldIcon, TransactionsIcon, UserIcon } from '../components/icons';
import { formatDate, formatMonthYear } from '../lib/dateFormat';
import { useDataVersion } from '../lib/dataSync';

const paymentStatusTone = (status: string): BadgeTone => {
  if (status === 'paid') return 'success';
  if (status === 'partial') return 'warning';
  return 'danger';
};

const paymentFilterOptions = [
  { value: 'all', label: 'All Payments' },
  { value: 'rent', label: 'Rent' },
  { value: 'utility', label: 'Utility' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'other', label: 'Others' }
] as const;

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
  return 'Other';
};

const TenantDetails = () => {
  const { propertyId, tenantId } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [rentRecords, setRentRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<(typeof paymentFilterOptions)[number]['value']>('all');
  const dataVersion = useDataVersion();

  useEffect(() => {
    if (!propertyId || !tenantId) return;
    const load = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/properties/${propertyId}/tenants/${tenantId}/details`);
        setTenant(response.data.tenant);
        setPayments(response.data.payments || []);
        setRentRecords(response.data.rentRecords || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [propertyId, tenantId, dataVersion]);

  if (!tenant && loading) {
    return <div className="text-sm text-[var(--muted)]">Loading tenant...</div>;
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
  const filteredPayments =
    paymentFilter === 'all'
      ? payments
      : payments.filter((payment) => getPaymentCategory(payment) === paymentFilter);

  const paymentColumns: TableColumn<any>[] = [
    { key: 'type', label: 'Type', accessor: (payment) => formatPaymentType(payment) },
    { key: 'amount', label: 'Amount', accessor: (payment) => payment.amount, render: (payment) => `₹${payment.amount}` },
    { key: 'date', label: 'Date', accessor: (payment) => new Date(payment.date).getTime(), render: (payment) => formatDate(payment.date) },
    { key: 'notes', label: 'Notes', accessor: (payment) => payment.notes || '-' }
  ];

  const rentRecordColumns: TableColumn<any>[] = [
    { key: 'month', label: 'Month', accessor: (record) => record.year * 100 + record.month, render: (record) => formatMonthYear(record.month, record.year) },
    { key: 'amount', label: 'Amount', accessor: (record) => record.rentAmount, render: (record) => `₹${record.rentAmount}` },
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
    }
  ];

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">{tenant.fullName}</div>
            <div className="text-sm text-[var(--muted)]">{tenant.phone}</div>
            {tenant.email && <div className="text-sm text-[var(--muted)]">{tenant.email}</div>}
            {tenant.assignedUnit?.unitNumber && (
              <div className="text-xs text-[var(--muted)] mt-1">Unit {tenant.assignedUnit.unitNumber}</div>
            )}
          </div>
          {tenant.assignedUnit?._id && (
            <button
              className="btn btn-info"
              onClick={() => navigate(`/properties/${propertyId}/units/${tenant.assignedUnit._id}`)}
            >
              View Unit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard label="Rent Amount" value={`₹${tenant.rentAmount || 0}`} icon={<TransactionsIcon width={18} height={18} />} />
        <StatCard label="Deposit" value={`₹${tenant.depositAmount || 0}`} icon={<ShieldIcon width={18} height={18} />} />
        <StatCard label="Deposit Paid" value={`\u20B9${depositPaid}`} tone="success" icon={<ShieldIcon width={18} height={18} />} />
        <StatCard label="Deposit Remaining" value={`\u20B9${depositRemaining}`} tone={depositRemaining > 0 ? 'warning' : 'success'} icon={<ShieldIcon width={18} height={18} />} />
        <StatCard label="Status" value={tenant.isActive ? 'Active' : 'Moved Out'} tone={tenant.isActive ? 'success' : 'default'} icon={<UserIcon width={18} height={18} />} />
      </div>

      {tenant.isActive && depositRemaining > 0 && (
        <div className="card p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Pending Deposit</div>
            <div className="text-sm text-[var(--muted)]">{`\u20B9${depositRemaining}`} remaining for this tenant.</div>
          </div>
          <button
            className="btn btn-success"
            onClick={() => setShowDepositModal(true)}
          >
            Pay Remaining Deposit
          </button>
        </div>
      )}

      <div className="card p-6 space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">ID Proof</div>
            <div className="font-medium">{tenant.idProofType || '-'} {tenant.idProofNumber || ''}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Emergency Contact</div>
            <div className="font-medium">{tenant.emergencyContact || '-'}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-3">Payments</div>
        <SortableTable
          columns={paymentColumns}
          data={filteredPayments}
          rowKey={(payment) => payment._id}
          searchPlaceholder="Search payments by type, notes..."
          emptyIcon={<TransactionsIcon width={22} height={22} />}
          emptyTitle={paymentFilter === 'all' ? 'No payments yet' : `No ${paymentFilter} payments found`}
          extraToolbar={
            <select
              className="py-2 pl-3 pr-3 text-sm"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as (typeof paymentFilterOptions)[number]['value'])}
            >
              {paymentFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          }
        />
      </div>

      <div>
        <div className="text-sm font-semibold mb-3">Rent Records</div>
        <SortableTable
          columns={rentRecordColumns}
          data={rentRecords}
          rowKey={(record) => record._id}
          searchPlaceholder="Search rent records..."
          emptyIcon={<TransactionsIcon width={22} height={22} />}
          emptyTitle="No rent records yet"
        />
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
          onSaved={async () => {
            const response = await api.get(`/properties/${propertyId}/tenants/${tenantId}/details`);
            setTenant(response.data.tenant);
            setPayments(response.data.payments || []);
            setRentRecords(response.data.rentRecords || []);
          }}
        />
      )}
    </div>
  );
};

export default TenantDetails;
