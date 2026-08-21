import { Router } from 'express';
import {
  deleteAccount,
  login,
  register,
  me,
  updateMe,
  requestPasswordResetOtp,
  resetPasswordWithOtp
} from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', requestPasswordResetOtp);
router.post('/reset-password', resetPasswordWithOtp);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, updateMe);
router.delete('/me', requireAuth, deleteAccount);

export default router;
