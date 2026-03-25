import { Router } from 'express';
import { getDashboard } from '../controllers/dashboardController';
import { requireAuth } from '../middleware/auth';
import { requireGlobalRole } from '../middleware/rbac';

const router = Router();

router.use(requireAuth);
router.get('/', requireGlobalRole('dashboard:view'), getDashboard);

export default router;
