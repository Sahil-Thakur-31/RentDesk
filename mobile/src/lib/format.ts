export const formatCurrency = (value: number | string | undefined | null) => {
  const amount = Number(value || 0);
  return `\u20B9${Number.isFinite(amount) ? amount : 0}`;
};

export const capitalize = (value?: string | null) => {
  if (!value) return '-';
  return value.charAt(0).toUpperCase() + value.slice(1);
};
