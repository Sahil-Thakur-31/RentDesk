import { RentRecord } from '../models/RentRecord';
import { Unit } from '../models/Unit';
import { Tenant } from '../models/Tenant';

interface GenerateMonthlyRentInput {
  propertyId: string;
  month: number;
  year: number;
}

export const generateMonthlyRent = async ({ propertyId, month, year }: GenerateMonthlyRentInput) => {
  const units = await Unit.find({ propertyId, status: 'occupied', isArchived: false });
  let created = 0;
  let skipped = 0;

  for (const unit of units) {
    if (!unit.currentTenant) {
      skipped += 1;
      continue;
    }

    const tenant = await Tenant.findById(unit.currentTenant);
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
