import { HttpError } from './httpError';

const base64Regex = /^(data:\w+\/[-+.\w]+;base64,)?[A-Za-z0-9+/]+={0,2}$/;

export const isBase64String = (value?: string) => {
  if (!value) return true;
  return base64Regex.test(value);
};

export const ensureBase64OrThrow = (value: string | undefined, fieldName: string) => {
  if (!isBase64String(value)) {
    throw new HttpError(400, `Invalid base64 payload for ${fieldName}`);
  }
};
