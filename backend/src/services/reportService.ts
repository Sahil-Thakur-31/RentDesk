import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { RentRecord } from '../models/RentRecord';
import { Payment } from '../models/Payment';
import { Tenant } from '../models/Tenant';
import { UtilityBill } from '../models/UtilityBill';
import { MaintenanceExpense } from '../models/MaintenanceExpense';

const valueToCell = (value: unknown) => {
  if (value == null) return '';
  if (value instanceof Date) return value.toLocaleDateString('en-IN');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const buildMonthlyRentReport = async (propertyId: string, month: number, year: number) => {
  return RentRecord.find({ propertyId, month, year })
    .populate('tenantId', 'fullName')
    .populate('unitId', 'unitNumber')
    .sort({ unitId: 1, tenantId: 1 });
};

export const buildPropertyIncomeReport = async (propertyId: string, start: Date, end: Date) => {
  return Payment.find({
    propertyId,
    date: { $gte: start, $lte: end }
  })
    .populate('tenantId', 'fullName')
    .populate('unitId', 'unitNumber')
    .sort({ date: 1, createdAt: 1 });
};

export const buildTenantPaymentHistory = async (propertyId: string, tenantId: string) => {
  const tenant = await Tenant.findOne({ _id: tenantId, propertyId });
  const payments = await Payment.find({ tenantId, propertyId })
    .populate('unitId', 'unitNumber')
    .sort({ date: -1, createdAt: -1 });
  return { tenant, payments };
};

export const buildUtilityBillsReport = async (propertyId: string, month: string) => {
  return UtilityBill.find({ propertyId, month })
    .populate('unitId', 'unitNumber')
    .sort({ billType: 1, unitId: 1 });
};

export const buildMaintenanceExpenseReport = async (propertyId: string, start: Date, end: Date) => {
  const [expenses, otherSpentPayments] = await Promise.all([
    MaintenanceExpense.find({ propertyId, date: { $gte: start, $lte: end } }).sort({ date: 1 }),
    Payment.find({
      propertyId,
      type: 'maintenance',
      date: { $gte: start, $lte: end }
    })
      .populate('tenantId', 'fullName')
      .populate('unitId', 'unitNumber')
      .sort({ date: 1, createdAt: 1 })
  ]);

  return {
    expenses,
    payments: otherSpentPayments
  };
};

export const toExcel = async (title: string, rows: Array<Record<string, unknown>>) => {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, title.substring(0, 31) || 'Report');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return Buffer.from(buffer);
};

export const toPdf = async (title: string, rows: Array<Record<string, unknown>>) => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const margin = 36;
  const lineHeight = 15;
  const headerFontSize = 11;
  const bodyFontSize = 9;
  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();
  let y = height - margin;

  const headers = rows.length ? Object.keys(rows[0]) : [];

  const addPage = () => {
    page = pdfDoc.addPage();
    ({ width, height } = page.getSize());
    y = height - margin;
  };

  const drawLine = (text: string, bold = false) => {
    if (y < margin + lineHeight) addPage();
    page.drawText(text, {
      x: margin,
      y,
      size: bold ? headerFontSize : bodyFontSize,
      font: bold ? boldFont : font,
      color: rgb(0.12, 0.16, 0.22),
      maxWidth: width - margin * 2
    });
    y -= lineHeight;
  };

  drawLine(title, true);
  drawLine(`Generated on ${new Date().toLocaleString('en-IN')}`);
  y -= 4;

  if (!headers.length) {
    drawLine('No rows available for the selected filters.');
  } else {
    drawLine(headers.join(' | '), true);
    rows.forEach((row) => {
      drawLine(headers.map((header) => valueToCell(row[header])).join(' | '));
    });
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
};

