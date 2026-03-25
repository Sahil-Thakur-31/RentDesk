import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models/User';

export const searchUsers = asyncHandler(async (req, res) => {
  const { email, name } = req.query;
  const query: Record<string, unknown> = {};
  if (email) query.email = String(email).toLowerCase();
  if (name) query.fullName = { $regex: String(name), $options: 'i' };

  const users = await User.find(query).select('fullName email role');
  res.json(users);
});
