import { asyncHandler } from '../utils/asyncHandler';
import { buildDashboard } from '../services/dashboardService';

export const getDashboard = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const { propertyId } = req.query;
  const data = await buildDashboard(
    req.user!._id.toString(),
    month ? Number(month) : undefined,
    year ? Number(year) : undefined,
    propertyId ? String(propertyId) : undefined
  );
  res.json(data);
});
