import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import Badge, { type BadgeTone } from '../components/Badge';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { CloseIcon, EyeIcon, TransactionsIcon } from '../components/icons';
import { formatDate, formatMonthKey, formatMonthYear, getCurrentDateValue, getCurrentMonthValue, shiftMonthValue } from '../lib/dateFormat';
import { cachedGet, invalidateByTag, isCached, useCachedQuery } from '../lib/queryCache';
import { toast } from '../lib/toast';
import { formatCurrency } from '../lib/format';
import FieldError from '../components/FieldError';
import DatePicker from '../components/DatePicker';
import ReceiptModal from '../components/ReceiptModal';
import {
  buildDepositReceipt,
  buildMaintenanceCollectedReceipt,
  buildMaintenanceExpenseReceipt,
  buildOtherPaymentReceipt,
  buildRentReceipt,
  buildUtilityBillReceipt,
  type ReceiptData
} from '../lib/receipt';
import { isBlank, isPositiveNumber, requiredMsg, type FieldErrors } from '../lib/validation';

type TabKey = 'all' | 'rent' | 'electricity' | 'maintenance' | 'deposit' | 'others';
type MaintenanceView = 'collected' | 'spent';

const statusTone = (status: string): BadgeTone => {
  if (status === 'paid') return 'success';
  if (status === 'partial') return 'warning';
  return 'danger';
};

const getPropertyName = (item: any, properties: any[], propertyId: string) =>
  item._propertyName || properties.find((property) => property._id === propertyId)?.name || '-';

const getPropertyAddress = (item: any, properties: any[], propertyId: string) =>
  properties.find((property) => property._id === (item._propertyId || propertyId))?.address;

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

const getMonthDateRange = (monthValue: string) => {
  const [year, month] = monthValue.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
};

