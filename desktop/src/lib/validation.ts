export const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || String(value).trim() === '';

export const requiredMsg = (label: string) => `${label} is required`;

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const isValidPhone = (value: string) => /^[0-9+\-\s()]{7,15}$/.test(value.trim());

export const isPositiveNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
};

export const isNonNegativeNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
};

export type FieldErrors = Record<string, string | undefined>;

export const hasErrors = (errors: FieldErrors) => Object.values(errors).some(Boolean);
