import { Router } from 'express';
import {
  approvePortfolioJoinRequest,
  createPortfolio,
  deleteCurrentPortfolio,
  getPortfolio,
  invitePortfolioMember,
  listPortfolios,
  rejectPortfolioJoinRequest,
  removePortfolioMember,
  requestPortfolioJoin,
  switchPortfolio,
  updatePortfolioSettings,
  updatePortfolioMember
} from '../controllers/portfolioController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/list', listPortfolios);
router.get('/', getPortfolio);
router.post('/create', createPortfolio);
router.delete('/', deleteCurrentPortfolio);
router.post('/switch', switchPortfolio);
router.patch('/settings', updatePortfolioSettings);
router.post('/invite', invitePortfolioMember);
router.patch('/members/:memberId', updatePortfolioMember);
router.delete('/members/:memberId', removePortfolioMember);
router.post('/join-requests', requestPortfolioJoin);
router.post('/join-requests/:requestId/approve', approvePortfolioJoinRequest);
router.post('/join-requests/:requestId/reject', rejectPortfolioJoinRequest);

export default router;
