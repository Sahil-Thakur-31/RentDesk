import { Unit } from '../models/Unit';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export const getAutoMaintenanceUntil = () => new Date(Date.now() + TWO_DAYS_MS);

export const applyDerivedUnitStatus = (unit: any) => {
  let changed = false;

  if (unit.maintenanceMode && unit.maintenanceUntil) {
    const expiresAt = new Date(unit.maintenanceUntil).getTime();
    if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) {
      unit.maintenanceMode = false;
      unit.maintenanceUntil = undefined;
      changed = true;
    }
  }

  const nextStatus = unit.maintenanceMode ? 'maintenance' : unit.currentTenant ? 'occupied' : 'vacant';
  if (unit.status !== nextStatus) {
    unit.status = nextStatus;
    changed = true;
  }

  return changed;
};

export const syncUnitStatus = async (unit: any) => {
  if (applyDerivedUnitStatus(unit)) {
    await unit.save();
  }
  return unit;
};

export const syncPropertyUnitStatuses = async (propertyId: string) => {
  const units = await Unit.find({ propertyId });
  await Promise.all(units.map((unit) => syncUnitStatus(unit)));
};

export const syncMultiplePropertyUnitStatuses = async (propertyIds: any[]) => {
  if (!propertyIds.length) return;
  const units = await Unit.find({ propertyId: { $in: propertyIds } });
  await Promise.all(units.map((unit) => syncUnitStatus(unit)));
};
