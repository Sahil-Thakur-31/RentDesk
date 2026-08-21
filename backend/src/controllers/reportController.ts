import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { Property } from '../models/Property';
import { getAccessiblePropertyIdsForUser } from '../services/portfolioService';
import {
  buildMaintenanceExpenseReport,
  buildMonthlyRentReport,
  buildPropertyIncomeReport,
  buildTenantPaymentHistory,
  buildUtilityBillsReport,
  toExcel,
  toPdf,
  type ReportMeta
} from '../services/reportService';
import { optionalString, requireString } from '../utils/request';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const formatDateLabel = (value: string | Date) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const sendReport = async (
  req: any,
  res: any,
  meta: Omit<ReportMeta, 'portfolioName'> & { portfolioName?: string },
  fileName: string,
  rows: Array<Record<string, unknown>>,
  format?: string
) => {
  const fullMeta: ReportMeta = {
    ...meta,
    portfolioName: meta.portfolioName ?? req.portfolio?.name,
    propertyName: meta.propertyName ?? req.property?.name,
    propertyAddress: meta.propertyAddress ?? req.property?.address
  };

  if (!format || format === 'json') {
    res.json({ title: meta.title, rows });
    return;
  }

  if (format === 'excel') {
    const buffer = await toExcel(fullMeta, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
    res.send(buffer);
    return;
  }

  const buffer = await toPdf(fullMeta, rows);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
  res.send(buffer);
};

const toDateRange = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
};

export const monthlyRentReport = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const month = optionalString(req.query.month as string | string[] | undefined);
  const year = optionalString(req.query.year as string | string[] | undefined);
  const format = optionalString(req.query.format as string | string[] | undefined);
  if (!month || !year) throw new HttpError(400, 'month and year are required');

  const records = await buildMonthlyRentReport(propertyId, Number(month), Number(year));
  const rows = records.map((record) => ({
    unit: (record.unitId as any)?.unitNumber || '-',
    tenant: (record.tenantId as any)?.fullName || '-',
    dueAmount: record.rentAmount,
    receivedAmount: record.paidAmount || 0,
    remainingAmount: Math.max(0, (record.rentAmount || 0) - (record.paidAmount || 0)),
    status: record.status,
    paidDate: record.paidDate ? new Date(record.paidDate).toLocaleDateString('en-IN') : '-',
    paymentMode: record.paymentMode || '-'
  }));

  const periodLabel = `${MONTH_NAMES[Number(month) - 1] || month} ${year}`;
  await sendReport(
    req,
    res,
    { title: 'Monthly Rent Report', periodLabel },
    `monthly-rent-${year}-${String(month).padStart(2, '0')}`,
    rows,
    format || 'json'
  );
});

