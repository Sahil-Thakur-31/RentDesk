import { HttpError } from './httpError';

export const getSingleValue = (value: string | string[] | undefined | null) =>
  Array.isArray(value) ? value[0] : value ?? undefined;

export const requireString = (value: string | string[] | undefined | null, field: string) => {
  const resolved = getSingleValue(value)?.trim();
  if (!resolved) {
    throw new HttpError(400, `${field} is required`);
  }
  return resolved;
};

export const optionalString = (value: string | string[] | undefined | null) => {
  const resolved = getSingleValue(value)?.trim();
  return resolved || undefined;
};
