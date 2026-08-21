import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { User } from '../models/User';
import { env } from '../config/env';
import { sendPasswordResetOtpEmail } from '../services/emailService';
import { deleteUserAccountCascade } from '../services/destructiveActionService';

const signToken = (id: string) => {
  return jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] });
};

export const register = asyncHandler(async (req, res) => {
  const { fullName, email, password, phone, role } = req.body;
  const normalizedEmail = String(email || '').toLowerCase().trim();

  if (!fullName || !normalizedEmail || !password) {
    throw new HttpError(400, 'fullName, email and password are required');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new HttpError(400, 'Enter a valid email address', { fields: ['email'] });
  }

  if (String(password).length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters long', { fields: ['password'] });
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw new HttpError(409, 'Email already registered');

  const passwordHash = await bcrypt.hash(password, 10);

  if (role && !['owner', 'warden', 'manager'].includes(role)) {
    throw new HttpError(400, 'Invalid role');
  }

  const user = await User.create({
    fullName,
    email: normalizedEmail,
    phone,
    passwordHash,
    role: role || 'owner'
  });

  const token = signToken(user._id.toString());
  res.status(201).json({ token, user });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail || !password) throw new HttpError(400, 'email and password are required');

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) throw new HttpError(401, 'Invalid credentials');

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw new HttpError(401, 'Invalid credentials');

  const token = signToken(user._id.toString());
  res.json({ token, user });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

export const updateMe = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const { fullName, email, phone } = req.body;

  if (fullName !== undefined) {
    const trimmedName = String(fullName).trim();
    if (!trimmedName) throw new HttpError(400, 'Full name cannot be empty', { fields: ['fullName'] });
    req.user.fullName = trimmedName;
  }

  if (email !== undefined) {
    const normalizedEmail = String(email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new HttpError(400, 'Enter a valid email address', { fields: ['email'] });
    }
    if (normalizedEmail !== req.user.email) {
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) throw new HttpError(409, 'Email already registered', { fields: ['email'] });
      req.user.email = normalizedEmail;
    }
  }

  if (phone !== undefined) {
    req.user.phone = String(phone).trim() || undefined;
  }

  await req.user.save();
  res.json({ user: req.user });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  await deleteUserAccountCascade(String(req.user._id));
  res.json({ message: 'Account deleted' });
});

const hashOtp = (otp: string) => crypto.createHash('sha256').update(otp).digest('hex');

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

export const requestPasswordResetOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new HttpError(400, 'email is required');

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) {
    res.json({ message: 'If that email exists, an OTP has been sent.' });
    return;
  }

  const otp = generateOtp();
  user.passwordResetOtpHash = hashOtp(otp);
  user.passwordResetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendPasswordResetOtpEmail(user.email, otp);

  res.json({ message: 'If that email exists, an OTP has been sent.' });
});

export const resetPasswordWithOtp = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    throw new HttpError(400, 'email, otp and newPassword are required');
  }

  if (String(newPassword).length < 6) {
    throw new HttpError(400, 'New password must be at least 6 characters long');
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) throw new HttpError(400, 'Invalid OTP or email');

  if (!user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) {
    throw new HttpError(400, 'OTP not requested or already used');
  }

  if (user.passwordResetOtpExpiresAt.getTime() < Date.now()) {
    user.passwordResetOtpHash = undefined;
    user.passwordResetOtpExpiresAt = undefined;
    await user.save();
    throw new HttpError(400, 'OTP has expired');
  }

  if (user.passwordResetOtpHash !== hashOtp(String(otp).trim())) {
    throw new HttpError(400, 'Invalid OTP or email');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordResetOtpHash = undefined;
  user.passwordResetOtpExpiresAt = undefined;
  await user.save();

  res.json({ message: 'Password reset successful' });
});