export const propertyIncomeReport = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const start = optionalString(req.query.start as string | string[] | undefined);
  const end = optionalString(req.query.end as string | string[] | undefined);
  const format = optionalString(req.query.format as string | string[] | undefined);
  if (!start || !end) throw new HttpError(400, 'start and end dates are required');

  const { startDate, endDate } = toDateRange(start, end);
  const payments = await buildPropertyIncomeReport(propertyId, startDate, endDate);
  const rows = payments.map((payment) => ({
    date: new Date(payment.date).toLocaleDateString('en-IN'),
    type: payment.type,
    tenant: (payment.tenantId as any)?.fullName || '-',
    unit: (payment.unitId as any)?.unitNumber || '-',
    amount: payment.amount,
    notes: payment.notes || '-',
    source: payment.sourceType || '-'
  }));

  const periodLabel = `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
  await sendReport(
    req,
    res,
    { title: 'Property Income Report', periodLabel },
    `property-income-${start}-${end}`,
    rows,
    format || 'json'
  );
});

export const tenantPaymentHistory = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const tenantId = requireString(req.params.tenantId, 'tenantId');
  const format = optionalString(req.query.format as string | string[] | undefined);
  const data = await buildTenantPaymentHistory(propertyId, tenantId);
  if (!data.tenant) throw new HttpError(404, 'Tenant not found');

  const rows = data.payments.map((payment) => ({
    date: new Date(payment.date).toLocaleDateString('en-IN'),
    type: payment.type,
    unit: (payment.unitId as any)?.unitNumber || '-',
    amount: payment.amount,
    notes: payment.notes || '-'
  }));

  await sendReport(
    req,
    res,
    { title: `Tenant Payment History - ${data.tenant.fullName}` },
    `tenant-history-${data.tenant.fullName.replace(/\s+/g, '-').toLowerCase()}`,
    rows,
    format || 'json'
  );
});

export const utilityBillsReport = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const month = optionalString(req.query.month as string | string[] | undefined);
  const format = optionalString(req.query.format as string | string[] | undefined);
  if (!month) throw new HttpError(400, 'month is required');

  const records = await buildUtilityBillsReport(propertyId, month);
  const rows = records.map((record) => ({
    unit: (record.unitId as any)?.unitNumber || '-',
    type: record.billType,
    month: record.month,
    meterStart: record.meterStart,
    meterEnd: record.meterEnd,
    unitsUsed: record.unitsConsumed,
    amount: record.amount,
    status: record.status
  }));

  const [y, m] = month.split('-');
  const periodLabel = y && m ? `${MONTH_NAMES[Number(m) - 1] || m} ${y}` : month;
  await sendReport(req, res, { title: 'Utility Bills Report', periodLabel }, `utility-bills-${month}`, rows, format || 'json');
});

export const maintenanceExpenseReport = asyncHandler(async (req, res) => {
  const propertyId = requireString(req.params.propertyId, 'propertyId');
  const start = optionalString(req.query.start as string | string[] | undefined);
  const end = optionalString(req.query.end as string | string[] | undefined);
  const format = optionalString(req.query.format as string | string[] | undefined);
  if (!start || !end) throw new HttpError(400, 'start and end dates are required');

  const { startDate, endDate } = toDateRange(start, end);
  const data = await buildMaintenanceExpenseReport(propertyId, startDate, endDate);

  const expenseRows = data.expenses.map((expense) => ({
    date: new Date(expense.date).toLocaleDateString('en-IN'),
    category: expense.category,
    paidTo: expense.paidTo || '-',
    amount: expense.amount,
    notes: expense.description || '-'
  }));

  const manualSpentRows = data.payments
    .filter((payment) => payment.sourceType !== 'maintenance')
    .filter((payment) => !String(payment.notes || '').toLowerCase().includes('maintenance collected'))
    .map((payment) => ({
      date: new Date(payment.date).toLocaleDateString('en-IN'),
      category: 'manual_maintenance',
      paidTo: (payment.tenantId as any)?.fullName || '-',
      amount: payment.amount,
      notes: payment.notes || '-'
    }));

  const periodLabel = `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
  await sendReport(
    req,
    res,
    { title: 'Maintenance Report', periodLabel },
    `maintenance-${start}-${end}`,
    [...expenseRows, ...manualSpentRows],
    format || 'json'
  );
});

const accessiblePropertyNameMap = async (req: any) => {
  const propertyIds = await getAccessiblePropertyIdsForUser(req.user);
  const properties = await Property.find({ _id: { $in: propertyIds } }).select('name');
  const nameById = new Map(properties.map((p) => [String(p._id), p.name]));
  return { propertyIds, nameById };
};

export const allPropertiesMonthlyRentReport = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');
  const month = optionalString(req.query.month as string | string[] | undefined);
  const year = optionalString(req.query.year as string | string[] | undefined);
  const format = optionalString(req.query.format as string | string[] | undefined);
  if (!month || !year) throw new HttpError(400, 'month and year are required');

  const { propertyIds, nameById } = await accessiblePropertyNameMap(req);
  const perProperty = await Promise.all(propertyIds.map((id) => buildMonthlyRentReport(id, Number(month), Number(year))));

  const rows = propertyIds.flatMap((propertyId, index) =>
    perProperty[index].map((record) => ({
      property: nameById.get(propertyId) || '-',
      unit: (record.unitId as any)?.unitNumber || '-',
      tenant: (record.tenantId as any)?.fullName || '-',
      dueAmount: record.rentAmount,
      receivedAmount: record.paidAmount || 0,
      remainingAmount: Math.max(0, (record.rentAmount || 0) - (record.paidAmount || 0)),
      status: record.status,
      paidDate: record.paidDate ? new Date(record.paidDate).toLocaleDateString('en-IN') : '-',
      paymentMode: record.paymentMode || '-'
    }))
  );

  const periodLabel = `${MONTH_NAMES[Number(month) - 1] || month} ${year}`;
  await sendReport(
    req,
    res,
    { title: 'Monthly Rent Report', periodLabel, propertyName: 'All Properties' },
    `monthly-rent-all-properties-${year}-${String(month).padStart(2, '0')}`,
    rows,
    format || 'json'
  );
});

