import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import Badge, { type BadgeTone } from '../components/Badge';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { BuildingIcon, CloseIcon, UnitsIcon } from '../components/icons';
import { cachedGet, invalidateByTag, isCached } from '../lib/queryCache';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirmDialog';
import { SkeletonDetailHeader, SkeletonStatRow, SkeletonTable } from '../components/Skeleton';
import { formatCurrency } from '../lib/format';
import FieldError from '../components/FieldError';
import DatePicker from '../components/DatePicker';
import { formatDate } from '../lib/dateFormat';
import { isBlank, isPositiveNumber, isNonNegativeNumber, requiredMsg, type FieldErrors } from '../lib/validation';

const propertyTypeLabels: Record<string, string> = {
  building: 'Building',
  flat: 'Flat',
  shop: 'Shop',
  commercial: 'Commercial',
  plot: 'Plot'
};

const propertyTypeTone: Record<string, BadgeTone> = {
  building: 'info',
  flat: 'accent',
  shop: 'warning',
  commercial: 'danger',
  plot: 'success'
};

const unitTypeLabels: Record<string, string> = {
  single_room: 'Single Room',
  '1rk': '1RK',
  '1bhk': '1BHK',
  '2bhk': '2BHK',
  '3bhk': '3BHK',
  shop: 'Shop',
  office: 'Office',
  warehouse: 'Warehouse',
  other: 'Other'
};

const formatUnitStatus = (status: string) => {
  if (status === 'maintenance') return 'Under Repair';
  if (status === 'occupied') return 'Occupied';
  return 'Vacant';
};

const unitStatusTone = (status: string): BadgeTone => {
  if (status === 'maintenance') return 'warning';
  if (status === 'occupied') return 'success';
  return 'neutral';
};

