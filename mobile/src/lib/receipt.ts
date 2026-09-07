import { formatCurrency, capitalize } from './format';
import { formatDate } from './date';

export interface ReceiptLine {
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
  date?: string;
  lines: ReceiptLine[];
}

const receiptNoFor = (id: any) => String(id || '').slice(-8).toUpperCase();

const TITLES: Record<string, string> = {
  rent: 'Rent Receipt',
  utility: 'Utility Bill Receipt',
  maintenance: 'Maintenance Receipt',
  deposit: 'Deposit Receipt',
  refund: 'Deposit Refund Receipt',
  other: 'Payment Receipt'
};

export const buildPaymentReceipt = (payment: any, propertyName: string, propertyAddress?: string): ReceiptData => {
  const tenant = payment.tenantId;
  const unit = payment.unitId;

  return {
    title: TITLES[payment.type] || 'Payment Receipt',
    receiptNo: receiptNoFor(payment._id),
    propertyName,
    propertyAddress,
    tenantName: tenant?.fullName,
    unitNumber: unit?.unitNumber,
    amountLabel: 'Amount',
    amount: payment.amount || 0,
    date: formatDate(payment.date),
    lines: [
      { label: 'Type', value: capitalize(payment.type) },
      { label: 'Date', value: formatDate(payment.date) },
      ...(unit?.unitNumber ? [{ label: 'Unit', value: unit.unitNumber }] : []),
      ...(tenant?.fullName ? [{ label: 'Tenant', value: tenant.fullName }] : []),
      ...(tenant?.phone ? [{ label: 'Tenant Phone', value: tenant.phone }] : []),
      ...(tenant?.depositAmount ? [{ label: 'Total Deposit Required', value: formatCurrency(tenant.depositAmount) }] : []),
      ...(payment.notes ? [{ label: 'Notes', value: payment.notes }] : [])
    ]
  };
};

const esc = (value: string) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

export const renderReceiptHtml = (data: ReceiptData, portfolioName?: string) => {
  const lineRows = data.lines
    .map(
      (line) => `
        <tr>
          <td class="label">${esc(line.label)}</td>
          <td class="value">${esc(line.value)}</td>
        </tr>`
    )
    .join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, Helvetica, Arial, sans-serif;
            color: #0f172a;
            padding: 32px;
          }
          .letterhead { text-align: center; padding-bottom: 14px; border-bottom: 1px solid #e2e8f0; margin-bottom: 18px; }
          .portfolio { font-size: 18px; font-weight: 700; color: #0f766e; }
          .portfolio-sub { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #64748b; margin-top: 3px; }
          .head-row { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 1px dashed #e2e8f0; margin-bottom: 18px; }
          .property-name { font-size: 20px; font-weight: 700; }
          .property-address { font-size: 12px; color: #64748b; margin-top: 3px; }
          .sub-meta { font-size: 13px; color: #334155; margin-top: 6px; }
          .receipt-title { font-size: 14px; font-weight: 700; color: #0f766e; text-align: right; }
          .receipt-no { font-size: 11px; color: #64748b; text-align: right; margin-top: 3px; }
          table { width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 14px; overflow: hidden; }
          td { padding: 9px 14px; font-size: 13px; }
          td.label { color: #64748b; }
          td.value { text-align: right; font-weight: 600; }
          .amount-box {
            display: flex; justify-content: space-between; align-items: center;
            background: #ecfdf5; border-radius: 14px; padding: 14px 18px; margin-top: 18px;
          }
          .amount-label { font-size: 14px; font-weight: 600; }
          .amount-value { font-size: 24px; font-weight: 700; color: #0f766e; }
          .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 24px; }
        </style>
      </head>
      <body>
        ${
          portfolioName
            ? `<div class="letterhead">
                 <div class="portfolio">${esc(portfolioName)}</div>
                 <div class="portfolio-sub">Property Management</div>
               </div>`
            : ''
        }
        <div class="head-row">
          <div>
            <div class="property-name">${esc(data.propertyName)}</div>
            ${data.propertyAddress ? `<div class="property-address">${esc(data.propertyAddress)}</div>` : ''}
            ${
              data.tenantName || data.unitNumber
                ? `<div class="sub-meta">${esc([data.tenantName, data.unitNumber ? `Unit ${data.unitNumber}` : null].filter(Boolean).join(' · '))}</div>`
                : ''
            }
          </div>
          <div>
            <div class="receipt-title">${esc(data.title)}</div>
            <div class="receipt-no">Receipt No. ${esc(data.receiptNo)}</div>
            ${data.date ? `<div class="receipt-no">${esc(data.date)}</div>` : ''}
          </div>
        </div>
        <table>${lineRows}</table>
        <div class="amount-box">
          <div class="amount-label">${esc(data.amountLabel)}</div>
          <div class="amount-value">${esc(formatCurrency(data.amount))}</div>
        </div>
        <div class="footer">Generated by RentDesk</div>
      </body>
    </html>
  `;
};
