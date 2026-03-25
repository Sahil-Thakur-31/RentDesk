import { Router } from 'express';
import { listPayments, createPayment } from '../controllers/paymentController';
import { requireAuth } from '../middleware/auth';
import { requirePropertyRole } from '../middleware/rbac';

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.get('/', requirePropertyRole('payment:record'), listPayments);
router.post('/', requirePropertyRole('payment:record'), createPayment);

export default router;
