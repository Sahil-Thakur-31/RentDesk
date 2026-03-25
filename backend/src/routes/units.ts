import { Router } from 'express';
import { listUnits, getUnit, getUnitDetails, createUnit, updateUnit, archiveUnit, restoreUnit } from '../controllers/unitController';
import { requireAuth } from '../middleware/auth';
import { requirePropertyRole } from '../middleware/rbac';

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.get('/', requirePropertyRole('unit:manage'), listUnits);
router.post('/', requirePropertyRole('unit:manage'), createUnit);
router.get('/:unitId', requirePropertyRole('unit:manage'), getUnit);
router.get('/:unitId/details', requirePropertyRole('unit:manage'), getUnitDetails);
router.patch('/:unitId', requirePropertyRole('unit:manage'), updateUnit);
router.delete('/:unitId', requirePropertyRole('unit:manage'), archiveUnit);
router.patch('/:unitId/restore', requirePropertyRole('unit:manage'), restoreUnit);

export default router;
