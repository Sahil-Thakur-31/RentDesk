import { formatCurrency } from './format';
import { formatDate, formatMonthKey, formatMonthYear } from './dateFormat';

export interface ReceiptLineItem {
  label: string;
  value: string;
}

export interface ReceiptData {
  title: string;
  receiptNo: string;
  propertyName: string;
  propertyAddress?: string;
  tenantName?: string;
  unitNumber?: string;
  amountLabel: string;
  amount: number;
  status?: string;
  date?: string;
  items: ReceiptLineItem[];
  notes?: string;
}

const receiptNoFor = (id: any) => String(id || '').slice(-8).toUpperCase();

const titleCase = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank Transfer',
  bank_transfer: 'Bank Transfer',
  upi: 'UPI',
  cheque: 'Cheque',
  card: 'Card'
};

const formatPaymentMode = (mode?: string) => {
  if (!mode) return undefined;
  return PAYMENT_MODE_LABELS[mode.toLowerCase()] || titleCase(mode);
};

export const buildRentReceipt = (record: any, propertyName: string, propertyAddress?: string): ReceiptData => {
  const paidAmount = record.paidAmount || 0;
  const hasPayment = paidAmount > 0;
  return {
    title: 'Rent Receipt',
    receiptNo: receiptNoFor(record._id),
    propertyName,
    propertyAddress,
    tenantName: record.tenantId?.fullName || 'Tenant',
    unitNumber: record.unitId?.unitNumber || '-',
    amountLabel: 'Amount Paid',
    amount: paidAmount,
    status: record.status,
    date: record.paidDate ? formatDate(record.paidDate) : formatMonthYear(record.month, record.year),
    items: [
      { label: 'Rent Period', value: formatMonthYear(record.month, record.year) },
      { label: 'Total Rent', value: `₹${formatCurrency(record.rentAmount || 0)}` },
      { label: 'Paid', value: `₹${formatCurrency(paidAmount)}` },
      { label: 'Remaining', value: `₹${formatCurrency(Math.max(0, (record.rentAmount || 0) - paidAmount))}` },
      { label: 'Payment Date', value: hasPayment && record.paidDate ? formatDate(record.paidDate) : 'Not paid yet' },
      ...(hasPayment && record.paymentMode ? [{ label: 'Payment Mode', value: formatPaymentMode(record.paymentMode)! }] : []),
      ...(record.tenantId?.phone ? [{ label: 'Tenant Phone', value: record.tenantId.phone }] : [])
    ]
  };
};

export const buildUtilityBillReceipt = (bill: any, propertyName: string, propertyAddress?: string): ReceiptData => {
  const isPaid = bill.status === 'paid' || bill.status === 'partial';
  return {
    title: `${titleCase(bill.billType) || 'Utility'} Bill Receipt`,
    receiptNo: receiptNoFor(bill._id),
    propertyName,
    propertyAddress,
    unitNumber: bill.unitId?.unitNumber || '-',
    amountLabel: bill.status === 'paid' ? 'Amount Paid' : 'Amount Due',
    amount: bill.amount || 0,
    status: bill.status,
    date: formatMonthKey(bill.month),
    items: [
      { label: 'Billing Month', value: formatMonthKey(bill.month) },
      { label: 'Meter Reading', value: bill.meterStart != null && bill.meterEnd != null ? `${bill.meterStart} → ${bill.meterEnd}` : '-' },
      { label: 'Units Consumed', value: String(bill.unitsConsumed ?? '-') },
      { label: 'Status', value: bill.status },
      { label: 'Payment Date', value: isPaid && (bill.updatedAt || bill.paidDate) ? formatDate(bill.paidDate || bill.updatedAt) : 'Not paid yet' }
    ]
  };
};

export const buildMaintenanceExpenseReceipt = (record: any, propertyName: string, propertyAddress?: string): ReceiptData => ({
  title: 'Maintenance Expense Receipt',
  receiptNo: receiptNoFor(record._id),
  propertyName,
  propertyAddress,
  amountLabel: 'Amount Spent',
  amount: record.amount || 0,
  date: formatDate(record.date),
  items: [
    { label: 'Category', value: record.category || 'Expense' },
    { label: 'Paid To', value: record.paidTo || '-' },
    { label: 'Date', value: formatDate(record.date) },
    { label: 'Notes', value: record.description || record.notes || '-' }
  ]
});

export const buildMaintenanceCollectedReceipt = (payment: any, propertyName: string, propertyAddress?: string): ReceiptData => ({
  title: 'Maintenance Collection Receipt',
  receiptNo: receiptNoFor(payment._id),
  propertyName,
  propertyAddress,
  tenantName: payment.tenantId?.fullName || '-',
  unitNumber: payment.unitId?.unitNumber || '-',
  amountLabel: 'Amount Collected',
  amount: payment.amount || 0,
  date: formatDate(payment.date),
  items: [
    { label: 'Date', value: formatDate(payment.date) },
    ...(payment.tenantId?.phone ? [{ label: 'Tenant Phone', value: payment.tenantId.phone }] : []),
    { label: 'Notes', value: payment.notes || '-' }
  ]
});

export const buildDepositReceipt = (payment: any, propertyName: string, propertyAddress?: string): ReceiptData => ({
  title: payment.type === 'refund' ? 'Deposit Refund Receipt' : 'Deposit Receipt',
  receiptNo: receiptNoFor(payment._id),
  propertyName,
  propertyAddress,
  tenantName: payment.tenantId?.fullName || '-',
  unitNumber: payment.unitId?.unitNumber || '-',
  amountLabel: payment.type === 'refund' ? 'Amount Refunded' : 'Amount Collected',
  amount: payment.amount || 0,
  date: formatDate(payment.date),
  items: [
    { label: 'Type', value: payment.type === 'refund' ? 'Refund' : 'Deposit' },
    { label: 'Date', value: formatDate(payment.date) },
    ...(payment.tenantId?.depositAmount != null
      ? [{ label: 'Total Deposit Required', value: `₹${formatCurrency(payment.tenantId.depositAmount)}` }]
      : []),
    ...(payment.tenantId?.phone ? [{ label: 'Tenant Phone', value: payment.tenantId.phone }] : []),
    { label: 'Notes', value: payment.notes || '-' }
  ]
});

export const buildOtherPaymentReceipt = (payment: any, propertyName: string, propertyAddress?: string): ReceiptData => ({
  title: 'Payment Receipt',
  receiptNo: receiptNoFor(payment._id),
  propertyName,
  propertyAddress,
  amountLabel: payment.direction === 'out' ? 'Amount Paid Out' : 'Amount Received',
  amount: payment.amount || 0,
  date: formatDate(payment.date),
  items: [
    { label: 'Type', value: payment.type },
    { label: 'Direction', value: payment.direction === 'out' ? 'Cash Out' : 'Cash In' },
    { label: 'Date', value: formatDate(payment.date) },
    { label: 'Notes', value: payment.notes || '-' }
  ]
});
