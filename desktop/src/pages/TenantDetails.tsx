import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import DepositPaymentModal from '../components/DepositPaymentModal';
import Badge, { type BadgeTone } from '../components/Badge';
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm space-y-4">
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
              className="px-4 py-2 rounded-xl text-sm border border-black/10"
              onClick={() => navigate(`/properties/${propertyId}/units/${tenant.assignedUnit._id}`)}
            >
              View Unit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard label="Rent Amount" value={`₹${tenant.rentAmount || 0}`} />
        <StatCard label="Deposit" value={`₹${tenant.depositAmount || 0}`} />
        <StatCard label="Deposit Paid" value={`\u20B9${depositPaid}`} />
        <StatCard label="Deposit Remaining" value={`\u20B9${depositRemaining}`} />
        <StatCard label="Status" value={tenant.isActive ? 'Active' : 'Moved Out'} tone={tenant.isActive ? 'success' : 'default'} />
      </div>

      {tenant.isActive && depositRemaining > 0 && (
        <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Pending Deposit</div>
            <div className="text-sm text-[var(--muted)]">{`\u20B9${depositRemaining}`} remaining for this tenant.</div>
          </div>
          <button
            className="px-4 py-2 rounded-xl text-sm border border-emerald-200 text-emerald-600 bg-emerald-50"
            onClick={() => setShowDepositModal(true)}
          >
            Pay Remaining Deposit
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm space-y-3 text-sm">
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

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
        <div className="flex items-center justify-between gap-3 px-6 pt-6">
          <div className="text-sm font-semibold">Payments</div>
          <select
            className="border border-black/10 rounded-lg px-3 py-2 text-sm"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as (typeof paymentFilterOptions)[number]['value'])}
          >
            {paymentFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <table className="w-full text-sm mt-4">
          <thead className="text-left border-b border-black/5">
            <tr>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((payment) => (
              <tr key={payment._id} className="border-b border-black/5">
                <td className="px-6 py-3">{formatPaymentType(payment)}</td>
                <td className="px-6 py-3">₹{payment.amount}</td>
                <td className="px-6 py-3">{formatDate(payment.date)}</td>
                <td className="px-6 py-3">{payment.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredPayments.length && (
          <div className="px-6 pb-6 text-[var(--muted)]">
            {paymentFilter === 'all' ? 'No payments yet.' : `No ${paymentFilter} payments found.`}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
        <div className="text-sm font-semibold px-6 pt-6">Rent Records</div>
        <table className="w-full text-sm mt-4">
          <thead className="text-left border-b border-black/5">
            <tr>
              <th className="px-6 py-3">Month</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rentRecords.map((record) => (
              <tr key={record._id} className="border-b border-black/5">
                <td className="px-6 py-3">
                  {formatMonthYear(record.month, record.year)}
                </td>
                <td className="px-6 py-3">₹{record.rentAmount}</td>
                <td className="px-6 py-3">
                  <Badge tone={paymentStatusTone(record.status)}>{record.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rentRecords.length && <div className="px-6 pb-6 text-[var(--muted)]">No rent records yet.</div>}
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
