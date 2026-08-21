import { Router } from 'express';
import {
  allPropertiesIncomeReport,
  allPropertiesMaintenanceExpenseReport,
  allPropertiesMonthlyRentReport,
  allPropertiesUtilityBillsReport
} from '../controllers/reportController';
import { requireAuth } from '../middleware/auth';
import { requirePortfolioRole } from '../middleware/rbac';

const router = Router();

router.use(requireAuth);
router.get('/monthly-rent', requirePortfolioRole('report:export'), allPropertiesMonthlyRentReport);
router.get('/property-income', requirePortfolioRole('report:export'), allPropertiesIncomeReport);
router.get('/utility-bills', requirePortfolioRole('report:export'), allPropertiesUtilityBillsReport);
router.get('/maintenance-expenses', requirePortfolioRole('report:export'), allPropertiesMaintenanceExpenseReport);

export default router;
