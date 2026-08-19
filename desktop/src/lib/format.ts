import { getCurrentLocale } from './i18n';

export const formatCurrency = (value?: number | string | null) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0';
  return amount.toLocaleString(getCurrentLocale(), { maximumFractionDigits: 2 });
};