const Transactions = () => {
  const { data: propertiesData, loading: propertiesLoading } = useCachedQuery<any[]>('/properties');
  const properties = propertiesData || [];
  const [propertyId, setPropertyId] = useState('');
  const [tab, setTab] = useState<TabKey>('all');
  const [maintenanceView, setMaintenanceView] = useState<MaintenanceView>('collected');
  const [monthFilter, setMonthFilter] = useState(getCurrentMonthValue());
  const [rentRecords, setRentRecords] = useState<any[]>([]);
  const [utilityBills, setUtilityBills] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [addType, setAddType] = useState<'rent' | 'electricity' | 'maintenance' | 'deposit' | 'others'>('rent');
  const [formPropertyId, setFormPropertyId] = useState('');
  const [formUnits, setFormUnits] = useState<any[]>([]);
  const [formTenants, setFormTenants] = useState<any[]>([]);
  const [electricityRows, setElectricityRows] = useState<any[]>([]);
  const [formLoading, setFormLoading] = useState(false);
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
    notes: '',
    direction: 'in' as 'in' | 'out'
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const clearError = (key: string) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const selectedRentTenant = formTenants.find((tenant) => tenant._id === rentForm.tenantId);
  const selectedDepositTenant = formTenants.find((tenant) => tenant._id === depositForm.tenantId);
  const selectedElectricityRow = electricityRows.find((row) => String(row.unitId) === String(electricityForm.unitId));

  const [year, month] = monthFilter.split('-').map(Number);
  const { startDate, endDate } = getMonthDateRange(monthFilter);

  const loadTransactions = async (options?: { force?: boolean }) => {
    const targets = propertyId ? [{ _id: propertyId, name: '' }] : properties;
    if (options?.force) {
      targets.forEach((property) => {
        invalidateByTag('rentRecord', property._id);
        invalidateByTag('utilityBill', property._id);
        invalidateByTag('maintenance', property._id);
        invalidateByTag('payment', property._id);
      });
    }

    const allCached = targets.every(
      (property) =>
        isCached(`/properties/${property._id}/rent-records`, { month, year }) &&
        isCached(`/properties/${property._id}/utility-bills`, { month: monthFilter }) &&
        isCached(`/properties/${property._id}/maintenance`, { month: monthFilter }) &&
        isCached(`/properties/${property._id}/payments`, { startDate, endDate })
    );
    if (!allCached) setDataLoading(true);

    try {
      if (propertyId) {
        const [rentData, utilityData, maintenanceData, paymentsData] = await Promise.all([
          cachedGet(`/properties/${propertyId}/rent-records`, { month, year }),
          cachedGet(`/properties/${propertyId}/utility-bills`, { month: monthFilter }),
          cachedGet(`/properties/${propertyId}/maintenance`, { month: monthFilter }),
          cachedGet(`/properties/${propertyId}/payments`, { startDate, endDate })
        ]);
        setRentRecords(rentData || []);
        setUtilityBills(utilityData || []);
        setMaintenance(maintenanceData || []);
        setPayments(paymentsData || []);
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
            cachedGet(`/properties/${property._id}/rent-records`, { month, year }),
            cachedGet(`/properties/${property._id}/utility-bills`, { month: monthFilter }),
            cachedGet(`/properties/${property._id}/maintenance`, { month: monthFilter }),
            cachedGet(`/properties/${property._id}/payments`, { startDate, endDate })
          ])
        )
      );

      setRentRecords(
        responses.flatMap((result, index) =>
          (result[0] || []).map((record: any) => ({
            ...record,
            _propertyName: properties[index].name,
            _propertyId: properties[index]._id
          }))
        )
      );
      setUtilityBills(
        responses.flatMap((result, index) =>
          (result[1] || []).map((bill: any) => ({
            ...bill,
            _propertyName: properties[index].name,
            _propertyId: properties[index]._id
          }))
        )
      );
      setMaintenance(
        responses.flatMap((result, index) =>
          (result[2] || []).map((record: any) => ({
            ...record,
            _propertyName: properties[index].name,
            _propertyId: properties[index]._id
          }))
        )
      );
      setPayments(
        responses.flatMap((result, index) =>
          (result[3] || []).map((payment: any) => ({
            ...payment,
            _propertyName: properties[index].name,
            _propertyId: properties[index]._id
          }))
        )
      );
    } finally {
      setDataLoading(false);
    }
  };

  const scopeKey = `${propertyId}::${monthFilter}`;
  const [renderedScopeKey, setRenderedScopeKey] = useState(scopeKey);
  if (scopeKey !== renderedScopeKey) {
    setRenderedScopeKey(scopeKey);
    setRentRecords([]);
    setUtilityBills([]);
    setMaintenance([]);
    setPayments([]);
    setDataLoading(true);
  }

  useEffect(() => {
    if (propertiesLoading) return;
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, properties.length, monthFilter, propertiesLoading]);

  useEffect(() => {
    if (!showAddPayment) return;
    setFormPropertyId(propertyId || '');
    setAddType('rent');
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
      notes: '',
      direction: 'in'
    });
    setErrors({});
  }, [showAddPayment, propertyId, monthFilter]);

  useEffect(() => {
    if (!showAddPayment || !formPropertyId) {
      setFormUnits([]);
      setFormTenants([]);
      setElectricityRows([]);
      return;
    }

    const loadFormData = async () => {
      const [unitsData, tenantsData] = await Promise.all([
        cachedGet(`/properties/${formPropertyId}/units`, { archived: false }),
        cachedGet(`/properties/${formPropertyId}/tenants`, {})
      ]);
      setFormUnits(unitsData || []);
      setFormTenants(tenantsData || []);
    };

    loadFormData();
  }, [showAddPayment, formPropertyId]);

  const rentEligibleTenants = useMemo(() => {
    const [selYear, selMonth] = rentForm.month.split('-').map(Number);
    if (!selYear || !selMonth) return formTenants;
    const monthStart = new Date(selYear, selMonth - 1, 1);
    const monthEnd = new Date(selYear, selMonth, 0, 23, 59, 59, 999);
    return formTenants.filter((tenant) => {
      const movedIn = tenant.movedInDate ? new Date(tenant.movedInDate) : null;
      const movedOut = tenant.movedOutDate ? new Date(tenant.movedOutDate) : null;
      if (movedIn && movedIn > monthEnd) return false;
      if (movedOut && movedOut < monthStart) return false;
      return true;
    });
  }, [formTenants, rentForm.month]);

  const activeFormTenants = useMemo(() => formTenants.filter((tenant) => tenant.isActive), [formTenants]);

  useEffect(() => {
    if (rentForm.tenantId && !rentEligibleTenants.some((tenant) => tenant._id === rentForm.tenantId)) {
      setRentForm((prev) => ({ ...prev, tenantId: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentEligibleTenants]);

  useEffect(() => {
    if (!showAddPayment || !formPropertyId || addType !== 'electricity') {
      setElectricityRows([]);
      return;
    }

    const loadElectricityRows = async () => {
      const data = await cachedGet(`/properties/${formPropertyId}/utility-bills/electricity-readings`, { month: electricityForm.month });
      setElectricityRows(
        (data?.rows || []).map((row: any) => ({
          ...row,
          electricityUnitRate: data?.rates?.electricityUnitRate || 0,
          commonElectricityCharge: data?.rates?.commonElectricityCharge || 0
        }))
      );
    };

    loadElectricityRows();
  }, [showAddPayment, formPropertyId, addType, electricityForm.month]);

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
      const data = await cachedGet(`/properties/${formPropertyId}/rent-records`, { month: rentMonth, year: rentYear });
      const existingRecord = (data || []).find(
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
      const data = await cachedGet(`/properties/${formPropertyId}/tenants/${depositForm.tenantId}/details`);
      const tenant = data?.tenant;
      const tenantPayments = data?.payments || [];
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
    return utilityBills.filter((bill) => String(bill.billType).toLowerCase().includes('electric'));
  }, [utilityBills]);

  const filteredRentRecords = rentRecords;
  const filteredMaintenance = maintenance;

  const maintenanceCollectedPayments = useMemo(() => {
    return payments.filter(
      (payment) => payment.type === 'maintenance' && String(payment.notes || '').toLowerCase().includes('maintenance collected')
    );
  }, [payments]);

  const maintenanceSpentPayments = useMemo(() => {
    return payments.filter(
      (payment) => payment.type === 'maintenance' && !String(payment.notes || '').toLowerCase().includes('maintenance collected')
    );
  }, [payments]);

  const otherPayments = useMemo(() => {
    return payments.filter((payment) => !['rent', 'utility', 'maintenance', 'deposit', 'refund'].includes(payment.type));
  }, [payments]);
  const depositPayments = useMemo(() => {
    return payments.filter((payment) => ['deposit', 'refund'].includes(payment.type));
  }, [payments]);
  const maintenanceSpentRows = useMemo(() => {
    const expenseRows = filteredMaintenance.map((record) => ({
      _id: `expense-${record._id}`,
      propertyName: getPropertyName(record, properties, propertyId),
      propertyAddress: getPropertyAddress(record, properties, propertyId),
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
      propertyAddress: getPropertyAddress(payment, properties, propertyId),
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
      _kind: 'rent' as const,
      _original: record,
      propertyName: getPropertyName(record, properties, propertyId),
      propertyAddress: getPropertyAddress(record, properties, propertyId),
      category: 'Rent',
      details: `${record.tenantId?.fullName || 'Tenant'} • Unit ${record.unitId?.unitNumber || '-'}`,
      amount: record.paidAmount || record.rentAmount || 0,
      date: record.paidDate || new Date(record.year, Math.max(0, Number(record.month) - 1), 1).toISOString(),
      status: record.status
    }));

    const electricityItems = electricityBills.map((bill) => ({
      _id: `utility-${bill._id}`,
      _kind: 'electricity' as const,
      _original: bill,
      propertyName: getPropertyName(bill, properties, propertyId),
      propertyAddress: getPropertyAddress(bill, properties, propertyId),
      category: 'Electricity',
      details: `Unit ${bill.unitId?.unitNumber || '-'} • ${formatMonthKey(bill.month)}`,
      amount: bill.amount || 0,
      date: bill.updatedAt || bill.createdAt || new Date(`${bill.month}-01`).toISOString(),
      status: bill.status
    }));

    const maintenanceItems = filteredMaintenance.map((record) => ({
      _id: `maintenance-${record._id}`,
      _kind: 'maintenanceExpense' as const,
      _original: record,
      propertyName: getPropertyName(record, properties, propertyId),
      propertyAddress: getPropertyAddress(record, properties, propertyId),
      category: 'Maintenance Spent',
      details: `${record.category || 'Expense'}${record.paidTo ? ` - ${record.paidTo}` : ''}`,
      amount: record.amount || 0,
      date: record.date,
      status: 'paid'
    }));

    const maintenancePaymentItems = [...maintenanceCollectedPayments, ...maintenanceSpentPayments].map((payment) => {
      const isCollected = String(payment.notes || '').toLowerCase().includes('maintenance collected');
      return {
        _id: `payment-maintenance-${payment._id}`,
        _kind: isCollected ? 'maintenanceCollected' : 'maintenanceSpentPayment',
        _original: payment,
        propertyName: getPropertyName(payment, properties, propertyId),
        propertyAddress: getPropertyAddress(payment, properties, propertyId),
        category: isCollected ? 'Maintenance Collected' : 'Maintenance Spent',
        details:
          payment.notes ||
          `${payment.tenantId?.fullName || '-'}${payment.unitId?.unitNumber ? ` - ${payment.unitId.unitNumber}` : ''}`,
        amount: payment.amount || 0,
        date: payment.date,
        status: 'paid'
      };
    });

    const paymentItems = [...depositPayments, ...otherPayments].map((payment) => ({
      _id: `payment-${payment._id}`,
      _kind: payment.type === 'deposit' || payment.type === 'refund' ? payment.type : 'other',
      _original: payment,
      propertyName: getPropertyName(payment, properties, propertyId),
      propertyAddress: getPropertyAddress(payment, properties, propertyId),
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
    setFormLoading(false);
    setErrors({});
  };

  const validateAddPayment = () => {
    const next: FieldErrors = {};
    if (isBlank(formPropertyId)) next.formPropertyId = requiredMsg('Property');

    if (addType === 'rent') {
      if (isBlank(rentForm.tenantId)) next.tenantId = requiredMsg('Tenant');
      if (isBlank(rentForm.month)) next.month = requiredMsg('Month');
      if (!isPositiveNumber(rentForm.amount)) next.amount = 'Enter a valid rent amount';
      else if (rentRemainingAmount > 0 && Number(rentForm.amount) > rentRemainingAmount) {
        next.amount = `Cannot exceed remaining rent of ₹${formatCurrency(rentRemainingAmount)}`;
      }
    }

    if (addType === 'electricity') {
      if (isBlank(electricityForm.unitId)) next.unitId = requiredMsg('Unit');
      if (isBlank(electricityForm.month)) next.month = requiredMsg('Month');
      const currentReading = Number(electricityForm.currentReading);
      if (isBlank(electricityForm.currentReading)) {
        next.currentReading = requiredMsg('Current reading');
      } else if (selectedElectricityRow && currentReading <= Number(selectedElectricityRow.lastReading || 0)) {
        next.currentReading = `Must be greater than ${selectedElectricityRow.lastReading || 0}`;
      } else if (selectedElectricityRow?.nextReading != null && currentReading > Number(selectedElectricityRow.nextReading)) {
        next.currentReading = `Cannot exceed next saved reading ${selectedElectricityRow.nextReading}`;
      }
    }

    if (addType === 'maintenance') {
      if (isBlank(maintenanceForm.date)) next.date = requiredMsg('Date');
      if (isBlank(maintenanceForm.category)) next.category = requiredMsg('Category');
      if (!isPositiveNumber(maintenanceForm.amount)) next.amount = 'Enter a valid amount';
    }

    if (addType === 'deposit') {
      if (isBlank(depositForm.tenantId)) next.tenantId = requiredMsg('Tenant');
      if (!isPositiveNumber(depositForm.amount)) next.amount = 'Enter a valid amount';
      if (isBlank(depositForm.date)) next.date = requiredMsg('Date');
    }

    if (addType === 'others') {
      if (!isPositiveNumber(otherForm.amount)) next.amount = 'Enter a valid amount';
      if (isBlank(otherForm.date)) next.date = requiredMsg('Date');
    }

    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const submitAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddPayment()) return;

    setFormLoading(true);
    try {
      if (addType === 'rent') {
        if (!selectedRentTenant?.assignedUnit?._id) {
          throw new Error('Select a tenant with an assigned unit.');
        }
        const amount = Number(rentForm.amount);
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
            throw new Error(`Amount cannot exceed remaining rent of ₹${formatCurrency(remaining)}.`);
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
        await api.post(`/properties/${formPropertyId}/maintenance`, {
          date: maintenanceForm.date,
          category: maintenanceForm.category,
          description: maintenanceForm.description || undefined,
          amount,
          paidTo: maintenanceForm.paidTo || undefined
        });
      }

      if (addType === 'deposit') {
        if (!selectedDepositTenant?._id) {
          throw new Error('Select a tenant.');
        }
        const amount = Number(depositForm.amount);
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
        await api.post(`/properties/${formPropertyId}/payments`, {
          type: 'other',
          amount,
          date: otherForm.date,
          notes: otherForm.notes || undefined,
          direction: otherForm.direction
        });
      }

      invalidateByTag('rentRecord', formPropertyId);
      invalidateByTag('utilityBill', formPropertyId);
      invalidateByTag('maintenance', formPropertyId);
      invalidateByTag('payment', formPropertyId);
      closeAddPaymentModal();
      await loadTransactions();
      toast.success('Payment recorded.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to add payment.');
    } finally {
      setFormLoading(false);
    }
  };

  const statusFilterOptions = [
    { value: 'paid', label: 'Paid' },
    { value: 'partial', label: 'Partial' },
    { value: 'unpaid', label: 'Unpaid' }
  ];

  // Every tab dispatches through these same shared builders (desktop/src/lib/receipt.ts)
  // so a receipt for a given record looks identical no matter which page it's viewed from.
  const dispatchAllRowReceipt = (item: any): ReceiptData => {
    const propertyName = item.propertyName;
    const propertyAddress = item.propertyAddress;
    switch (item._kind) {
      case 'rent':
        return buildRentReceipt(item._original, propertyName, propertyAddress);
      case 'electricity':
        return buildUtilityBillReceipt(item._original, propertyName, propertyAddress);
      case 'maintenanceExpense':
        return buildMaintenanceExpenseReceipt(item._original, propertyName, propertyAddress);
      case 'maintenanceCollected':
        return buildMaintenanceCollectedReceipt(item._original, propertyName, propertyAddress);
      case 'maintenanceSpentPayment':
        return buildMaintenanceExpenseReceipt({ ...item._original, category: 'Maintenance Spent' }, propertyName, propertyAddress);
      case 'deposit':
      case 'refund':
        return buildDepositReceipt(item._original, propertyName, propertyAddress);
      default:
        return buildOtherPaymentReceipt(item._original, propertyName, propertyAddress);
    }
  };

  const viewColumn = (onView: (item: any) => void): TableColumn<any> => ({
    key: 'view',
    label: '',
    sortable: false,
    render: (item) => (
      <button
        type="button"
        className="icon-btn h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          onView(item);
        }}
        title="View Receipt"
      >
        <EyeIcon width={15} height={15} />
      </button>
    )
  });

  const allTransactionColumns: TableColumn<any>[] = [
    { key: 'propertyName', label: 'Property', accessor: (item) => item.propertyName },
    {
      key: 'category',
      label: 'Category',
      accessor: (item) => item.category,
      filterOptions: [
        { value: 'Rent', label: 'Rent' },
        { value: 'Electricity', label: 'Electricity' },
        { value: 'Maintenance Collected', label: 'Maintenance Collected' },
        { value: 'Maintenance Spent', label: 'Maintenance Spent' },
        { value: 'Deposit', label: 'Deposit' },
        { value: 'Deposit Refund', label: 'Deposit Refund' },
        { value: 'Others', label: 'Others' }
      ]
    },
    { key: 'details', label: 'Details', accessor: (item) => item.details },
    { key: 'amount', label: 'Amount', accessor: (item) => item.amount, render: (item) => `₹${formatCurrency(item.amount)}` },
    { key: 'date', label: 'Date', accessor: (item) => new Date(item.date).getTime(), render: (item) => formatDate(item.date) },
    {
      key: 'status',
      label: 'Status',
      accessor: (item) => item.status,
      filterOptions: statusFilterOptions,
      render: (item) => <Badge tone={statusTone(item.status)}>{item.status}</Badge>
    },
    viewColumn((item) => setReceipt(dispatchAllRowReceipt(item)))
  ];

  const rentTabColumns: TableColumn<any>[] = [
    { key: 'propertyName', label: 'Property', accessor: (record) => getPropertyName(record, properties, propertyId) },
    { key: 'tenant', label: 'Tenant', accessor: (record) => record.tenantId?.fullName || '-' },
    { key: 'unit', label: 'Unit', accessor: (record) => record.unitId?.unitNumber || '-' },
    { key: 'month', label: 'Month', accessor: (record) => record.year * 100 + record.month, render: (record) => formatMonthYear(record.month, record.year) },
    {
      key: 'paidTotal',
      label: 'Paid / Total',
      accessor: (record) => record.paidAmount || 0,
      render: (record) => `₹${formatCurrency(record.paidAmount || 0)} / ₹${formatCurrency(record.rentAmount)}`
    },
    {
      key: 'remaining',
      label: 'Remaining',
      accessor: (record) => Math.max(0, (record.rentAmount || 0) - (record.paidAmount || 0)),
      render: (record) => `₹${formatCurrency(Math.max(0, (record.rentAmount || 0) - (record.paidAmount || 0)))}`
    },
    {
      key: 'status',
      label: 'Status',
      accessor: (record) => record.status,
      filterOptions: statusFilterOptions,
      render: (record) => <Badge tone={statusTone(record.status)}>{record.status}</Badge>
    },
    viewColumn((record) =>
      setReceipt(buildRentReceipt(record, getPropertyName(record, properties, propertyId), getPropertyAddress(record, properties, propertyId)))
    )
  ];

  const electricityTabColumns: TableColumn<any>[] = [
    { key: 'propertyName', label: 'Property', accessor: (bill) => getPropertyName(bill, properties, propertyId) },
    { key: 'unit', label: 'Unit', accessor: (bill) => bill.unitId?.unitNumber || '-' },
    { key: 'month', label: 'Month', accessor: (bill) => bill.month, render: (bill) => formatMonthKey(bill.month) },
    { key: 'units', label: 'Units', accessor: (bill) => bill.unitsConsumed },
    { key: 'amount', label: 'Amount', accessor: (bill) => bill.amount, render: (bill) => `₹${formatCurrency(bill.amount)}` },
    {
      key: 'status',
      label: 'Status',
      accessor: (bill) => bill.status,
      filterOptions: statusFilterOptions,
      render: (bill) => <Badge tone={statusTone(bill.status)}>{bill.status}</Badge>
    },
    viewColumn((bill) =>
      setReceipt(buildUtilityBillReceipt(bill, getPropertyName(bill, properties, propertyId), getPropertyAddress(bill, properties, propertyId)))
    )
  ];

  const maintenanceCollectedColumns: TableColumn<any>[] = [
    { key: 'propertyName', label: 'Property', accessor: (payment) => getPropertyName(payment, properties, propertyId) },
    { key: 'date', label: 'Date', accessor: (payment) => new Date(payment.date).getTime(), render: (payment) => formatDate(payment.date) },
    { key: 'tenant', label: 'Tenant', accessor: (payment) => payment.tenantId?.fullName || '-' },
    { key: 'unit', label: 'Unit', accessor: (payment) => payment.unitId?.unitNumber || '-' },
    { key: 'amount', label: 'Amount', accessor: (payment) => payment.amount, render: (payment) => `₹${formatCurrency(payment.amount)}` },
    { key: 'notes', label: 'Notes', accessor: (payment) => payment.notes || '-' },
    viewColumn((payment) =>
      setReceipt(
        buildMaintenanceCollectedReceipt(payment, getPropertyName(payment, properties, propertyId), getPropertyAddress(payment, properties, propertyId))
      )
    )
  ];

  const maintenanceSpentColumns: TableColumn<any>[] = [
    { key: 'propertyName', label: 'Property', accessor: (record) => record.propertyName },
    { key: 'date', label: 'Date', accessor: (record) => new Date(record.date).getTime(), render: (record) => formatDate(record.date) },
    { key: 'category', label: 'Category', accessor: (record) => record.category },
    { key: 'amount', label: 'Amount', accessor: (record) => record.amount, render: (record) => `₹${formatCurrency(record.amount)}` },
    { key: 'paidTo', label: 'Paid To', accessor: (record) => record.paidTo },
    { key: 'notes', label: 'Notes', accessor: (record) => record.notes },
    viewColumn((record) => setReceipt(buildMaintenanceExpenseReceipt(record, record.propertyName, record.propertyAddress)))
  ];

  const depositTabColumns: TableColumn<any>[] = [
    { key: 'propertyName', label: 'Property', accessor: (payment) => getPropertyName(payment, properties, propertyId) },
    { key: 'date', label: 'Date', accessor: (payment) => new Date(payment.date).getTime(), render: (payment) => formatDate(payment.date) },
    { key: 'tenant', label: 'Tenant', accessor: (payment) => payment.tenantId?.fullName || '-' },
    { key: 'unit', label: 'Unit', accessor: (payment) => payment.unitId?.unitNumber || '-' },
    {
      key: 'type',
      label: 'Type',
      accessor: (payment) => payment.type,
      filterOptions: [
        { value: 'deposit', label: 'Deposit' },
        { value: 'refund', label: 'Refund' }
      ]
    },
    { key: 'amount', label: 'Amount', accessor: (payment) => payment.amount, render: (payment) => `₹${formatCurrency(payment.amount)}` },
    { key: 'notes', label: 'Notes', accessor: (payment) => payment.notes || '-' },
    viewColumn((payment) =>
      setReceipt(buildDepositReceipt(payment, getPropertyName(payment, properties, propertyId), getPropertyAddress(payment, properties, propertyId)))
    )
  ];

  const othersTabColumns: TableColumn<any>[] = [
    { key: 'propertyName', label: 'Property', accessor: (payment) => getPropertyName(payment, properties, propertyId) },
    { key: 'type', label: 'Type', accessor: (payment) => payment.type },
    {
      key: 'direction',
      label: 'Direction',
      accessor: (payment) => payment.direction === 'out' ? 'out' : 'in',
      filterOptions: [
        { value: 'in', label: 'Cash In' },
        { value: 'out', label: 'Cash Out' }
      ],
      render: (payment) => (
        <Badge tone={payment.direction === 'out' ? 'danger' : 'success'}>
          {payment.direction === 'out' ? 'Cash Out' : 'Cash In'}
        </Badge>
      )
    },
    { key: 'amount', label: 'Amount', accessor: (payment) => payment.amount, render: (payment) => `₹${formatCurrency(payment.amount)}` },
    { key: 'date', label: 'Date', accessor: (payment) => new Date(payment.date).getTime(), render: (payment) => formatDate(payment.date) },
    { key: 'notes', label: 'Notes', accessor: (payment) => payment.notes || '-' },
    viewColumn((payment) =>
      setReceipt(
        buildOtherPaymentReceipt(payment, getPropertyName(payment, properties, propertyId), getPropertyAddress(payment, properties, propertyId))
      )
    )
  ];

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
            className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={() => setMonthFilter((prev) => shiftMonthValue(prev, -1))}
            aria-label="Previous transactions month"
          >
            ←
          </button>
          <DatePicker
            picker="month"
            className="w-[170px] px-3 py-2 rounded-xl border border-black/10"
            value={monthFilter}
            onChange={(next) => setMonthFilter(next)}
          />
          <button
            type="button"
            className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={() => setMonthFilter((prev) => shiftMonthValue(prev, 1))}
            aria-label="Next transactions month"
          >
            →
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setErrors({});
              setShowAddPayment(true);
            }}
          >
            Add Payment
          </button>
        </div>
      </div>

      {tab === 'all' && (
        <SortableTable
          columns={allTransactionColumns}
          data={allTransactions}
          rowKey={(item) => item._id}
          searchPlaceholder="Search by property, category, details..."
          emptyIcon={<TransactionsIcon width={22} height={22} />}
          emptyTitle="No transactions found"
          emptyDescription="Payments across rent, utilities, maintenance, and deposits will show up here."
          loading={dataLoading}
        />
      )}

      {tab === 'rent' && (
        <SortableTable
          columns={rentTabColumns}
          data={filteredRentRecords}
          rowKey={(record) => record._id}
          searchPlaceholder="Search by tenant, unit, property..."
          emptyIcon={<TransactionsIcon width={22} height={22} />}
          emptyTitle="No rent records found"
          emptyDescription="Rent records for the selected property and filters will appear here."
          loading={dataLoading}
        />
      )}

      {tab === 'electricity' && (
        <SortableTable
          columns={electricityTabColumns}
          data={electricityBills}
          rowKey={(bill) => bill._id}
          searchPlaceholder="Search by property, unit..."
          emptyIcon={<TransactionsIcon width={22} height={22} />}
          emptyTitle="No electricity bills found"
          emptyDescription="Bills generated from meter readings will appear here."
          loading={dataLoading}
        />
      )}

      {tab === 'maintenance' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
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
            <SortableTable
              columns={maintenanceCollectedColumns}
              data={maintenanceCollectedPayments}
              rowKey={(payment) => payment._id}
              searchPlaceholder="Search by property, tenant, unit..."
              emptyIcon={<TransactionsIcon width={22} height={22} />}
              emptyTitle="No maintenance collected found"
              emptyDescription="Maintenance payments collected from tenants will appear here."
              loading={dataLoading}
            />
          ) : (
            <SortableTable
              columns={maintenanceSpentColumns}
              data={maintenanceSpentRows}
              rowKey={(record) => record._id}
              searchPlaceholder="Search by property, category, paid to..."
              emptyIcon={<TransactionsIcon width={22} height={22} />}
              emptyTitle="No maintenance spent found"
              emptyDescription="Maintenance expenses logged for this property will appear here."
              loading={dataLoading}
            />
          )}
        </div>
      )}

      {tab === 'deposit' && (
        <SortableTable
          columns={depositTabColumns}
          data={depositPayments}
          rowKey={(payment) => payment._id}
          searchPlaceholder="Search by property, tenant, unit..."
          emptyIcon={<TransactionsIcon width={22} height={22} />}
          emptyTitle="No deposit activity found"
          emptyDescription="Deposit collections and refunds will appear here."
          loading={dataLoading}
        />
      )}

      {tab === 'others' && (
        <SortableTable
          columns={othersTabColumns}
          data={otherPayments}
          rowKey={(payment) => payment._id}
          searchPlaceholder="Search by property, type, notes..."
          emptyIcon={<TransactionsIcon width={22} height={22} />}
          emptyTitle="No other transactions found"
          emptyDescription="Miscellaneous income and refunds will appear here."
          loading={dataLoading}
        />
      )}

      {showAddPayment && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/25 backdrop-blur-md p-6">
          <div className="w-full max-w-3xl bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-sm text-[var(--muted)]">Add Payment</div>
                <div className="text-lg font-semibold">Record a transaction</div>
              </div>
              <button className="modal-close-btn" onClick={closeAddPaymentModal} aria-label="Close">
                <CloseIcon width={18} height={18} />
              </button>
            </div>

            <form className="space-y-5" onSubmit={submitAddPayment} noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--muted)]">Payment Type</label>
                  <select
                    className="w-full px-3 py-2 mt-1"
                    value={addType}
                    onChange={(e) => {
                      setAddType(e.target.value as typeof addType);
                      setErrors({});
                    }}
                  >
                    <option value="rent">Rent</option>
                    <option value="electricity">Electricity Bills</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="deposit">Deposit</option>
                    <option value="others">Others</option>
                  </select>
                </div>
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">Property</label>
                  <select
                    className={`w-full px-3 py-2 mt-1 ${errors.formPropertyId ? 'input-error' : ''}`}
                    value={formPropertyId}
                    onChange={(e) => {
                      setFormPropertyId(e.target.value);
                      clearError('formPropertyId');
                    }}
                  >
                    <option value="">Select property</option>
                    {properties.map((property) => (
                      <option key={property._id} value={property._id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.formPropertyId} />
                </div>
              </div>

              {addType === 'rent' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Tenant</label>
                    <select
                      className={`w-full px-3 py-2 mt-1 ${errors.tenantId ? 'input-error' : ''}`}
                      value={rentForm.tenantId}
                      onChange={(e) => {
                        setRentForm((prev) => ({ ...prev, tenantId: e.target.value }));
                        clearError('tenantId');
                      }}
                    >
                      <option value="">Select tenant</option>
                      {rentEligibleTenants.map((tenant) => (
                        <option key={tenant._id} value={tenant._id}>
                          {tenant.fullName}{tenant.assignedUnit?.unitNumber ? ` - Unit ${tenant.assignedUnit.unitNumber}` : ''}{!tenant.isActive ? ' (moved out)' : ''}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors.tenantId} />
                    {formPropertyId && !rentEligibleTenants.length && (
                      <div className="mt-1 text-xs text-[var(--muted)]">No tenant occupied a unit here during this month.</div>
                    )}
                  </div>
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Month</label>
                    <DatePicker
                      picker="month"
                      className={`w-full px-3 py-2 mt-1 rounded-xl border border-black/10 ${errors.month ? 'input-error' : ''}`}
                      value={rentForm.month}
                      onChange={(next) => {
                        setRentForm((prev) => ({ ...prev, month: next }));
                        clearError('month');
                      }}
                    />
                    <FieldError message={errors.month} />
                  </div>
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Amount Received</label>
                    <input
                      className={`w-full px-3 py-2 mt-1 ${errors.amount ? 'input-error' : ''}`}
                      value={rentForm.amount}
                      onChange={(e) => {
                        setRentForm((prev) => ({ ...prev, amount: e.target.value }));
                        clearError('amount');
                      }}
                      placeholder="Rent amount"
                    />
                    <FieldError message={errors.amount} />
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      Remaining for {formatMonthKey(rentForm.month)}: ₹{formatCurrency(rentRemainingAmount)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Payment Mode</label>
                    <select
                      className="w-full px-3 py-2 mt-1"
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
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Unit</label>
                    <select
                      className={`w-full px-3 py-2 mt-1 ${errors.unitId ? 'input-error' : ''}`}
                      value={electricityForm.unitId}
                      onChange={(e) => {
                        setElectricityForm((prev) => ({ ...prev, unitId: e.target.value }));
                        clearError('unitId');
                      }}
                    >
                      <option value="">Select unit</option>
                      {formUnits.map((unit) => (
                        <option key={unit._id} value={unit._id}>
                          {unit.unitNumber}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors.unitId} />
                  </div>
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Month</label>
                    <DatePicker
                      picker="month"
                      className={`w-full px-3 py-2 mt-1 rounded-xl border border-black/10 ${errors.month ? 'input-error' : ''}`}
                      value={electricityForm.month}
                      onChange={(next) => {
                        setElectricityForm((prev) => ({ ...prev, month: next }));
                        clearError('month');
                      }}
                    />
                    <FieldError message={errors.month} />
                  </div>
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Current Reading</label>
                    <input
                      className={`w-full px-3 py-2 mt-1 ${errors.currentReading ? 'input-error' : ''}`}
                      value={electricityForm.currentReading}
                      onChange={(e) => {
                        setElectricityForm((prev) => ({ ...prev, currentReading: e.target.value }));
                        clearError('currentReading');
                      }}
                      placeholder="Current meter reading"
                    />
                    <FieldError message={errors.currentReading} />
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      Amount due for {formatMonthKey(electricityForm.month)}: ₹{formatCurrency(electricityAmountPreview)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Status</label>
                    <select
                      className="w-full px-3 py-2 mt-1"
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
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Date</label>
                    <DatePicker
                      className={`w-full px-3 py-2 mt-1 rounded-xl border border-black/10 ${errors.date ? 'input-error' : ''}`}
                      value={maintenanceForm.date}
                      onChange={(next) => {
                        setMaintenanceForm((prev) => ({ ...prev, date: next }));
                        clearError('date');
                      }}
                    />
                    <FieldError message={errors.date} />
                  </div>
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Category</label>
                    <input
                      className={`w-full px-3 py-2 mt-1 ${errors.category ? 'input-error' : ''}`}
                      value={maintenanceForm.category}
                      onChange={(e) => {
                        setMaintenanceForm((prev) => ({ ...prev, category: e.target.value }));
                        clearError('category');
                      }}
                      placeholder="Repair, cleaning, plumbing..."
                    />
                    <FieldError message={errors.category} />
                  </div>
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Amount</label>
                    <input
                      className={`w-full px-3 py-2 mt-1 ${errors.amount ? 'input-error' : ''}`}
                      value={maintenanceForm.amount}
                      onChange={(e) => {
                        setMaintenanceForm((prev) => ({ ...prev, amount: e.target.value }));
                        clearError('amount');
                      }}
                      placeholder="Expense amount"
                    />
                    <FieldError message={errors.amount} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Paid To</label>
                    <input
                      className="w-full px-3 py-2 mt-1"
                      value={maintenanceForm.paidTo}
                      onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, paidTo: e.target.value }))}
                      placeholder="Vendor or person"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-[var(--muted)]">Description</label>
                    <input
                      className="w-full px-3 py-2 mt-1"
                      value={maintenanceForm.description}
                      onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Short note"
                    />
                  </div>
                </div>
              )}

              {addType === 'deposit' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Tenant</label>
                    <select
                      className={`w-full px-3 py-2 mt-1 ${errors.tenantId ? 'input-error' : ''}`}
                      value={depositForm.tenantId}
                      onChange={(e) => {
                        setDepositForm((prev) => ({ ...prev, tenantId: e.target.value }));
                        clearError('tenantId');
                      }}
                    >
                      <option value="">Select tenant</option>
                      {activeFormTenants.map((tenant) => (
                        <option key={tenant._id} value={tenant._id}>
                          {tenant.fullName}{tenant.assignedUnit?.unitNumber ? ` - Unit ${tenant.assignedUnit.unitNumber}` : ''}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors.tenantId} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Deposit Type</label>
                    <select
                      className="w-full px-3 py-2 mt-1"
                      value={depositForm.type}
                      onChange={(e) => setDepositForm((prev) => ({ ...prev, type: e.target.value }))}
                    >
                      <option value="deposit">Collected</option>
                      <option value="refund">Refunded</option>
                    </select>
                  </div>
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Amount</label>
                    <input
                      className={`w-full px-3 py-2 mt-1 ${errors.amount ? 'input-error' : ''}`}
                      value={depositForm.amount}
                      onChange={(e) => {
                        setDepositForm((prev) => ({ ...prev, amount: e.target.value }));
                        clearError('amount');
                      }}
                      placeholder="Deposit amount"
                    />
                    <FieldError message={errors.amount} />
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {depositForm.type === 'refund' ? 'Refundable deposit' : 'Remaining deposit'}: ₹{formatCurrency(depositRemainingAmount)}
                    </div>
                  </div>
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Date</label>
                    <DatePicker
                      className={`w-full px-3 py-2 mt-1 rounded-xl border border-black/10 ${errors.date ? 'input-error' : ''}`}
                      value={depositForm.date}
                      onChange={(next) => {
                        setDepositForm((prev) => ({ ...prev, date: next }));
                        clearError('date');
                      }}
                    />
                    <FieldError message={errors.date} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-[var(--muted)]">Notes</label>
                    <input
                      className="w-full px-3 py-2 mt-1"
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
                    <label className="text-xs text-[var(--muted)]">Direction</label>
                    <select
                      className="w-full px-3 py-2 mt-1"
                      value={otherForm.direction}
                      onChange={(e) => setOtherForm((prev) => ({ ...prev, direction: e.target.value as 'in' | 'out' }))}
                    >
                      <option value="in">Cash In (income received)</option>
                      <option value="out">Cash Out (expense paid)</option>
                    </select>
                  </div>
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Amount</label>
                    <input
                      className={`w-full px-3 py-2 mt-1 ${errors.amount ? 'input-error' : ''}`}
                      value={otherForm.amount}
                      onChange={(e) => {
                        setOtherForm((prev) => ({ ...prev, amount: e.target.value }));
                        clearError('amount');
                      }}
                      placeholder="Amount"
                    />
                    <FieldError message={errors.amount} />
                  </div>
                  <div className="relative">
                    <label className="text-xs text-[var(--muted)]">Date</label>
                    <DatePicker
                      className={`w-full px-3 py-2 mt-1 rounded-xl border border-black/10 ${errors.date ? 'input-error' : ''}`}
                      value={otherForm.date}
                      onChange={(next) => {
                        setOtherForm((prev) => ({ ...prev, date: next }));
                        clearError('date');
                      }}
                    />
                    <FieldError message={errors.date} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-[var(--muted)]">Notes</label>
                    <input
                      className="w-full px-3 py-2 mt-1"
                      value={otherForm.notes}
                      onChange={(e) => setOtherForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Describe this payment"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formLoading}
                >
                  {formLoading ? 'Saving...' : 'Save Payment'}
                </button>
                <button
                  type="button"
                  className="btn btn-cancel"
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
      <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
};

export default Transactions;



