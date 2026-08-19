import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler';
import { env } from '../config/env';
import { HttpError } from '../utils/httpError';
import { User } from '../models/User';

interface TokenPayload {
  id: string;
}

export const verifyTokenAndLoadUser = async (token: string) => {
  const payload = jwt.verify(token, env.jwtSecret) as TokenPayload;
  const user = await User.findById(payload.id);
  if (!user) {
    throw new HttpError(401, 'User not found');
  }
  return user;
};

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new HttpError(401, 'Authorization token missing');
  }

  const token = header.replace('Bearer ', '').trim();
  req.user = await verifyTokenAndLoadUser(token);
  next();
});
