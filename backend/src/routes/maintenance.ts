import { Router } from 'express';
import { listMaintenance, getMaintenance, createMaintenance, updateMaintenance, deleteMaintenance } from '../controllers/maintenanceController';
import { requireAuth } from '../middleware/auth';
import { requirePropertyRole } from '../middleware/rbac';

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.get('/', requirePropertyRole('maintenance:record'), listMaintenance);
router.post('/', requirePropertyRole('maintenance:record'), createMaintenance);
router.get('/:expenseId', requirePropertyRole('maintenance:record'), getMaintenance);
router.patch('/:expenseId', requirePropertyRole('maintenance:record'), updateMaintenance);
router.delete('/:expenseId', requirePropertyRole('maintenance:record'), deleteMaintenance);

export default router;
