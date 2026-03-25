import { Router } from 'express';
import {
  listUtilityBills,
  getUtilityBill,
  createUtilityBill,
  updateUtilityBill,
  deleteUtilityBill,
  bulkElectricityReadings,
  getElectricityReadings
} from '../controllers/utilityBillController';
import { requireAuth } from '../middleware/auth';
import { requirePropertyRole } from '../middleware/rbac';

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.get('/', requirePropertyRole('utility:record'), listUtilityBills);
router.post('/', requirePropertyRole('utility:record'), createUtilityBill);
router.get('/electricity-readings', requirePropertyRole('utility:record'), getElectricityReadings);
router.post('/electricity-readings', requirePropertyRole('utility:record'), bulkElectricityReadings);
router.get('/:billId', requirePropertyRole('utility:record'), getUtilityBill);
router.patch('/:billId', requirePropertyRole('utility:record'), updateUtilityBill);
router.delete('/:billId', requirePropertyRole('utility:record'), deleteUtilityBill);

export default router;
