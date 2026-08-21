import dayjs from 'dayjs';
import { RentRecord } from '../models/RentRecord';
import { Unit } from '../models/Unit';
import { Tenant } from '../models/Tenant';

interface GenerateMonthlyRentInput {
  propertyId: string;
  month: number;
  year: number;
}

export const generateMonthlyRent = async ({ propertyId, month, year }: GenerateMonthlyRentInput) => {
  const periodStart = dayjs().year(year).month(month - 1).startOf('month').toDate();
  const periodEnd = dayjs().year(year).month(month - 1).endOf('month').toDate();

  const units = await Unit.find({ propertyId, isArchived: false });
  let created = 0;
  let skipped = 0;

  for (const unit of units) {
    // Attribute rent to whoever actually rented this unit during the target month,
    // not the unit's current tenant — a unit's occupant can change between when the
    // record is generated and the month it's generated for.
    const tenant = await Tenant.findOne({
      propertyId,
      assignedUnit: unit._id,
      movedInDate: { $lte: periodEnd },
      $or: [{ movedOutDate: { $exists: false } }, { movedOutDate: null }, { movedOutDate: { $gte: periodStart } }]
    }).sort({ movedInDate: -1 });

    if (!tenant) {
      skipped += 1;
      continue;
    }

    const exists = await RentRecord.findOne({ tenantId: tenant._id, month, year });
    if (exists) {
      skipped += 1;
      continue;
    }

    await RentRecord.create({
      propertyId,
      unitId: unit._id,
      tenantId: tenant._id,
      month,
      year,
      rentAmount: tenant.rentAmount || unit.monthlyRent,
      status: 'unpaid'
    });

    created += 1;
  }

  return { created, skipped };
};
