import { getCurrentLocale } from './i18n';

export const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const getCurrentDateValue = () => {
  return new Date().toISOString().slice(0, 10);
};

export const shiftMonthValue = (value: string, offset: number) => {
  const [year, month] = String(value).split('-').map(Number);
  const date = new Date(year, (month || 1) - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const formatDate = (value?: string | number | Date | null, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(getCurrentLocale(), options);
};

export const formatDateTime = (value?: string | number | Date | null, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(getCurrentLocale(), options);
};

export const formatMonthKey = (monthKey?: string | null) => {
  if (!monthKey) return '-';
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!year || !month) return String(monthKey);
  return new Date(year, month - 1, 1).toLocaleString(getCurrentLocale(), {
    month: 'long',
    year: 'numeric'
  });
};

export const formatMonthYear = (month?: string | number | null, year?: string | number | null) => {
  if (month == null || year == null) return '-';
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  if (!monthNumber || !yearNumber) return `${month}/${year}`;
  return new Date(yearNumber, monthNumber - 1, 1).toLocaleString(getCurrentLocale(), {
    month: 'long',
    year: 'numeric'
  });
};

