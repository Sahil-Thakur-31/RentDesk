import { Router } from 'express';
import { searchUsers } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);
router.get('/', searchUsers);

export default router;