export const allPropertiesUtilityBillsReport = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');
  const month = optionalString(req.query.month as string | string[] | undefined);
  const format = optionalString(req.query.format as string | string[] | undefined);
  if (!month) throw new HttpError(400, 'month is required');

  const { propertyIds, nameById } = await accessiblePropertyNameMap(req);
  const perProperty = await Promise.all(propertyIds.map((id) => buildUtilityBillsReport(id, month)));

  const rows = propertyIds.flatMap((propertyId, index) =>
    perProperty[index].map((record) => ({
      property: nameById.get(propertyId) || '-',
      unit: (record.unitId as any)?.unitNumber || '-',
      type: record.billType,
      month: record.month,
      meterStart: record.meterStart,
      meterEnd: record.meterEnd,
      unitsUsed: record.unitsConsumed,
      amount: record.amount,
      status: record.status
    }))
  );

  const [y, m] = month.split('-');
  const periodLabel = y && m ? `${MONTH_NAMES[Number(m) - 1] || m} ${y}` : month;
  await sendReport(
    req,
    res,
    { title: 'Utility Bills Report', periodLabel, propertyName: 'All Properties' },
    `utility-bills-all-properties-${month}`,
    rows,
    format || 'json'
  );
});

export const allPropertiesIncomeReport = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');
  const start = optionalString(req.query.start as string | string[] | undefined);
  const end = optionalString(req.query.end as string | string[] | undefined);
  const format = optionalString(req.query.format as string | string[] | undefined);
  if (!start || !end) throw new HttpError(400, 'start and end dates are required');

  const { startDate, endDate } = toDateRange(start, end);
  const { propertyIds, nameById } = await accessiblePropertyNameMap(req);
  const perProperty = await Promise.all(propertyIds.map((id) => buildPropertyIncomeReport(id, startDate, endDate)));

  const rows = propertyIds.flatMap((propertyId, index) =>
    perProperty[index].map((payment) => ({
      property: nameById.get(propertyId) || '-',
      date: new Date(payment.date).toLocaleDateString('en-IN'),
      type: payment.type,
      tenant: (payment.tenantId as any)?.fullName || '-',
      unit: (payment.unitId as any)?.unitNumber || '-',
      amount: payment.amount,
      notes: payment.notes || '-',
      source: payment.sourceType || '-'
    }))
  );

  const periodLabel = `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
  await sendReport(
    req,
    res,
    { title: 'Property Income Report', periodLabel, propertyName: 'All Properties' },
    `property-income-all-properties-${start}-${end}`,
    rows,
    format || 'json'
  );
});

export const allPropertiesMaintenanceExpenseReport = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');
  const start = optionalString(req.query.start as string | string[] | undefined);
  const end = optionalString(req.query.end as string | string[] | undefined);
  const format = optionalString(req.query.format as string | string[] | undefined);
  if (!start || !end) throw new HttpError(400, 'start and end dates are required');

  const { startDate, endDate } = toDateRange(start, end);
  const { propertyIds, nameById } = await accessiblePropertyNameMap(req);
  const perProperty = await Promise.all(propertyIds.map((id) => buildMaintenanceExpenseReport(id, startDate, endDate)));

  const rows = propertyIds.flatMap((propertyId, index) => {
    const propertyName = nameById.get(propertyId) || '-';
    const data = perProperty[index];
    const expenseRows = data.expenses.map((expense) => ({
      property: propertyName,
      date: new Date(expense.date).toLocaleDateString('en-IN'),
      category: expense.category,
      paidTo: expense.paidTo || '-',
      amount: expense.amount,
      notes: expense.description || '-'
    }));
    const manualSpentRows = data.payments
      .filter((payment) => payment.sourceType !== 'maintenance')
      .filter((payment) => !String(payment.notes || '').toLowerCase().includes('maintenance collected'))
      .map((payment) => ({
        property: propertyName,
        date: new Date(payment.date).toLocaleDateString('en-IN'),
        category: 'manual_maintenance',
        paidTo: (payment.tenantId as any)?.fullName || '-',
        amount: payment.amount,
        notes: payment.notes || '-'
      }));
    return [...expenseRows, ...manualSpentRows];
  });

  const periodLabel = `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
  await sendReport(
    req,
    res,
    { title: 'Maintenance Report', periodLabel, propertyName: 'All Properties' },
    `maintenance-all-properties-${start}-${end}`,
    rows,
    format || 'json'
  );
});
