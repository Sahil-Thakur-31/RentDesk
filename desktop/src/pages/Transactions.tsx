import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import { formatDate, formatMonthKey, formatMonthYear, getCurrentDateValue, getCurrentMonthValue, shiftMonthValue } from '../lib/dateFormat';
import { useDataVersion } from '../lib/dataSync';

type TabKey = 'all' | 'rent' | 'electricity' | 'maintenance' | 'deposit' | 'others';
type MaintenanceView = 'collected' | 'spent';

const statusColor = (status: string) => {
  if (status === 'paid') return 'text-[var(--success)]';
  if (status === 'partial') return 'text-[var(--warning)]';
  return 'text-[var(--danger)]';
};

const getPropertyName = (item: any, properties: any[], propertyId: string) =>
  item._propertyName || properties.find((property) => property._id === propertyId)?.name || '-';

const getActionDateFromMonth = (monthValue: string) => {
  const [selectedYear, selectedMonth] = monthValue.split('-').map(Number);
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

const Transactions = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [tab, setTab] = useState<TabKey>('all');
  const [maintenanceView, setMaintenanceView] = useState<MaintenanceView>('collected');
  const [monthFilter, setMonthFilter] = useState(getCurrentMonthValue());
  const [rentRecords, setRentRecords] = useState<any[]>([]);
  const [utilityBills, setUtilityBills] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [addType, setAddType] = useState<'rent' | 'electricity' | 'maintenance' | 'deposit' | 'others'>('rent');
  const [formPropertyId, setFormPropertyId] = useState('');
  const [formUnits, setFormUnits] = useState<any[]>([]);
  const [formTenants, setFormTenants] = useState<any[]>([]);
  const [electricityRows, setElectricityRows] = useState<any[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [rentRemainingAmount, setRentRemainingAmount] = useState(0);
  const [depositRemainingAmount, setDepositRemainingAmount] = useState(0);
  const [rentForm, setRentForm] = useState({
    tenantId: '',
    month: getCurrentMonthValue(),
    amount: '',
    paymentMode: 'cash'
  });
  const [electricityForm, setElectricityForm] = useState({
    unitId: '',
    month: getCurrentMonthValue(),
    currentReading: '',
    status: 'paid'
  });
  const [maintenanceForm, setMaintenanceForm] = useState({
    date: getCurrentDateValue(),
    category: '',
    description: '',
    amount: '',
    paidTo: ''
  });
  const [depositForm, setDepositForm] = useState({
    tenantId: '',
    type: 'deposit',
    amount: '',
    date: getCurrentDateValue(),
    notes: ''
  });
  const [otherForm, setOtherForm] = useState({
    amount: '',
    date: getCurrentDateValue(),
    notes: ''
  });
  const dataVersion = useDataVersion();
  const selectedRentTenant = formTenants.find((tenant) => tenant._id === rentForm.tenantId);
  const selectedDepositTenant = formTenants.find((tenant) => tenant._id === depositForm.tenantId);
  const selectedElectricityRow = electricityRows.find((row) => String(row.unitId) === String(electricityForm.unitId));

  useEffect(() => {
    const load = async () => {
      const response = await api.get('/properties');
      const list = response.data || [];
      setProperties(list);
    };
    load();
  }, [dataVersion]);

  useEffect(() => {
    const load = async () => {
      if (propertyId) {
        const [rentRes, utilityRes, maintenanceRes, paymentsRes] = await Promise.all([
          api.get(`/properties/${propertyId}/rent-records`),
          api.get(`/properties/${propertyId}/utility-bills`),
          api.get(`/properties/${propertyId}/maintenance`),
          api.get(`/properties/${propertyId}/payments`)
        ]);
        setRentRecords(rentRes.data);
        setUtilityBills(utilityRes.data);
        setMaintenance(maintenanceRes.data);
        setPayments(paymentsRes.data);
        return;
      }

      if (!properties.length) {
        setRentRecords([]);
        setUtilityBills([]);
        setMaintenance([]);
        setPayments([]);
        return;
      }

      const responses = await Promise.all(
        properties.map((property) =>
          Promise.all([
            api.get(`/properties/${property._id}/rent-records`),
            api.get(`/properties/${property._id}/utility-bills`),
            api.get(`/properties/${property._id}/maintenance`),
            api.get(`/properties/${property._id}/payments`)
          ])
        )
      );

      setRentRecords(
        responses.flatMap((result, index) =>
          (result[0].data || []).map((record: any) => ({
            ...record,
            _propertyName: properties[index].name
          }))
        )
      );
      setUtilityBills(
        responses.flatMap((result, index) =>
          (result[1].data || []).map((bill: any) => ({
            ...bill,
            _propertyName: properties[index].name
          }))
        )
      );
      setMaintenance(
        responses.flatMap((result, index) =>
          (result[2].data || []).map((record: any) => ({
            ...record,
            _propertyName: properties[index].name
          }))
        )
      );
      setPayments(
        responses.flatMap((result, index) =>
          (result[3].data || []).map((payment: any) => ({
            ...payment,
            _propertyName: properties[index].name
          }))
        )
      );
    };
    load();
  }, [propertyId, properties, dataVersion]);

  useEffect(() => {
    if (!showAddPayment) return;
    setFormPropertyId(propertyId || '');
    setAddType('rent');
    setFormError('');
    setRentForm({
      tenantId: '',
      month: monthFilter,
      amount: '',
      paymentMode: 'cash'
    });
    setElectricityForm({
      unitId: '',
      month: monthFilter,
      currentReading: '',
      status: 'paid'
    });
    setMaintenanceForm({
      date: getActionDateFromMonth(monthFilter).slice(0, 10),
      category: '',
      description: '',
      amount: '',
      paidTo: ''
    });
    setDepositForm({
      tenantId: '',
      type: 'deposit',
      amount: '',
      date: getActionDateFromMonth(monthFilter).slice(0, 10),
      notes: ''
    });
    setOtherForm({
      amount: '',
      date: getActionDateFromMonth(monthFilter).slice(0, 10),
      notes: ''
    });
  }, [showAddPayment, propertyId, monthFilter]);

  useEffect(() => {
    if (!showAddPayment || !formPropertyId) {
      setFormUnits([]);
      setFormTenants([]);
      setElectricityRows([]);
      return;
    }

    const loadFormData = async () => {
      const [unitsRes, tenantsRes] = await Promise.all([
        api.get(`/properties/${formPropertyId}/units?archived=false`),
        api.get(`/properties/${formPropertyId}/tenants?status=active`)
      ]);
      setFormUnits(unitsRes.data || []);
      setFormTenants(tenantsRes.data || []);
    };

    loadFormData();
  }, [showAddPayment, formPropertyId, dataVersion]);

  useEffect(() => {
    if (!showAddPayment || !formPropertyId || addType !== 'electricity') {
      setElectricityRows([]);
      return;
    }

    const loadElectricityRows = async () => {
      const response = await api.get(
        `/properties/${formPropertyId}/utility-bills/electricity-readings?month=${electricityForm.month}`
      );
      setElectricityRows(
        (response.data?.rows || []).map((row: any) => ({
          ...row,
          electricityUnitRate: response.data?.rates?.electricityUnitRate || 0,
          commonElectricityCharge: response.data?.rates?.commonElectricityCharge || 0
        }))
      );
    };

    loadElectricityRows();
  }, [showAddPayment, formPropertyId, addType, electricityForm.month, dataVersion]);

  useEffect(() => {
    if (!selectedElectricityRow) return;
    setElectricityForm((prev) => ({
      ...prev,
      currentReading:
        prev.currentReading || (selectedElectricityRow.currentReading != null ? String(selectedElectricityRow.currentReading) : '')
    }));
  }, [selectedElectricityRow]);

  useEffect(() => {
    if (!showAddPayment || addType !== 'rent' || !formPropertyId || !rentForm.tenantId) {
      setRentRemainingAmount(0);
      return;
    }

    const loadRentRemaining = async () => {
      const [rentYear, rentMonth] = rentForm.month.split('-').map(Number);
      const response = await api.get(`/properties/${formPropertyId}/rent-records`, {
        params: { month: rentMonth, year: rentYear }
      });
      const existingRecord = (response.data || []).find(
        (record: any) => String(record.tenantId?._id || record.tenantId) === String(rentForm.tenantId)
      );
      const remaining = existingRecord
        ? Math.max(0, (existingRecord.rentAmount || 0) - (existingRecord.paidAmount || 0))
        : Number(selectedRentTenant?.rentAmount || 0);
      setRentRemainingAmount(remaining);
      setRentForm((prev) => ({ ...prev, amount: remaining ? String(remaining) : '' }));
    };

    loadRentRemaining();
  }, [showAddPayment, addType, formPropertyId, rentForm.tenantId, rentForm.month, selectedRentTenant]);

  useEffect(() => {
    if (!showAddPayment || addType !== 'deposit' || !formPropertyId || !depositForm.tenantId) {
      setDepositRemainingAmount(0);
      return;
    }

    const loadDepositRemaining = async () => {
      const response = await api.get(`/properties/${formPropertyId}/tenants/${depositForm.tenantId}/details`);
      const tenant = response.data?.tenant;
      const tenantPayments = response.data?.payments || [];
      const heldDeposit = tenantPayments.reduce((sum: number, payment: any) => {
        if (payment.type === 'deposit') return sum + (payment.amount || 0);
        if (payment.type === 'refund') return sum - (payment.amount || 0);
        return sum;
      }, 0);
      const suggestedAmount =
        depositForm.type === 'refund'
          ? Math.max(0, heldDeposit)
          : Math.max(0, Number(tenant?.depositAmount || 0) - heldDeposit);
      setDepositRemainingAmount(suggestedAmount);
      setDepositForm((prev) => ({ ...prev, amount: suggestedAmount ? String(suggestedAmount) : '' }));
    };

    loadDepositRemaining();
  }, [showAddPayment, addType, formPropertyId, depositForm.tenantId, depositForm.type]);

  const electricityBills = useMemo(() => {
    return utilityBills.filter(
      (bill) =>
        String(bill.billType).toLowerCase().includes('electric') &&
        String(bill.month || '').startsWith(monthFilter)
    );
  }, [utilityBills, monthFilter]);

  const filteredRentRecords = useMemo(() => {
    return rentRecords.filter(
      (record) => `${record.year}-${String(record.month).padStart(2, '0')}` === monthFilter
    );
  }, [rentRecords, monthFilter]);

  const filteredMaintenance = useMemo(() => {
    return maintenance.filter(
      (record) => String(record.date || '').slice(0, 7) === monthFilter
    );
  }, [maintenance, monthFilter]);

  const maintenanceCollectedPayments = useMemo(() => {
    return payments.filter(
      (payment) =>
        payment.type === 'maintenance' &&
        String(payment.date || '').slice(0, 7) === monthFilter &&
        String(payment.notes || '').toLowerCase().includes('maintenance collected')
    );
  }, [payments, monthFilter]);

  const maintenanceSpentPayments = useMemo(() => {
    return payments.filter(
      (payment) =>
        payment.type === 'maintenance' &&
        String(payment.date || '').slice(0, 7) === monthFilter &&
        !String(payment.notes || '').toLowerCase().includes('maintenance collected')
    );
  }, [payments, monthFilter]);

  const otherPayments = useMemo(() => {
    return payments.filter(
      (payment) =>
        !['rent', 'utility', 'maintenance', 'deposit', 'refund'].includes(payment.type) &&
        String(payment.date || '').slice(0, 7) === monthFilter
    );
  }, [payments, monthFilter]);
  const depositPayments = useMemo(() => {
    return payments.filter(
      (payment) =>
        ['deposit', 'refund'].includes(payment.type) &&
        String(payment.date || '').slice(0, 7) === monthFilter
    );
  }, [payments, monthFilter]);
  const maintenanceSpentRows = useMemo(() => {
    const expenseRows = filteredMaintenance.map((record) => ({
      _id: `expense-${record._id}`,
      propertyName: getPropertyName(record, properties, propertyId),
      date: record.date,
      category: record.category || 'Expense',
      paidTo: record.paidTo || '-',
      amount: record.amount || 0,
      notes: record.description || '-',
      source: 'expense'
    }));
    const paymentRows = maintenanceSpentPayments.map((payment) => ({
      _id: `payment-${payment._id}`,
      propertyName: getPropertyName(payment, properties, propertyId),
      date: payment.date,
      category: 'Maintenance Spent',
      paidTo: payment.paidTo || '-',
      amount: payment.amount || 0,
      notes: payment.notes || '-',
      source: 'payment'
    }));
    return [...paymentRows, ...expenseRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filteredMaintenance, maintenanceSpentPayments, properties, propertyId]);
  const allTransactions = useMemo(() => {
    const rentItems = filteredRentRecords.map((record) => ({
      _id: `rent-${record._id}`,
      propertyName: getPropertyName(record, properties, propertyId),
      category: 'Rent',
      details: `${record.tenantId?.fullName || 'Tenant'} • Unit ${record.unitId?.unitNumber || '-'}`,
      amount: record.paidAmount || record.rentAmount || 0,
      date: record.paidDate || new Date(record.year, Math.max(0, Number(record.month) - 1), 1).toISOString(),
      status: record.status
    }));

    const electricityItems = electricityBills.map((bill) => ({
      _id: `utility-${bill._id}`,
      propertyName: getPropertyName(bill, properties, propertyId),
      category: 'Electricity',
      details: `Unit ${bill.unitId?.unitNumber || '-'} • ${formatMonthKey(bill.month)}`,
      amount: bill.amount || 0,
      date: bill.updatedAt || bill.createdAt || new Date(`${bill.month}-01`).toISOString(),
      status: bill.status
    }));

    const maintenanceItems = filteredMaintenance.map((record) => ({
      _id: `maintenance-${record._id}`,
      propertyName: getPropertyName(record, properties, propertyId),
      category: 'Maintenance Spent',
      details: `${record.category || 'Expense'}${record.paidTo ? ` - ${record.paidTo}` : ''}`,
      amount: record.amount || 0,
      date: record.date,
      status: 'paid'
    }));

    const maintenancePaymentItems = [...maintenanceCollectedPayments, ...maintenanceSpentPayments].map((payment) => ({
      _id: `payment-maintenance-${payment._id}`,
      propertyName: getPropertyName(payment, properties, propertyId),
      category: String(payment.notes || '').toLowerCase().includes('maintenance collected')
        ? 'Maintenance Collected'
        : 'Maintenance Spent',
      details:
        payment.notes ||
        `${payment.tenantId?.fullName || '-'}${payment.unitId?.unitNumber ? ` - ${payment.unitId.unitNumber}` : ''}`,
      amount: payment.amount || 0,
      date: payment.date,
      status: 'paid'
    }));

    const paymentItems = [...depositPayments, ...otherPayments].map((payment) => ({
      _id: `payment-${payment._id}`,
      propertyName: getPropertyName(payment, properties, propertyId),
      category:
        payment.type === 'deposit'
          ? 'Deposit'
          : payment.type === 'refund'
            ? 'Deposit Refund'
            : payment.type === 'maintenance'
              ? 'Maintenance'
              : payment.type === 'utility'
                ? 'Utility'
                : payment.type === 'rent'
                  ? 'Rent'
                  : 'Other',
      details: payment.notes || `${payment.tenantId?.fullName || '-'}${payment.unitId?.unitNumber ? ` • Unit ${payment.unitId.unitNumber}` : ''}`,
      amount: payment.amount || 0,
      date: payment.date,
      status: 'paid'
    }));

    return [...rentItems, ...electricityItems, ...maintenanceItems, ...maintenancePaymentItems, ...paymentItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [
    filteredRentRecords,
    electricityBills,
    filteredMaintenance,
    maintenanceCollectedPayments,
    maintenanceSpentPayments,
    depositPayments,
    otherPayments,
    properties,
    propertyId
  ]);

  const electricityAmountPreview = useMemo(() => {
    if (!selectedElectricityRow) return 0;
    if (selectedElectricityRow.currentReading != null && electricityForm.currentReading === '') {
      return Number(selectedElectricityRow.calculatedAmount || 0);
    }
    const currentReading = Number(electricityForm.currentReading || 0);
    if (!currentReading || currentReading <= Number(selectedElectricityRow.lastReading || 0)) {
      return 0;
    }
    const unitsUsed = currentReading - Number(selectedElectricityRow.lastReading || 0);
    const perUnitCharge = Number(selectedElectricityRow.electricityUnitRate || 0);
    const commonCharge = Number(selectedElectricityRow.commonElectricityCharge || 0);
    return Math.floor(unitsUsed * perUnitCharge + commonCharge);
  }, [selectedElectricityRow, electricityForm.currentReading]);

  const closeAddPaymentModal = () => {
    setShowAddPayment(false);
    setFormError('');
    setFormLoading(false);
  };

  const submitAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPropertyId) {
      setFormError('Select a property.');
      return;
    }

    setFormError('');
    setFormLoading(true);
    try {
      if (addType === 'rent') {
        if (!selectedRentTenant?.assignedUnit?._id) {
          throw new Error('Select a tenant with an assigned unit.');
        }
        const amount = Number(rentForm.amount);
        if (!amount || amount <= 0) {
          throw new Error('Enter a valid rent amount.');
        }
        const [rentYear, rentMonth] = rentForm.month.split('-').map(Number);
        const existingRes = await api.get(`/properties/${formPropertyId}/rent-records`, {
          params: { month: rentMonth, year: rentYear }
        });
        const existingRecord = (existingRes.data || []).find(
          (record: any) => String(record.tenantId?._id || record.tenantId) === String(rentForm.tenantId)
        );
        const paidDate = getActionDateFromMonth(rentForm.month);
        if (existingRecord) {
          const remaining = Math.max(0, (existingRecord.rentAmount || 0) - (existingRecord.paidAmount || 0));
          if (amount > remaining) {
            throw new Error(`Amount cannot exceed remaining rent of ₹${remaining}.`);
          }
          await api.post(`/properties/${formPropertyId}/rent-records/${existingRecord._id}/collect`, {
            amount,
            paidDate,
            paymentMode: rentForm.paymentMode
          });
        } else {
          const totalRent = Number(selectedRentTenant.rentAmount || 0);
          await api.post(`/properties/${formPropertyId}/rent-records`, {
            unitId: selectedRentTenant.assignedUnit._id,
            tenantId: selectedRentTenant._id,
            month: rentMonth,
            year: rentYear,
            rentAmount: totalRent,
            paidAmount: amount,
            paidDate,
            paymentMode: rentForm.paymentMode,
            status: amount >= totalRent ? 'paid' : 'partial'
          });
        }
      }

      if (addType === 'electricity') {
        const currentReading = Number(electricityForm.currentReading);
        if (!selectedElectricityRow) {
          throw new Error('Select a unit.');
        }
        if (!currentReading || currentReading <= Number(selectedElectricityRow.lastReading || 0)) {
          throw new Error(`Current reading must be greater than ${selectedElectricityRow.lastReading || 0}.`);
        }
        if (
          selectedElectricityRow.nextReading != null &&
          currentReading > Number(selectedElectricityRow.nextReading)
        ) {
          throw new Error(`Current reading cannot exceed next saved reading ${selectedElectricityRow.nextReading}.`);
        }
        const existingBillsRes = await api.get(`/properties/${formPropertyId}/utility-bills`, {
          params: {
            billType: 'electricity',
            month: electricityForm.month,
            unitId: electricityForm.unitId
          }
        });
        const existingBill = (existingBillsRes.data || [])[0];
        const payload = {
          unitId: electricityForm.unitId,
          billType: 'electricity',
          month: electricityForm.month,
          meterStart: Number(selectedElectricityRow.lastReading || 0),
          meterEnd: currentReading,
          unitsConsumed: currentReading - Number(selectedElectricityRow.lastReading || 0),
          status: electricityForm.status
        };
        if (existingBill?._id) {
          await api.patch(`/properties/${formPropertyId}/utility-bills/${existingBill._id}`, payload);
        } else {
          await api.post(`/properties/${formPropertyId}/utility-bills`, payload);
        }
      }

      if (addType === 'maintenance') {
        const amount = Number(maintenanceForm.amount);
        if (!maintenanceForm.category || !amount || amount <= 0) {
          throw new Error('Enter maintenance category and amount.');
        }
        await api.post(`/properties/${formPropertyId}/maintenance`, {
          date: maintenanceForm.date,
          category: maintenanceForm.category,
          description: maintenanceForm.description || undefined,
          amount,
          paidTo: maintenanceForm.paidTo || undefined
        });
      }

      if (addType === 'deposit') {
        const amount = Number(depositForm.amount);
        if (!selectedDepositTenant?._id || !amount || amount <= 0) {
          throw new Error('Select a tenant and enter a valid amount.');
        }
        await api.post(`/properties/${formPropertyId}/payments`, {
          type: depositForm.type,
          amount,
          date: depositForm.date,
          tenantId: selectedDepositTenant._id,
          unitId: selectedDepositTenant.assignedUnit?._id || undefined,
          notes:
            depositForm.notes ||
            (depositForm.type === 'refund' ? 'Security deposit returned' : 'Security deposit collected')
        });
      }

      if (addType === 'others') {
        const amount = Number(otherForm.amount);
        if (!amount || amount <= 0) {
          throw new Error('Enter a valid amount.');
        }
        await api.post(`/properties/${formPropertyId}/payments`, {
          type: 'other',
          amount,
          date: otherForm.date,
          notes: otherForm.notes || undefined
        });
      }

      closeAddPaymentModal();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || err?.message || 'Failed to add payment.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 overflow-x-auto pb-1">
        <div className="flex items-center gap-3 shrink-0">

          <select
            className="min-w-[200px] rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            value={tab}
            onChange={(e) => setTab(e.target.value as TabKey)}
          >
            <option value="all">All Payments</option>
            <option value="rent">Rent</option>
            <option value="electricity">Electricity Bills</option>
            <option value="maintenance">Maintenance</option>
            <option value="deposit">Deposit</option>
            <option value="others">Others</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <div className="min-w-[200px]">
            <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
          </div>
          <button
            type="button"
            className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 active:translate-y-0"
            onClick={() => setMonthFilter((prev) => shiftMonthValue(prev, -1))}
            aria-label="Previous transactions month"
          >
            ←
          </button>
          <input
            type="month"
            className="border border-black/10 rounded-lg px-3 py-2 text-sm min-w-[170px]"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          />
          <button
            type="button"
            className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 active:translate-y-0"
            onClick={() => setMonthFilter((prev) => shiftMonthValue(prev, 1))}
            aria-label="Next transactions month"
          >
            →
          </button>
          <button
            type="button"
            className="bg-[var(--accent)] text-white px-3.5 py-2 rounded-xl text-sm font-medium"
            onClick={() => setShowAddPayment(true)}
          >
            Add Payment
          </button>
        </div>
      </div>

      {tab === 'all' && (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-black/5">
              <tr>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {allTransactions.map((item) => (
                <tr key={item._id} className="border-b border-black/5">
                  <td className="px-4 py-3">{item.propertyName}</td>
                  <td className="px-4 py-3">{item.category}</td>
                  <td className="px-4 py-3">{item.details}</td>
                  <td className="px-4 py-3">{`\u20B9${item.amount}`}</td>
                  <td className="px-4 py-3">{formatDate(item.date)}</td>
                  <td className={`px-4 py-3 ${statusColor(item.status)}`}>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!allTransactions.length && <div className="px-4 py-6 text-[var(--muted)]">No transactions found.</div>}
        </div>
      )}

      {tab === 'rent' && (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-black/5">
              <tr>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Paid / Total</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRentRecords.map((record) => (
                <tr key={record._id} className="border-b border-black/5">
                  <td className="px-4 py-3">{getPropertyName(record, properties, propertyId)}</td>
                  <td className="px-4 py-3">{record.tenantId?.fullName}</td>
                  <td className="px-4 py-3">{record.unitId?.unitNumber}</td>
                  <td className="px-4 py-3">{formatMonthYear(record.month, record.year)}</td>
                  <td className="px-4 py-3">{`\u20B9${record.paidAmount || 0} / \u20B9${record.rentAmount}`}</td>
                  <td className="px-4 py-3">{`\u20B9${Math.max(0, (record.rentAmount || 0) - (record.paidAmount || 0))}`}</td>
                  <td className={`px-4 py-3 ${statusColor(record.status)}`}>{record.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredRentRecords.length && <div className="px-4 py-6 text-[var(--muted)]">No rent records found.</div>}
        </div>
      )}

      {tab === 'electricity' && (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-black/5">
              <tr>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Units</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {electricityBills.map((bill) => (
                <tr key={bill._id} className="border-b border-black/5">
                  <td className="px-4 py-3">{getPropertyName(bill, properties, propertyId)}</td>
                  <td className="px-4 py-3">{bill.unitId?.unitNumber || '-'}</td>
                  <td className="px-4 py-3">{formatMonthKey(bill.month)}</td>
                  <td className="px-4 py-3">{bill.unitsConsumed}</td>
                  <td className="px-4 py-3">₹{bill.amount}</td>
                  <td className={`px-4 py-3 ${statusColor(bill.status)}`}>{bill.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!electricityBills.length && (
            <div className="px-4 py-6 text-[var(--muted)]">No electricity bills found.</div>
          )}
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
            {(
              [
                { key: 'collected', label: 'Collected' },
                { key: 'spent', label: 'Spent' }
              ] as Array<{ key: MaintenanceView; label: string }>
            ).map((item) => (
              <button
                key={item.key}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  maintenanceView === item.key
                    ? 'bg-[var(--accent)] text-white border-transparent'
                    : 'border-black/10 text-[var(--muted)]'
                }`}
                onClick={() => setMaintenanceView(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {maintenanceView === 'collected' ? (
            <>
              <table className="w-full text-sm">
                <thead className="text-left border-b border-black/5">
                  <tr>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceCollectedPayments.map((payment) => (
                    <tr key={payment._id} className="border-b border-black/5">
                      <td className="px-4 py-3">{getPropertyName(payment, properties, propertyId)}</td>
                      <td className="px-4 py-3">{formatDate(payment.date)}</td>
                      <td className="px-4 py-3">{payment.tenantId?.fullName || '-'}</td>
                      <td className="px-4 py-3">{payment.unitId?.unitNumber || '-'}</td>
                      <td className="px-4 py-3">{`₹${payment.amount}`}</td>
                      <td className="px-4 py-3">{payment.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!maintenanceCollectedPayments.length && (
                <div className="px-4 py-6 text-[var(--muted)]">No maintenance collected found.</div>
              )}
            </>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="text-left border-b border-black/5">
                  <tr>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Paid To</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceSpentRows.map((record) => (
                    <tr key={record._id} className="border-b border-black/5">
                      <td className="px-4 py-3">{record.propertyName}</td>
                      <td className="px-4 py-3">{formatDate(record.date)}</td>
                      <td className="px-4 py-3">{record.category}</td>
                      <td className="px-4 py-3">{`₹${record.amount}`}</td>
                      <td className="px-4 py-3">{record.paidTo}</td>
                      <td className="px-4 py-3">{record.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!maintenanceSpentRows.length && (
                <div className="px-4 py-6 text-[var(--muted)]">No maintenance spent found.</div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'deposit' && (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-black/5">
              <tr>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {depositPayments.map((payment) => (
                <tr key={payment._id} className="border-b border-black/5">
                  <td className="px-4 py-3">{getPropertyName(payment, properties, propertyId)}</td>
                  <td className="px-4 py-3">{formatDate(payment.date)}</td>
                  <td className="px-4 py-3">{payment.tenantId?.fullName || '-'}</td>
                  <td className="px-4 py-3">{payment.unitId?.unitNumber || '-'}</td>
                  <td className="px-4 py-3">{payment.type}</td>
                  <td className="px-4 py-3">{`\u20B9${payment.amount}`}</td>
                  <td className="px-4 py-3">{payment.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!depositPayments.length && <div className="px-4 py-6 text-[var(--muted)]">No deposit activity found.</div>}
        </div>
      )}

      {tab === 'others' && (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-black/5">
              <tr>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {otherPayments.map((payment) => (
                <tr key={payment._id} className="border-b border-black/5">
                  <td className="px-4 py-3">{getPropertyName(payment, properties, propertyId)}</td>
                  <td className="px-4 py-3">{payment.type}</td>
                  <td className="px-4 py-3">₹{payment.amount}</td>
                  <td className="px-4 py-3">{formatDate(payment.date)}</td>
                  <td className="px-4 py-3">{payment.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!otherPayments.length && <div className="px-4 py-6 text-[var(--muted)]">No other transactions found.</div>}
        </div>
      )}

      {showAddPayment && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/25 backdrop-blur-md p-6">
          <div className="w-full max-w-3xl bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-sm text-[var(--muted)]">Add Payment</div>
                <div className="text-lg font-semibold">Record a transaction</div>
              </div>
              <button className="text-sm text-[var(--muted)]" onClick={closeAddPaymentModal}>
                Close
              </button>
            </div>

            <form className="space-y-5" onSubmit={submitAddPayment}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--muted)]">Payment Type</label>
                  <select
                    className="px-3 py-2 mt-1"
                    value={addType}
                    onChange={(e) => setAddType(e.target.value as typeof addType)}
                  >
                    <option value="rent">Rent</option>
                    <option value="electricity">Electricity Bills</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="deposit">Deposit</option>
                    <option value="others">Others</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Property</label>
                  <select
                    className="px-3 py-2 mt-1"
                    value={formPropertyId}
                    onChange={(e) => setFormPropertyId(e.target.value)}
                    required
                  >
                    <option value="">Select property</option>
                    {properties.map((property) => (
                      <option key={property._id} value={property._id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {addType === 'rent' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--muted)]">Tenant</label>
                    <select
                      className="px-3 py-2 mt-1"
                      value={rentForm.tenantId}
                      onChange={(e) => setRentForm((prev) => ({ ...prev, tenantId: e.target.value }))}
                      required
                    >
                      <option value="">Select tenant</option>
                      {formTenants.map((tenant) => (
                        <option key={tenant._id} value={tenant._id}>
                          {tenant.fullName}{tenant.assignedUnit?.unitNumber ? ` - Unit ${tenant.assignedUnit.unitNumber}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Month</label>
                    <input
                      type="month"
                      className="px-3 py-2 mt-1"
                      value={rentForm.month}
                      onChange={(e) => setRentForm((prev) => ({ ...prev, month: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Amount Received</label>
                    <input
                      className="px-3 py-2 mt-1"
                      value={rentForm.amount}
                      onChange={(e) => setRentForm((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder="Rent amount"
                      required
                    />
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      Remaining for {formatMonthKey(rentForm.month)}: ₹{rentRemainingAmount}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Payment Mode</label>
                    <select
                      className="px-3 py-2 mt-1"
                      value={rentForm.paymentMode}
                      onChange={(e) => setRentForm((prev) => ({ ...prev, paymentMode: e.target.value }))}
                    >
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                </div>
              )}

              {addType === 'electricity' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--muted)]">Unit</label>
                    <select
                      className="px-3 py-2 mt-1"
                      value={electricityForm.unitId}
                      onChange={(e) => setElectricityForm((prev) => ({ ...prev, unitId: e.target.value }))}
                      required
                    >
                      <option value="">Select unit</option>
                      {formUnits.map((unit) => (
                        <option key={unit._id} value={unit._id}>
                          {unit.unitNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Month</label>
                    <input
                      type="month"
                      className="px-3 py-2 mt-1"
                      value={electricityForm.month}
                      onChange={(e) => setElectricityForm((prev) => ({ ...prev, month: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Current Reading</label>
                    <input
                      className="px-3 py-2 mt-1"
                      value={electricityForm.currentReading}
                      onChange={(e) => setElectricityForm((prev) => ({ ...prev, currentReading: e.target.value }))}
                      placeholder="Current meter reading"
                      required
                    />
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      Amount due for {formatMonthKey(electricityForm.month)}: ₹{electricityAmountPreview}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Status</label>
                    <select
                      className="px-3 py-2 mt-1"
                      value={electricityForm.status}
                      onChange={(e) => setElectricityForm((prev) => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid</option>
                    </select>
                  </div>
                  {selectedElectricityRow && (
                    <div className="md:col-span-2 text-xs text-[var(--muted)]">
                      Last reading: {selectedElectricityRow.lastReading || 0}
                      {selectedElectricityRow.nextReading != null ? ` • Next saved reading: ${selectedElectricityRow.nextReading}` : ''}
                    </div>
                  )}
                </div>
              )}

              {addType === 'maintenance' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--muted)]">Date</label>
                    <input
                      type="date"
                      className="px-3 py-2 mt-1"
                      value={maintenanceForm.date}
                      onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Category</label>
                    <input
                      className="px-3 py-2 mt-1"
                      value={maintenanceForm.category}
                      onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, category: e.target.value }))}
                      placeholder="Repair, cleaning, plumbing..."
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Amount</label>
                    <input
                      className="px-3 py-2 mt-1"
                      value={maintenanceForm.amount}
                      onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder="Expense amount"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Paid To</label>
                    <input
                      className="px-3 py-2 mt-1"
                      value={maintenanceForm.paidTo}
                      onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, paidTo: e.target.value }))}
                      placeholder="Vendor or person"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-[var(--muted)]">Description</label>
                    <input
                      className="px-3 py-2 mt-1"
                      value={maintenanceForm.description}
                      onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Short note"
                    />
                  </div>
                </div>
              )}

              {addType === 'deposit' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--muted)]">Tenant</label>
                    <select
                      className="px-3 py-2 mt-1"
                      value={depositForm.tenantId}
                      onChange={(e) => setDepositForm((prev) => ({ ...prev, tenantId: e.target.value }))}
                      required
                    >
                      <option value="">Select tenant</option>
                      {formTenants.map((tenant) => (
                        <option key={tenant._id} value={tenant._id}>
                          {tenant.fullName}{tenant.assignedUnit?.unitNumber ? ` - Unit ${tenant.assignedUnit.unitNumber}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Deposit Type</label>
                    <select
                      className="px-3 py-2 mt-1"
                      value={depositForm.type}
                      onChange={(e) => setDepositForm((prev) => ({ ...prev, type: e.target.value }))}
                    >
                      <option value="deposit">Collected</option>
                      <option value="refund">Refunded</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Amount</label>
                    <input
                      className="px-3 py-2 mt-1"
                      value={depositForm.amount}
                      onChange={(e) => setDepositForm((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder="Deposit amount"
                      required
                    />
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {depositForm.type === 'refund' ? 'Refundable deposit' : 'Remaining deposit'}: ₹{depositRemainingAmount}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Date</label>
                    <input
                      type="date"
                      className="px-3 py-2 mt-1"
                      value={depositForm.date}
                      onChange={(e) => setDepositForm((prev) => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-[var(--muted)]">Notes</label>
                    <input
                      className="px-3 py-2 mt-1"
                      value={depositForm.notes}
                      onChange={(e) => setDepositForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Optional note"
                    />
                  </div>
                </div>
              )}

              {addType === 'others' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--muted)]">Amount</label>
                    <input
                      className="px-3 py-2 mt-1"
                      value={otherForm.amount}
                      onChange={(e) => setOtherForm((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder="Amount"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Date</label>
                    <input
                      type="date"
                      className="px-3 py-2 mt-1"
                      value={otherForm.date}
                      onChange={(e) => setOtherForm((prev) => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-[var(--muted)]">Notes</label>
                    <input
                      className="px-3 py-2 mt-1"
                      value={otherForm.notes}
                      onChange={(e) => setOtherForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Describe this payment"
                    />
                  </div>
                </div>
              )}

              {formError && <div className="text-sm text-[var(--danger)]">{formError}</div>}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-medium"
                  disabled={formLoading}
                >
                  {formLoading ? 'Saving...' : 'Save Payment'}
                </button>
                <button
                  type="button"
                  className="text-sm text-[var(--muted)]"
                  onClick={closeAddPaymentModal}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Transactions;



