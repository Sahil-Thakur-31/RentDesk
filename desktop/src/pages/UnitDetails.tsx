import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import TenantFormModal from '../components/TenantFormModal';
import DepositPaymentModal from '../components/DepositPaymentModal';
import { formatDate, formatMonthKey, formatMonthYear } from '../lib/dateFormat';
import { useDataVersion } from '../lib/dataSync';

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

const UnitDetails = () => {
  const { propertyId, unitId } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [rentRecords, setRentRecords] = useState<any[]>([]);
  const [utilityBills, setUtilityBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<(typeof paymentFilterOptions)[number]['value']>('all');
  const [error, setError] = useState('');
  const dataVersion = useDataVersion();
  const [form, setForm] = useState({
    unitNumber: '',
    unitType: '1bhk',
    floor: '',
    size: '',
    monthlyRent: '',
    deposit: '',
    lastMeterReading: ''
  });

  useEffect(() => {
    if (!propertyId || !unitId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [propertyRes, unitRes] = await Promise.all([
          api.get(`/properties/${propertyId}`),
          api.get(`/properties/${propertyId}/units/${unitId}/details`)
        ]);
        setProperty(propertyRes.data);
        setUnit(unitRes.data.unit);
        setTenants(unitRes.data.tenants || []);
        setPayments(unitRes.data.payments || []);
        setRentRecords(unitRes.data.rentRecords || []);
        setUtilityBills(unitRes.data.utilityBills || []);
        setForm({
          unitNumber: unitRes.data.unit.unitNumber || '',
          unitType: unitRes.data.unit.unitType || '1bhk',
          floor: unitRes.data.unit.floor || '',
          size: unitRes.data.unit.size || '',
          monthlyRent: String(unitRes.data.unit.monthlyRent ?? ''),
          deposit: String(unitRes.data.unit.deposit ?? ''),
          lastMeterReading: String(unitRes.data.unit.lastMeterReading ?? '')
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [propertyId, unitId, dataVersion]);

  const refresh = async () => {
    if (!propertyId || !unitId) return;
    const response = await api.get(`/properties/${propertyId}/units/${unitId}/details`);
    setUnit(response.data.unit);
    setTenants(response.data.tenants || []);
    setPayments(response.data.payments || []);
    setRentRecords(response.data.rentRecords || []);
    setUtilityBills(response.data.utilityBills || []);
  };

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !unitId) return;
    setError('');
    setLoading(true);
    try {
      const response = await api.patch(`/properties/${propertyId}/units/${unitId}`, {
        unitNumber: form.unitNumber,
        unitType: form.unitType,
        floor: form.floor || undefined,
        size: form.size || undefined,
        monthlyRent: Number(form.monthlyRent),
        deposit: Number(form.deposit),
        lastMeterReading: form.lastMeterReading ? Number(form.lastMeterReading) : undefined
      });
      setUnit(response.data);
      setShowEdit(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update unit.');
    } finally {
      setLoading(false);
    }
  };

  const deleteUnit = async () => {
    if (!propertyId || !unitId || !unit?.unitNumber) return;
    const ok = window.confirm(`Delete unit "${unit.unitNumber}"? This will hide it from lists.`);
    if (!ok) return;
    setLoading(true);
    try {
      await api.delete(`/properties/${propertyId}/units/${unitId}`);
      navigate(`/properties/${propertyId}`);
    } finally {
      setLoading(false);
    }
  };

  const removeTenant = async () => {
    if (!propertyId || !unit?.currentTenant?._id) return;
    const ok = window.confirm(`Remove "${unit.currentTenant.fullName}" from this unit?`);
    if (!ok) return;
    setLoading(true);
    try {
      await api.patch(`/properties/${propertyId}/tenants/${unit.currentTenant._id}/move-out`);
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  const toggleMaintenance = async () => {
    if (!propertyId || !unitId) return;
    setLoading(true);
    try {
      const response = await api.patch(`/properties/${propertyId}/units/${unitId}`, {
        maintenanceMode: !unit.maintenanceMode
      });
      setUnit(response.data);
    } finally {
      setLoading(false);
    }
  };

  if (!unit && loading) {
    return <div className="text-sm text-[var(--muted)]">Loading unit...</div>;
  }

  if (!unit) {
    return <div className="text-sm text-[var(--muted)]">Unit not found.</div>;
  }

  const latestElectricity = utilityBills
    .filter((bill) => String(bill.billType).toLowerCase().includes('electric'))
    .sort((a, b) => (a.month < b.month ? 1 : -1))[0];

  const currentTenantPayments = payments.filter(
    (payment) => unit.currentTenant?._id && String(payment.tenantId) === String(unit.currentTenant._id)
  );
  const depositPaid = currentTenantPayments.reduce((sum, payment) => {
    if (payment.type === 'deposit') return sum + (payment.amount || 0);
    if (payment.type === 'refund') return sum - (payment.amount || 0);
    return sum;
  }, 0);
  const depositRemaining = Math.max(0, (unit.deposit || 0) - depositPaid);
  const filteredPayments =
    paymentFilter === 'all'
      ? payments
      : payments.filter((payment) => getPaymentCategory(payment) === paymentFilter);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">
              Unit {unit.unitNumber}
              {property?.name ? ` • ${property.name}` : ''}
            </div>
            <div className="text-sm text-[var(--muted)]">{unitTypeLabels[unit.unitType] || unit.unitType}</div>
            <div className="text-xs text-[var(--muted)] mt-1">
              Floor {unit.floor || '-'} • Status {formatUnitStatus(unit.status)}
            </div>
            {unit.maintenanceMode && unit.maintenanceUntil && (
              <div className="text-xs text-[var(--muted)] mt-1">
                Under repair until {formatDate(unit.maintenanceUntil)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`px-4 py-2 rounded-xl text-sm border ${
                unit.maintenanceMode ? 'border-amber-200 text-amber-700 bg-amber-50' : 'border-black/10'
              }`}
              onClick={toggleMaintenance}
            >
              {unit.maintenanceMode ? 'Turn Off Repair Mode' : 'Turn On Repair Mode'}
            </button>
            <button
              className="px-4 py-2 rounded-xl text-sm border border-black/10"
              onClick={() => navigate(`/properties/${propertyId}`)}
            >
              View Property
            </button>
            <button
              className="px-4 py-2 rounded-xl text-sm border border-black/10"
              onClick={() => setShowEdit(true)}
            >
              Edit
            </button>
            <button
              className="px-4 py-2 rounded-xl text-sm border border-red-200 text-red-600 bg-red-50"
              onClick={deleteUnit}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard label="Monthly Rent" value={`₹${unit.monthlyRent}`} />
        <StatCard label="Deposit" value={`₹${unit.deposit}`} />
        <StatCard label="Deposit Paid" value={`₹${depositPaid}`} />
        <StatCard label="Deposit Remaining" value={`\u20B9${depositRemaining}`} />
        <StatCard label="Tenant" value={unit.currentTenant?.fullName || 'Vacant'} />
      </div>

      <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Unit Number</div>
            <div className="font-medium">{unit.unitNumber}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Type</div>
            <div className="font-medium">{unitTypeLabels[unit.unitType] || unit.unitType}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Floor</div>
            <div className="font-medium">{unit.floor || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Size</div>
            <div className="font-medium">{unit.size || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Status</div>
            <div className="font-medium">{formatUnitStatus(unit.status)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Meter Reading</div>
            <div className="font-medium">{unit.lastMeterReading ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Meter Reading Date</div>
            <div className="font-medium">
              {formatDate(unit.lastMeterReadingDate)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Latest Electricity Reading</div>
            <div className="font-medium">{latestElectricity ? latestElectricity.meterEnd : '-'}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Electricity Bill Month</div>
            <div className="font-medium">{latestElectricity ? formatMonthKey(latestElectricity.month) : '-'}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Tenant</div>
            <div className="font-medium">{unit.currentTenant?.fullName || '-'}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">Current Tenant</div>
          <div className="flex items-center gap-2">
            {unit.currentTenant ? (
              <>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg border border-black/10"
                  onClick={() => navigate(`/properties/${propertyId}/tenants/${unit.currentTenant._id}`)}
                >
                  View
                </button>
                {depositRemaining > 0 && (
                  <button
                    className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 bg-emerald-50"
                    onClick={() => setShowDepositModal(true)}
                  >
                    Pay Remaining Deposit
                  </button>
                )}
                <button
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50"
                  onClick={removeTenant}
                >
                  Remove
                </button>
              </>
            ) : (
              unit.maintenanceMode ? (
                <span className="text-xs text-[var(--muted)]">Turn off repair mode to assign tenant</span>
              ) : (
                <button
                  className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 bg-emerald-50"
                  onClick={() => setShowTenantModal(true)}
                >
                  Assign Tenant
                </button>
              )
            )}
          </div>
        </div>
        {unit.currentTenant ? (
          <div className="text-sm space-y-1">
            <div className="font-medium">{unit.currentTenant.fullName}</div>
            <div className="text-[var(--muted)]">{unit.currentTenant.phone}</div>
            {unit.currentTenant.email && <div className="text-[var(--muted)]">{unit.currentTenant.email}</div>}
          </div>
        ) : (
          <div className="text-sm text-[var(--muted)]">No active tenant.</div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm">
        <div className="text-sm font-semibold mb-4">Tenant History</div>
        <div className="space-y-3 text-sm">
          {tenants.map((tenant) => (
            <div key={tenant._id} className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{tenant.fullName}</div>
                <div className="text-xs text-[var(--muted)]">{tenant.phone}</div>
                {tenant.email && <div className="text-xs text-[var(--muted)]">{tenant.email}</div>}
              </div>
              <div className="text-xs text-[var(--muted)] text-right">
                <div>{tenant.isActive ? 'Active' : 'Moved Out'}</div>
              </div>
              <button
                className="text-xs px-3 py-1.5 rounded-lg border border-black/10"
                onClick={() => navigate(`/properties/${propertyId}/tenants/${tenant._id}`)}
              >
                View
              </button>
            </div>
          ))}
          {!tenants.length && <div className="text-[var(--muted)]">No tenant history.</div>}
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
                <td className="px-6 py-3">{formatMonthYear(record.month, record.year)}</td>
                <td className="px-6 py-3">₹{record.rentAmount}</td>
                <td className="px-6 py-3">{record.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rentRecords.length && <div className="px-6 pb-6 text-[var(--muted)]">No rent records yet.</div>}
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
        <div className="text-sm font-semibold px-6 pt-6">Utility Bills</div>
        <table className="w-full text-sm mt-4">
          <thead className="text-left border-b border-black/5">
            <tr>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Month</th>
              <th className="px-6 py-3">Units</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {utilityBills.map((bill) => (
              <tr key={bill._id} className="border-b border-black/5">
                <td className="px-6 py-3">{bill.billType}</td>
                <td className="px-6 py-3">{formatMonthKey(bill.month)}</td>
                <td className="px-6 py-3">{bill.unitsConsumed}</td>
                <td className="px-6 py-3">₹{bill.amount}</td>
                <td className="px-6 py-3">{bill.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!utilityBills.length && <div className="px-6 pb-6 text-[var(--muted)]">No utility bills yet.</div>}
      </div>

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">Edit Unit</div>
              <button className="text-sm text-[var(--muted)]" onClick={() => setShowEdit(false)}>
                Close
              </button>
            </div>
            <form onSubmit={saveUnit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--muted)]">Unit Number</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Unit number"
                    value={form.unitNumber}
                    onChange={(e) => updateField('unitNumber', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Unit Type</label>
                  <select
                    className="px-3 py-2 mt-1"
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
                    className="px-3 py-2 mt-1"
                    placeholder="Floor"
                    value={form.floor}
                    onChange={(e) => updateField('floor', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Size</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Size"
                    value={form.size}
                    onChange={(e) => updateField('size', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Monthly Rent</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Monthly rent"
                    value={form.monthlyRent}
                    onChange={(e) => updateField('monthlyRent', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Deposit</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Deposit"
                    value={form.deposit}
                    onChange={(e) => updateField('deposit', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Last Meter Reading</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Meter reading"
                    value={form.lastMeterReading}
                    onChange={(e) => updateField('lastMeterReading', e.target.value)}
                  />
                </div>
              </div>
              {error && <div className="text-sm text-[var(--danger)]">{error}</div>}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-medium"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="text-sm text-[var(--muted)]"
                  onClick={() => setShowEdit(false)}
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
    </div>
  );
};

export default UnitDetails;
