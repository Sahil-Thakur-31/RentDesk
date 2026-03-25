import { Router } from 'express';
import {
  listTenants,
  getTenant,
  getTenantDetails,
  createTenant,
  updateTenant,
  moveOutTenant,
  reactivateTenant
} from '../controllers/tenantController';
import { requireAuth } from '../middleware/auth';
import { requirePropertyRole } from '../middleware/rbac';

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.get('/', requirePropertyRole('tenant:manage'), listTenants);
router.post('/', requirePropertyRole('tenant:manage'), createTenant);
router.get('/:tenantId', requirePropertyRole('tenant:manage'), getTenant);
router.get('/:tenantId/details', requirePropertyRole('tenant:manage'), getTenantDetails);
router.patch('/:tenantId', requirePropertyRole('tenant:manage'), updateTenant);
router.patch('/:tenantId/move-out', requirePropertyRole('tenant:manage'), moveOutTenant);
router.patch('/:tenantId/reactivate', requirePropertyRole('tenant:manage'), reactivateTenant);

export default router;
