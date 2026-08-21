import dayjs from 'dayjs';
import { Property } from '../models/Property';
import { generateMonthlyRent } from './rentGenerationService';

let lastGeneratedMonthKey: string | null = null;
let inFlight: Promise<void> | null = null;

// Opportunistically generates this month's rent records for every active
// property the first time any authenticated request comes in during that
// month, so "due" items appear on day 1 instead of waiting for someone to
// manually touch a tenant. Guarded by an in-memory key so it only does real
// work once per month per server process; safe to call on every request.
export const ensureCurrentMonthRentGenerated = async () => {
  const now = dayjs();
  const monthKey = now.format('YYYY-MM');
  if (lastGeneratedMonthKey === monthKey) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const properties = await Property.find({ isArchived: false }).select('_id');
      for (const property of properties) {
        try {
          await generateMonthlyRent({ propertyId: String(property._id), month: now.month() + 1, year: now.year() });
        } catch (err) {
          console.error(`[monthlyRentAutoGen] failed for property ${property._id}`, err);
        }
      }
      lastGeneratedMonthKey = monthKey;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
};
