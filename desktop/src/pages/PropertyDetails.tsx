import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import Badge, { type BadgeTone } from '../components/Badge';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { CloseIcon, UnitsIcon } from '../components/icons';
import { useDataVersion } from '../lib/dataSync';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirmDialog';

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
  const [loading, setLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const dataVersion = useDataVersion();
  const [editForm, setEditForm] = useState({
    name: '',
    propertyType: 'building',
    address: '',
    city: '',
    state: '',
    pincode: '',
    notes: '',
    maintenanceCharge: '',
    electricityUnitRate: '',
    commonElectricityCharge: ''
  });
  const [unitForm, setUnitForm] = useState({
    unitNumber: '',
    unitType: '1bhk',
    floor: '',
    size: '',
    monthlyRent: '',
    deposit: '',
    lastMeterReading: ''
  });

  useEffect(() => {
    if (!propertyId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [propertyRes, overviewRes, unitsRes] = await Promise.all([
          api.get(`/properties/${propertyId}`),
          api.get(`/properties/${propertyId}/overview`),
          api.get(`/properties/${propertyId}/units`)
        ]);
        setProperty(propertyRes.data);
        setOverview(overviewRes.data);
        setUnits(unitsRes.data);
        setEditForm({
          name: propertyRes.data.name || '',
          propertyType: propertyRes.data.propertyType || 'building',
          address: propertyRes.data.address || '',
          city: propertyRes.data.city || '',
          state: propertyRes.data.state || '',
          pincode: propertyRes.data.pincode || '',
          notes: propertyRes.data.notes || '',
          maintenanceCharge: String(propertyRes.data.maintenanceCharge ?? ''),
          electricityUnitRate: String(propertyRes.data.electricityUnitRate ?? ''),
          commonElectricityCharge: String(propertyRes.data.commonElectricityCharge ?? '')
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [propertyId, dataVersion]);

  const updateEditField = (key: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateUnitField = (key: string, value: string) => {
    setUnitForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    setLoading(true);
    try {
      const payload = {
        ...editForm,
        maintenanceCharge: editForm.maintenanceCharge ? Number(editForm.maintenanceCharge) : undefined,
        electricityUnitRate: editForm.electricityUnitRate ? Number(editForm.electricityUnitRate) : undefined,
        commonElectricityCharge: editForm.commonElectricityCharge ? Number(editForm.commonElectricityCharge) : undefined
      };
      const response = await api.patch(`/properties/${propertyId}`, payload);
      setProperty(response.data);
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
    const ok = await confirmDialog({
      title: `Mark "${property.name}" as inactive?`,
      description: 'This will hide it from active lists. You can restore it later.',
      confirmLabel: 'Deactivate',
      danger: true
    });
    if (!ok) return;
    setLoading(true);
    try {
      await api.delete(`/properties/${propertyId}`);
      navigate('/properties');
      toast.success('Property marked inactive.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update property.');
    } finally {
      setLoading(false);
    }
  };

  const restoreProperty = async () => {
    if (!propertyId || !property?.name) return;
    const ok = await confirmDialog({ title: `Restore "${property.name}"?`, confirmLabel: 'Restore' });
    if (!ok) return;
    setLoading(true);
    try {
      await api.patch(`/properties/${propertyId}/restore`);
      const refreshed = await api.get(`/properties/${propertyId}`);
      setProperty(refreshed.data);
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
    setLoading(true);
    try {
      await api.post(`/properties/${propertyId}/units`, {
        unitNumber: unitForm.unitNumber,
        unitType: unitForm.unitType,
        floor: unitForm.floor || undefined,
        size: unitForm.size || undefined,
        monthlyRent: Number(unitForm.monthlyRent),
        deposit: Number(unitForm.deposit),
        lastMeterReading: unitForm.lastMeterReading ? Number(unitForm.lastMeterReading) : undefined
      });
      const unitsRes = await api.get(`/properties/${propertyId}/units`);
      setUnits(unitsRes.data);
      setUnitForm({
        unitNumber: '',
        unitType: '1bhk',
        floor: '',
        size: '',
        monthlyRent: '',
        deposit: '',
        lastMeterReading: ''
      });
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
      const unitsRes = await api.get(`/properties/${propertyId}/units`);
      setUnits(unitsRes.data);
      toast.success('Unit marked inactive.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update unit.');
    } finally {
      setLoading(false);
    }
  };

  if (!property && loading) {
    return <div className="text-sm text-[var(--muted)]">Loading property...</div>;
  }

  if (!property) {
    return <div className="text-sm text-[var(--muted)]">Property not found.</div>;
  }

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
    { key: 'rent', label: 'Rent', accessor: (unit) => unit.monthlyRent, render: (unit) => `₹${unit.monthlyRent}` },
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
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold">{property.name}</div>
              <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
                {property.propertyType}
              </span>
              {property.isArchived && (
                <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-red-50 text-red-600">
                  Inactive
                </span>
              )}
            </div>
            <div className="text-sm text-[var(--muted)]">{property.address}</div>
            <div className="text-xs text-[var(--muted)] mt-1">
              {property.city}, {property.state} - {property.pincode}
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
                  onClick={() => setShowEdit(true)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger"
                  onClick={deleteProperty}
                >
                  Deactivate
                </button>
              </>
            )}
          </div>
        </div>
        {property.notes && <div className="text-sm text-[var(--muted)]">{property.notes}</div>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card p-6 space-y-4">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Units & Occupancy</div>
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
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <div>Vacant: {totals.vacantUnits || 0}</div>
            <div>Total: {totals.totalUnits || 0}</div>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Rent This Month</div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-semibold">{'\u20B9'}{totals.collectedRent || 0}</div>
              <div className="text-xs text-[var(--muted)]">Collected</div>
            </div>
            <div className="text-sm text-[var(--muted)]">{collectionRate}%</div>
          </div>
          <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${collectionRate}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <div>Expected: {'\u20B9'}{totals.monthlyExpectedRent || 0}</div>
            <div>Pending: {'\u20B9'}{totals.pendingRent || 0}</div>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Charges & Rates</div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Maintenance / month</span>
              <span className="font-semibold">{'\u20B9'}{property.maintenanceCharge || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Electricity per unit</span>
              <span className="font-semibold">{'\u20B9'}{property.electricityUnitRate || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Common electricity</span>
              <span className="font-semibold">{'\u20B9'}{property.commonElectricityCharge || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Units</div>
        {!property.isArchived && (
          <button
            className="btn btn-primary"
            onClick={() => setShowAddUnit(true)}
          >
            Add Unit
          </button>
        )}
      </div>

      <SortableTable
        columns={unitColumns}
        data={units}
        rowKey={(unit) => unit._id}
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
              <button className="modal-close-btn" onClick={() => setShowEdit(false)} aria-label="Close">
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <form onSubmit={saveProperty} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--muted)]">Property Name</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Property name"
                    value={editForm.name}
                    onChange={(e) => updateEditField('name', e.target.value)}
                    required
                  />
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
                <div className="md:col-span-2">
                  <label className="text-xs text-[var(--muted)]">Address</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Address"
                    value={editForm.address}
                    onChange={(e) => updateEditField('address', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">City</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="City"
                    value={editForm.city}
                    onChange={(e) => updateEditField('city', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">State</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="State"
                    value={editForm.state}
                    onChange={(e) => updateEditField('state', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Pincode</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Pincode"
                    value={editForm.pincode}
                    onChange={(e) => updateEditField('pincode', e.target.value)}
                    required
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
                  onClick={() => setShowEdit(false)}
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
              <button className="modal-close-btn" onClick={() => setShowAddUnit(false)} aria-label="Close">
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <form onSubmit={addUnit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--muted)]">Unit Number</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Unit number"
                    value={unitForm.unitNumber}
                    onChange={(e) => updateUnitField('unitNumber', e.target.value)}
                    required
                  />
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
                  <label className="text-xs text-[var(--muted)]">Size (Optional)</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Size"
                    value={unitForm.size}
                    onChange={(e) => updateUnitField('size', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Monthly Rent</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Monthly rent"
                    value={unitForm.monthlyRent}
                    onChange={(e) => updateUnitField('monthlyRent', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Deposit</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Deposit"
                    value={unitForm.deposit}
                    onChange={(e) => updateUnitField('deposit', e.target.value)}
                    required
                  />
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
                  onClick={() => setShowAddUnit(false)}
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
