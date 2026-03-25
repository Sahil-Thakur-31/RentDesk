import { Router } from 'express';
import {
  maintenanceExpenseReport,
  monthlyRentReport,
  propertyIncomeReport,
  tenantPaymentHistory,
  utilityBillsReport
} from '../controllers/reportController';
import { requireAuth } from '../middleware/auth';
import { requirePropertyRole } from '../middleware/rbac';

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.get('/monthly-rent', requirePropertyRole('report:export'), monthlyRentReport);
router.get('/property-income', requirePropertyRole('report:export'), propertyIncomeReport);
router.get('/utility-bills', requirePropertyRole('report:export'), utilityBillsReport);
router.get('/maintenance-expenses', requirePropertyRole('report:export'), maintenanceExpenseReport);
router.get('/tenant/:tenantId', requirePropertyRole('report:export'), tenantPaymentHistory);

export default router;
