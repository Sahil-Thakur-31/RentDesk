import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { HttpError } from '../utils/httpError';

const hasEmailConfig = () => {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.smtpFrom);
};

export const sendPasswordResetOtpEmail = async (to: string, otp: string) => {
  if (!hasEmailConfig()) {
    throw new HttpError(500, 'Email service is not configured yet');
  }

  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    }
  });

  await transporter.sendMail({
    from: env.smtpFrom,
    to,
    subject: 'RentDesk password reset OTP',
    text: `Your RentDesk OTP is ${otp}. It will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2 style="margin-bottom: 8px;">RentDesk Password Reset</h2>
        <p style="margin-top: 0;">Use this OTP to reset your password:</p>
        <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">${otp}</div>
        <p style="margin-bottom: 0;">This OTP expires in 10 minutes.</p>
      </div>
    `
  });
};