const PropertyDetails = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    propertyType: 'building',
    address: '',
    city: '',
    state: '',
    pincode: '',
    size: '',
    notes: '',
    activeSince: '',
    maintenanceCharge: '',
    electricityUnitRate: '',
    commonElectricityCharge: ''
  });
  const [unitForm, setUnitForm] = useState({
    unitNumber: '',
    unitType: '1bhk',
    floor: '',
    size: '',
    activeSince: '',
    monthlyRent: '',
    deposit: '',
    lastMeterReading: ''
  });
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [unitErrors, setUnitErrors] = useState<FieldErrors>({});

  const load = async (options?: { force?: boolean }) => {
    if (!propertyId) return;
    if (options?.force) {
      invalidateByTag('property', propertyId);
      invalidateByTag('propertyOverview', propertyId);
      invalidateByTag('unit', propertyId);
    }
    const allCached =
      isCached(`/properties/${propertyId}`) &&
      isCached(`/properties/${propertyId}/overview`) &&
      isCached(`/properties/${propertyId}/units`);
    if (!allCached) setLoading(true);
    try {
      const [propertyData, overviewData, unitsData] = await Promise.all([
        cachedGet(`/properties/${propertyId}`),
        cachedGet(`/properties/${propertyId}/overview`),
        cachedGet(`/properties/${propertyId}/units`)
      ]);
      setProperty(propertyData);
      setOverview(overviewData);
      setUnits(unitsData || []);
      setEditForm({
        name: propertyData.name || '',
        propertyType: propertyData.propertyType || 'building',
        address: propertyData.address || '',
        city: propertyData.city || '',
        state: propertyData.state || '',
        pincode: propertyData.pincode || '',
        size: propertyData.size || '',
        notes: propertyData.notes || '',
        activeSince: propertyData.activeSince ? String(propertyData.activeSince).slice(0, 10) : '',
        maintenanceCharge: String(propertyData.maintenanceCharge ?? ''),
        electricityUnitRate: String(propertyData.electricityUnitRate ?? ''),
        commonElectricityCharge: String(propertyData.commonElectricityCharge ?? '')
      });
    } finally {
      setLoading(false);
    }
  };

  const [renderedPropertyId, setRenderedPropertyId] = useState(propertyId);
  if (propertyId !== renderedPropertyId) {
    setRenderedPropertyId(propertyId);
    setProperty(null);
    setLoading(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const updateEditField = (key: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
    setEditErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const updateUnitField = (key: string, value: string) => {
    setUnitForm((prev) => ({ ...prev, [key]: value }));
    setUnitErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const validateEditForm = () => {
    const next: FieldErrors = {};
    if (isBlank(editForm.name)) next.name = requiredMsg('Property name');
    if (isBlank(editForm.address)) next.address = requiredMsg('Address');
    if (isBlank(editForm.city)) next.city = requiredMsg('City');
    if (isBlank(editForm.state)) next.state = requiredMsg('State');
    if (isBlank(editForm.pincode)) next.pincode = requiredMsg('Pincode');
    setEditErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const validateUnitForm = () => {
    const next: FieldErrors = {};
    if (isBlank(unitForm.unitNumber)) next.unitNumber = requiredMsg('Unit number');
    if (!isPositiveNumber(unitForm.monthlyRent)) next.monthlyRent = 'Monthly rent must be greater than 0';
    if (!isNonNegativeNumber(unitForm.deposit)) next.deposit = 'Deposit must be a valid amount';
    setUnitErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const saveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    if (!validateEditForm()) return;
    setLoading(true);
    try {
      const payload = {
        ...editForm,
        maintenanceCharge: editForm.maintenanceCharge ? Number(editForm.maintenanceCharge) : undefined,
        electricityUnitRate: editForm.electricityUnitRate ? Number(editForm.electricityUnitRate) : undefined,
        commonElectricityCharge: editForm.commonElectricityCharge ? Number(editForm.commonElectricityCharge) : undefined
      };
      await api.patch(`/properties/${propertyId}`, payload);
      await load({ force: true });
      setEditErrors({});
      setShowEdit(false);
      toast.success('Property updated.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update property.');
    } finally {
      setLoading(false);
    }
  };

  const deleteProperty = async () => {
    if (!propertyId || !property?.name) return;
    if (occupiedUnits.length > 0) {
      toast.error(
        `Cannot deactivate this property because ${occupiedUnits.length} unit${occupiedUnits.length === 1 ? '' : 's'} still ${occupiedUnits.length === 1 ? 'has' : 'have'} an active tenant. Move all tenants out first.`
      );
      return;
    }
    const ok = await confirmDialog({
      title: `Mark "${property.name}" as inactive?`,
      description: `This will also deactivate all ${units.length} unit${units.length === 1 ? '' : 's'} under this property and hide it from active lists. You can restore it later.`,
      confirmLabel: 'Deactivate',
      danger: true
    });
    if (!ok) return;
    setLoading(true);
    try {
      await api.delete(`/properties/${propertyId}`);
      invalidateByTag('property', propertyId);
      invalidateByTag('property');
      invalidateByTag('unit', propertyId);
      navigate('/properties');
      toast.success('Property and its units marked inactive.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update property.');
    } finally {
      setLoading(false);
    }
  };

  const restoreProperty = async () => {
    if (!propertyId || !property?.name) return;
    const ok = await confirmDialog({
      title: `Restore "${property.name}"?`,
      description: 'Its units will stay inactive — restore any units you need individually from the Units list.',
      confirmLabel: 'Restore'
    });
    if (!ok) return;
    setLoading(true);
    try {
      await api.patch(`/properties/${propertyId}/restore`);
      invalidateByTag('property');
      await load({ force: true });
      toast.success('Property restored.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to restore property.');
    } finally {
      setLoading(false);
    }
  };

  const addUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    if (!validateUnitForm()) return;
    setLoading(true);
    try {
      await api.post(`/properties/${propertyId}/units`, {
        unitNumber: unitForm.unitNumber,
        unitType: unitForm.unitType,
        floor: unitForm.floor || undefined,
        size: unitForm.size || undefined,
        activeSince: unitForm.activeSince || undefined,
        monthlyRent: Number(unitForm.monthlyRent),
        deposit: Number(unitForm.deposit),
        lastMeterReading: unitForm.lastMeterReading ? Number(unitForm.lastMeterReading) : undefined
      });
      invalidateByTag('unit', propertyId);
      const unitsData = await cachedGet(`/properties/${propertyId}/units`);
      setUnits(unitsData || []);
      setUnitForm({
        unitNumber: '',
        unitType: '1bhk',
        floor: '',
        size: '',
        activeSince: '',
        monthlyRent: '',
        deposit: '',
        lastMeterReading: ''
      });
      setUnitErrors({});
      setShowAddUnit(false);
      toast.success('Unit added.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add unit.');
    } finally {
      setLoading(false);
    }
  };

  const deleteUnit = async (unitId: string, unitNumber?: string) => {
    if (!propertyId) return;
    const unit = units.find((entry) => entry._id === unitId);
    if (unit?.currentTenant) {
      toast.error('Cannot deactivate a unit with an active tenant. Move the tenant out first.');
      return;
    }
    const ok = await confirmDialog({
      title: `Mark unit ${unitNumber ? `"${unitNumber}"` : ''} as inactive?`,
      description: 'This will hide it from active lists. You can restore it later.',
      confirmLabel: 'Deactivate',
      danger: true
    });
    if (!ok) return;
    setLoading(true);
    try {
      await api.delete(`/properties/${propertyId}/units/${unitId}`);
      invalidateByTag('unit', propertyId);
      const unitsData = await cachedGet(`/properties/${propertyId}/units`);
      setUnits(unitsData || []);
      toast.success('Unit marked inactive.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update unit.');
    } finally {
      setLoading(false);
    }
  };

  if (!property && loading) {
    return (
      <div className="space-y-6">
        <SkeletonDetailHeader avatar actions={2} />
        <SkeletonStatRow count={3} colsClassName="xl:grid-cols-3" />
        <SkeletonTable columns={7} rows={4} />
      </div>
    );
  }

  if (!property) {
    return <div className="text-sm text-[var(--muted)]">Property not found.</div>;
  }

  const occupiedUnits = units.filter((unit) => unit.currentTenant);

  const totals = overview?.totals || {};
  const occupancyRate = totals.totalUnits
    ? Math.round((totals.occupiedUnits / totals.totalUnits) * 100)
    : 0;
  const collectionRate = totals.monthlyExpectedRent
    ? Math.round((totals.collectedRent / totals.monthlyExpectedRent) * 100)
    : 0;

  const unitColumns: TableColumn<any>[] = [
    { key: 'unitNumber', label: 'Unit', accessor: (unit) => unit.unitNumber },
    { key: 'unitType', label: 'Type', accessor: (unit) => unitTypeLabels[unit.unitType] || unit.unitType },
    { key: 'floor', label: 'Floor', accessor: (unit) => unit.floor || '-' },
    { key: 'meterReading', label: 'Meter Reading', accessor: (unit) => unit.lastMeterReading ?? 0 },
    { key: 'rent', label: 'Rent', accessor: (unit) => unit.monthlyRent, render: (unit) => `₹${formatCurrency(unit.monthlyRent)}` },
    {
      key: 'status',
      label: 'Status',
      accessor: (unit) => formatUnitStatus(unit.status),
      filterOptions: [
        { value: 'Occupied', label: 'Occupied' },
        { value: 'Vacant', label: 'Vacant' },
        { value: 'Under Repair', label: 'Under Repair' }
      ],
      render: (unit) => <Badge tone={unitStatusTone(unit.status)}>{formatUnitStatus(unit.status)}</Badge>
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (unit) => (
        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm btn-info"
            onClick={() => navigate(`/properties/${propertyId}/units/${unit._id}`)}
          >
            View
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => deleteUnit(unit._id, unit.unitNumber)}
            disabled={Boolean(unit.currentTenant)}
            title={unit.currentTenant ? 'Move the tenant out before deactivating this unit.' : undefined}
          >
            Deactivate
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white shadow-[0_10px_20px_rgba(15,118,110,0.25)]">
              <BuildingIcon width={22} height={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xl font-semibold">{property.name}</div>
                <Badge tone={propertyTypeTone[property.propertyType] || 'neutral'}>
                  {propertyTypeLabels[property.propertyType] || property.propertyType}
                </Badge>
                {property.size && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-slate-600">
                    {property.size} sq ft
                  </span>
                )}
                {property.isArchived && <Badge tone="danger">Inactive</Badge>}
              </div>
              <div className="text-sm text-[var(--muted)] mt-1">{property.address}</div>
              <div className="text-xs text-[var(--muted)] mt-0.5">
                {property.city}, {property.state} - {property.pincode}
              </div>
              {property.activeSince && (
                <div className="text-xs text-[var(--muted)] mt-0.5">
                  Active since {formatDate(property.activeSince, { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {property.isArchived ? (
              <button
                className="btn btn-success"
                onClick={restoreProperty}
              >
                Restore
              </button>
            ) : (
              <>
                <button
                  className="btn btn-warning"
                  onClick={() => {
                    setEditErrors({});
                    setShowEdit(true);
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger"
                  onClick={deleteProperty}
                  disabled={occupiedUnits.length > 0}
                  title={occupiedUnits.length > 0 ? 'Move all tenants out before deactivating this property.' : undefined}
                >
                  Deactivate
                </button>
              </>
            )}
          </div>
        </div>
        {property.notes && (
          <div className="rounded-2xl border border-black/5 bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--muted)]">
            {property.notes}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)] whitespace-nowrap">Units & Occupancy</div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Badge tone={totals.vacantUnits > 0 ? 'warning' : 'success'}>{totals.vacantUnits || 0} Vacant</Badge>
              {totals.maintenanceUnits > 0 && <Badge tone="danger">{totals.maintenanceUnits} Repair</Badge>}
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-semibold">
                {totals.occupiedUnits || 0}/{totals.totalUnits || 0}
              </div>
              <div className="text-xs text-[var(--muted)]">Occupied units</div>
            </div>
            <div className="text-sm text-[var(--muted)]">{occupancyRate}%</div>
          </div>
          <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div className="h-full bg-[var(--accent)]" style={{ width: `${occupancyRate}%` }} />
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Rent This Month</div>
            <Badge tone={totals.pendingRent > 0 ? 'warning' : 'success'}>{'\u20B9'}{formatCurrency(totals.pendingRent || 0)} Remaining</Badge>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-semibold">
                {'\u20B9'}{formatCurrency(totals.collectedRent || 0)} / {'\u20B9'}{formatCurrency(totals.monthlyExpectedRent || 0)}
              </div>
              <div className="text-xs text-[var(--muted)]">Collected</div>
            </div>
            <div className="text-sm text-[var(--muted)]">{collectionRate}%</div>
          </div>
          <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${collectionRate}%` }} />
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Charges & Rates</div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Maintenance / month</span>
              <span className="font-semibold">{'\u20B9'}{formatCurrency(property.maintenanceCharge || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Electricity per unit</span>
              <span className="font-semibold">{'\u20B9'}{formatCurrency(property.electricityUnitRate || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Common electricity</span>
              <span className="font-semibold">{'\u20B9'}{formatCurrency(property.commonElectricityCharge || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <SortableTable
        columns={unitColumns}
        data={units}
        rowKey={(unit) => unit._id}
        title="Units"
        headerAction={
          !property.isArchived && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setUnitErrors({});
                setShowAddUnit(true);
              }}
            >
              Add Unit
            </button>
          )
        }
        searchPlaceholder="Search units by number, floor..."
        emptyIcon={<UnitsIcon width={22} height={22} />}
        emptyTitle="No units added yet"
        emptyDescription="Add a unit to start tracking rent, occupancy, and tenants."
      />

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">Edit Property</div>
              <button
                className="modal-close-btn"
                onClick={() => {
                  setEditErrors({});
                  setShowEdit(false);
                }}
                aria-label="Close"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <form onSubmit={saveProperty} noValidate className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">Property Name</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${editErrors.name ? 'input-error' : ''}`}
                    placeholder="Property name"
                    value={editForm.name}
                    onChange={(e) => updateEditField('name', e.target.value)}
                  />
                  <FieldError message={editErrors.name} />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Property Type</label>
                  <select
                    className="w-full px-3 py-2 mt-1"
                    value={editForm.propertyType}
                    onChange={(e) => updateEditField('propertyType', e.target.value)}
                  >
                    <option value="building">Building</option>
                    <option value="flat">Flat</option>
                    <option value="shop">Shop</option>
                    <option value="commercial">Commercial</option>
                    <option value="plot">Plot</option>
                  </select>
                </div>
                <div className="relative md:col-span-2">
                  <label className="text-xs text-[var(--muted)]">Address</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${editErrors.address ? 'input-error' : ''}`}
                    placeholder="Address"
                    value={editForm.address}
                    onChange={(e) => updateEditField('address', e.target.value)}
                  />
                  <FieldError message={editErrors.address} />
                </div>
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">City</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${editErrors.city ? 'input-error' : ''}`}
                    placeholder="City"
                    value={editForm.city}
                    onChange={(e) => updateEditField('city', e.target.value)}
                  />
                  <FieldError message={editErrors.city} />
                </div>
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">State</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${editErrors.state ? 'input-error' : ''}`}
                    placeholder="State"
                    value={editForm.state}
                    onChange={(e) => updateEditField('state', e.target.value)}
                  />
                  <FieldError message={editErrors.state} />
                </div>
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">Pincode</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${editErrors.pincode ? 'input-error' : ''}`}
                    placeholder="Pincode"
                    value={editForm.pincode}
                    onChange={(e) => updateEditField('pincode', e.target.value)}
                  />
                  <FieldError message={editErrors.pincode} />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Size in sq ft (Optional)</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="e.g. 1200"
                    value={editForm.size}
                    onChange={(e) => updateEditField('size', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Active Since (Optional)</label>
                  <DatePicker
                    className="w-full px-3 py-2 mt-1 rounded-xl border border-black/10"
                    value={editForm.activeSince}
                    onChange={(next) => updateEditField('activeSince', next)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-[var(--muted)]">Notes (Optional)</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Notes"
                    value={editForm.notes}
                    onChange={(e) => updateEditField('notes', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Maintenance Charge (Monthly)</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Maintenance charge"
                    value={editForm.maintenanceCharge}
                    onChange={(e) => updateEditField('maintenanceCharge', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Electricity Unit Rate</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Rate per unit"
                    value={editForm.electricityUnitRate}
                    onChange={(e) => updateEditField('electricityUnitRate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Common Electricity Charge</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Common charge"
                    value={editForm.commonElectricityCharge}
                    onChange={(e) => updateEditField('commonElectricityCharge', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="btn btn-cancel"
                  onClick={() => {
                    setEditErrors({});
                    setShowEdit(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">Add Unit</div>
              <button
                className="modal-close-btn"
                onClick={() => {
                  setUnitErrors({});
                  setShowAddUnit(false);
                }}
                aria-label="Close"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <form onSubmit={addUnit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">Unit Number</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${unitErrors.unitNumber ? 'input-error' : ''}`}
                    placeholder="Unit number"
                    value={unitForm.unitNumber}
                    onChange={(e) => updateUnitField('unitNumber', e.target.value)}
                  />
                  <FieldError message={unitErrors.unitNumber} />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Unit Type</label>
                  <select
                    className="w-full px-3 py-2 mt-1"
                    value={unitForm.unitType}
                    onChange={(e) => updateUnitField('unitType', e.target.value)}
                  >
                    {Object.entries(unitTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Floor</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Floor"
                    value={unitForm.floor}
                    onChange={(e) => updateUnitField('floor', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Size in sq ft (Optional)</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="e.g. 850"
                    value={unitForm.size}
                    onChange={(e) => updateUnitField('size', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Active Since (Optional)</label>
                  <DatePicker
                    className="w-full px-3 py-2 mt-1 rounded-xl border border-black/10"
                    value={unitForm.activeSince}
                    onChange={(next) => updateUnitField('activeSince', next)}
                  />
                </div>
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">Monthly Rent</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${unitErrors.monthlyRent ? 'input-error' : ''}`}
                    placeholder="Monthly rent"
                    value={unitForm.monthlyRent}
                    onChange={(e) => updateUnitField('monthlyRent', e.target.value)}
                  />
                  <FieldError message={unitErrors.monthlyRent} />
                </div>
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">Deposit</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${unitErrors.deposit ? 'input-error' : ''}`}
                    placeholder="Deposit"
                    value={unitForm.deposit}
                    onChange={(e) => updateUnitField('deposit', e.target.value)}
                  />
                  <FieldError message={unitErrors.deposit} />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Last Meter Reading</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Meter reading"
                    value={unitForm.lastMeterReading}
                    onChange={(e) => updateUnitField('lastMeterReading', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Unit'}
                </button>
                <button
                  type="button"
                  className="btn btn-cancel"
                  onClick={() => {
                    setUnitErrors({});
                    setShowAddUnit(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDetails;
