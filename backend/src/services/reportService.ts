import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
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

export interface ReportMeta {
  title: string;
  periodLabel?: string;
  portfolioName?: string;
  propertyName?: string;
  propertyAddress?: string;
}

const humanizeKey = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

const AMOUNT_KEY_PATTERN = /amount/i;
const NUMERIC_KEY_PATTERN = /amount|unitsUsed|meterStart|meterEnd/i;

const STATUS_COLORS: Record<string, [number, number, number]> = {
  paid: [0x04 / 255, 0x82 / 255, 0x5d / 255],
  partial: [0xb9 / 255, 0x57 / 255, 0x09 / 255],
  unpaid: [0xd8 / 255, 0x25 / 255, 0x25 / 255],
  pending: [0xd8 / 255, 0x25 / 255, 0x25 / 255]
};

const formatAmount = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return valueToCell(value);
  return `Rs ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export const toExcel = async (meta: ReportMeta, rows: Array<Record<string, unknown>>) => {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const humanized = headers.map(humanizeKey);

  const aoa: unknown[][] = [];
  aoa.push([meta.portfolioName ? `${meta.portfolioName} - ${meta.title}` : meta.title]);
  if (meta.propertyName) aoa.push([[meta.propertyName, meta.propertyAddress].filter(Boolean).join(' - ')]);
  if (meta.periodLabel) aoa.push([meta.periodLabel]);
  aoa.push([`Generated on ${new Date().toLocaleString('en-IN')}`]);
  aoa.push([]);
  aoa.push(humanized);
  rows.forEach((row) => {
    aoa.push(headers.map((header) => row[header] ?? ''));
  });

  if (headers.some((h) => AMOUNT_KEY_PATTERN.test(h))) {
    const totals: Array<string | number> = headers.map((header) => {
      if (!AMOUNT_KEY_PATTERN.test(header)) return '';
      const sum = rows.reduce((acc, row) => acc + (Number(row[header]) || 0), 0);
      return sum;
    });
    totals[0] = 'Total';
    aoa.push(totals);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const headerRowIndex = aoa.findIndex((row) => row === humanized);
  worksheet['!cols'] = headers.map((header, i) => {
    const maxLen = Math.max(
      humanized[i]?.length || 10,
      ...rows.map((row) => String(row[header] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });
  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(headers.length - 1, 0) } }];
  worksheet['!views'] = [{ state: 'frozen', ySplit: headerRowIndex + 1 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, meta.title.substring(0, 31) || 'Report');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return Buffer.from(buffer);
};

const COLORS = {
  accent: rgb(0x0f / 255, 0x76 / 255, 0x6e / 255),
  text: rgb(0x0f / 255, 0x17 / 255, 0x2a / 255),
  muted: rgb(0x64 / 255, 0x74 / 255, 0x8b / 255),
  headerFill: rgb(0xf1 / 255, 0xf5 / 255, 0xf9 / 255),
  zebraFill: rgb(0xf8 / 255, 0xfa / 255, 0xfc / 255),
  totalFill: rgb(0xec / 255, 0xfd / 255, 0xf5 / 255),
  border: rgb(0xe2 / 255, 0xe8 / 255, 0xf0 / 255),
  white: rgb(1, 1, 1)
};

const truncateToWidth = (text: string, font: PDFFont, size: number, maxWidth: number) => {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
};

export const toPdf = async (meta: ReportMeta, rows: Array<Record<string, unknown>>) => {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const landscape = headers.length > 6;
  const pageSize: [number, number] = landscape ? [841.89, 595.28] : [595.28, 841.89];

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  const headerRowHeight = 22;
  const bodyRowHeight = 20;
  const headerFontSize = 8.5;
  const bodyFontSize = 8.5;
  const footerHeight = 30;

  let page = pdfDoc.addPage(pageSize);
  let { width, height } = page.getSize();
  let y = height - margin;
  let rowIndex = 0;

  const drawLetterhead = () => {
    if (meta.portfolioName) {
      page.drawText(meta.portfolioName, { x: margin, y, size: 15, font: boldFont, color: COLORS.accent });
      y -= 13;
      page.drawText('PROPERTY MANAGEMENT', { x: margin, y, size: 7, font, color: COLORS.muted });
      y -= 10;
      page.drawLine({
        start: { x: margin, y },
        end: { x: width - margin, y },
        thickness: 0.75,
        color: COLORS.border
      });
      y -= 18;
    }

    const rightX = width - margin;
    const titleWidth = boldFont.widthOfTextAtSize(meta.title, 12);
    page.drawText(meta.title, { x: rightX - titleWidth, y, size: 12, font: boldFont, color: COLORS.accent });

    if (meta.propertyName) {
      page.drawText(meta.propertyName, { x: margin, y, size: 12, font: boldFont, color: COLORS.text });
    }
    y -= 14;

    const generatedText = `Generated ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`;
    const generatedWidth = font.widthOfTextAtSize(generatedText, 8);
    page.drawText(generatedText, { x: rightX - generatedWidth, y, size: 8, font, color: COLORS.muted });

    if (meta.propertyAddress) {
      page.drawText(meta.propertyAddress, { x: margin, y, size: 8.5, font, color: COLORS.muted });
    }
    y -= 12;

    if (meta.periodLabel) {
      const periodWidth = font.widthOfTextAtSize(meta.periodLabel, 8);
      page.drawText(meta.periodLabel, { x: rightX - periodWidth, y, size: 8, font, color: COLORS.muted });
      y -= 12;
    }

    y -= 12;
  };

  drawLetterhead();

  if (!headers.length) {
    const emptyBoxHeight = 70;
    page.drawRectangle({
      x: margin,
      y: y - emptyBoxHeight,
      width: width - margin * 2,
      height: emptyBoxHeight,
      color: COLORS.headerFill,
      borderColor: COLORS.border,
      borderWidth: 1
    });
    const message = 'No records found for the selected period.';
    const messageWidth = font.widthOfTextAtSize(message, 10);
    page.drawText(message, {
      x: margin + (width - margin * 2 - messageWidth) / 2,
      y: y - emptyBoxHeight / 2 - 4,
      size: 10,
      font,
      color: COLORS.muted
    });
    y -= emptyBoxHeight;
  } else {
    const isNumeric = (header: string) =>
      NUMERIC_KEY_PATTERN.test(header) && rows.every((r) => r[header] == null || Number.isFinite(Number(r[header])));

    const availableWidth = width - margin * 2;
    const rawWidths = headers.map((header) => {
      const headerW = boldFont.widthOfTextAtSize(humanizeKey(header), headerFontSize);
      const maxCellW = rows.reduce((max, row) => {
        const raw = AMOUNT_KEY_PATTERN.test(header) ? formatAmount(row[header]) : valueToCell(row[header]);
        return Math.max(max, font.widthOfTextAtSize(raw, bodyFontSize));
      }, 0);
      return Math.max(headerW, maxCellW, 30) + 14;
    });
    const totalRaw = rawWidths.reduce((a, b) => a + b, 0);
    const scale = totalRaw > availableWidth ? availableWidth / totalRaw : 1;
    const colWidths = rawWidths.map((w) => w * scale);
    const colX: number[] = [];
    let cursor = margin;
    colWidths.forEach((w) => {
      colX.push(cursor);
      cursor += w;
    });

    const ensureSpace = (needed: number) => {
      if (y - needed < margin + footerHeight) {
        page = pdfDoc.addPage(pageSize);
        ({ width, height } = page.getSize());
        y = height - margin;
        drawHeaderRow();
      }
    };

    const drawHeaderRow = () => {
      page.drawRectangle({ x: margin, y: y - headerRowHeight, width: availableWidth, height: headerRowHeight, color: COLORS.headerFill });
      headers.forEach((header, i) => {
        const label = humanizeKey(header);
        const isNum = isNumeric(header);
        const textW = boldFont.widthOfTextAtSize(label, headerFontSize);
        const cellX = isNum ? colX[i] + colWidths[i] - textW - 6 : colX[i] + 6;
        page.drawText(label, {
          x: cellX,
          y: y - headerRowHeight + 7,
          size: headerFontSize,
          font: boldFont,
          color: COLORS.text
        });
      });
      page.drawLine({
        start: { x: margin, y: y - headerRowHeight },
        end: { x: margin + availableWidth, y: y - headerRowHeight },
        thickness: 1,
        color: COLORS.border
      });
      y -= headerRowHeight;
    };

    drawHeaderRow();

    rows.forEach((row) => {
      ensureSpace(bodyRowHeight);
      if (rowIndex % 2 === 1) {
        page.drawRectangle({ x: margin, y: y - bodyRowHeight, width: availableWidth, height: bodyRowHeight, color: COLORS.zebraFill });
      }
      headers.forEach((header, i) => {
        const raw = AMOUNT_KEY_PATTERN.test(header) ? formatAmount(row[header]) : valueToCell(row[header]);
        const isNum = isNumeric(header);
        const cellText = truncateToWidth(raw, font, bodyFontSize, colWidths[i] - 12);
        const textW = font.widthOfTextAtSize(cellText, bodyFontSize);
        const cellX = isNum ? colX[i] + colWidths[i] - textW - 6 : colX[i] + 6;
        const statusColor = header.toLowerCase() === 'status' ? STATUS_COLORS[String(row[header]).toLowerCase()] : undefined;
        page.drawText(cellText, {
          x: cellX,
          y: y - bodyRowHeight + 6,
          size: bodyFontSize,
          font,
          color: statusColor ? rgb(...statusColor) : COLORS.text
        });
      });
      page.drawLine({
        start: { x: margin, y: y - bodyRowHeight },
        end: { x: margin + availableWidth, y: y - bodyRowHeight },
        thickness: 0.5,
        color: COLORS.border
      });
      y -= bodyRowHeight;
      rowIndex += 1;
    });

    const amountHeaders = headers.filter((h) => AMOUNT_KEY_PATTERN.test(h));
    if (amountHeaders.length) {
      ensureSpace(bodyRowHeight + 2);
      page.drawRectangle({ x: margin, y: y - bodyRowHeight, width: availableWidth, height: bodyRowHeight, color: COLORS.totalFill });
      headers.forEach((header, i) => {
        if (i === 0 && !AMOUNT_KEY_PATTERN.test(header)) {
          page.drawText('Total', { x: colX[i] + 6, y: y - bodyRowHeight + 6, size: bodyFontSize, font: boldFont, color: COLORS.text });
          return;
        }
        if (!AMOUNT_KEY_PATTERN.test(header)) return;
        const sum = rows.reduce((acc, r) => acc + (Number(r[header]) || 0), 0);
        const text = formatAmount(sum);
        const textW = boldFont.widthOfTextAtSize(text, bodyFontSize);
        page.drawText(text, {
          x: colX[i] + colWidths[i] - textW - 6,
          y: y - bodyRowHeight + 6,
          size: bodyFontSize,
          font: boldFont,
          color: COLORS.accent
        });
      });
      y -= bodyRowHeight;
    }
  }

  const pages = pdfDoc.getPages();
  pages.forEach((p: PDFPage, i: number) => {
    const { width: pw } = p.getSize();
    p.drawLine({
      start: { x: margin, y: margin + 14 },
      end: { x: pw - margin, y: margin + 14 },
      thickness: 0.5,
      color: COLORS.border
    });
    p.drawText('Generated by RentDesk', { x: margin, y: margin, size: 7.5, font, color: COLORS.muted });
    const pageLabel = `Page ${i + 1} of ${pages.length}`;
    const pageLabelWidth = font.widthOfTextAtSize(pageLabel, 7.5);
    p.drawText(pageLabel, { x: pw - margin - pageLabelWidth, y: margin, size: 7.5, font, color: COLORS.muted });
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
};
