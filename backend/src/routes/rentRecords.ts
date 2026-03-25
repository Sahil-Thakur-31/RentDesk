import { Router } from 'express';
import { listRentRecords, createRentRecord, updateRentRecord, collectRentPayment, generateMonthly } from '../controllers/rentRecordController';
import { requireAuth } from '../middleware/auth';
import { requirePropertyRole } from '../middleware/rbac';

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.get('/', requirePropertyRole('rent:record'), listRentRecords);
router.post('/', requirePropertyRole('rent:record'), createRentRecord);
router.patch('/:recordId', requirePropertyRole('rent:record'), updateRentRecord);
router.post('/:recordId/collect', requirePropertyRole('rent:record'), collectRentPayment);
router.post('/generate', requirePropertyRole('rent:record'), generateMonthly);

export default router;
