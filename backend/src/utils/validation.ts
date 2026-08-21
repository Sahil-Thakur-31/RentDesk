import { HttpError } from './httpError';

const isEmpty = (value: unknown) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

export const requireFields = (body: Record<string, unknown>, fields: string[]) => {
  const missing = fields.filter((field) => isEmpty(body[field]));

  if (missing.length > 0) {
    throw new HttpError(400, `${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} required`, { fields: missing });
  }
};

export const requirePositive = (value: unknown, field: string) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new HttpError(400, `${field} must be a positive number`, { fields: [field] });
  }
};

export const requireNonNegative = (value: unknown, field: string) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new HttpError(400, `${field} must be a valid number`, { fields: [field] });
  }
};
