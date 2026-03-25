import { Router } from 'express';
import {
  archiveProperty,
  createProperty,
  getProperty,
  getPropertyOverview,
  listProperties,
  restoreProperty,
  updateProperty
} from '../controllers/propertyController';
import { requireAuth } from '../middleware/auth';
import { requireGlobalRole, requirePropertyRole, requirePropertyRoleAllowArchived } from '../middleware/rbac';

const router = Router();

router.use(requireAuth);

router.get('/', listProperties);
router.post('/', requireGlobalRole('property:create'), createProperty);
router.get('/:propertyId', getProperty);
router.get('/:propertyId/overview', requirePropertyRoleAllowArchived('property:update'), getPropertyOverview);
router.patch('/:propertyId', requirePropertyRole('property:update'), updateProperty);
router.delete('/:propertyId', requirePropertyRole('property:delete'), archiveProperty);
router.patch('/:propertyId/restore', requirePropertyRoleAllowArchived('property:delete'), restoreProperty);

export default router;
