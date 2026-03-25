import { Router } from 'express';
import { translateBundle } from '../controllers/translationController';

const router = Router();

router.post('/translate', translateBundle);

export default router;
