import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/httpError';

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
};

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  const error = err as HttpError;
  const status = error.statusCode || 500;
  res.status(status).json({
    message: error.message || 'Internal Server Error',
    details: error.details || null
  });
};
