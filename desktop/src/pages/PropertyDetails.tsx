import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { useDataVersion } from '../lib/dataSync';

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

const PropertyDetails = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [error, setError] = useState('');
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
    setError('');
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
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update property.');
    } finally {
      setLoading(false);
    }
  };

  const deleteProperty = async () => {
    if (!propertyId || !property?.name) return;
    const ok = window.confirm(`Delete "${property.name}"? This will hide it from all lists.`);
    if (!ok) return;
    setLoading(true);
    try {
      await api.delete(`/properties/${propertyId}`);
      navigate('/properties');
    } finally {
      setLoading(false);
    }
  };

  const restoreProperty = async () => {
    if (!propertyId || !property?.name) return;
    const ok = window.confirm(`Restore "${property.name}"?`);
    if (!ok) return;
    setLoading(true);
    try {
      await api.patch(`/properties/${propertyId}/restore`);
      const refreshed = await api.get(`/properties/${propertyId}`);
      setProperty(refreshed.data);
    } finally {
      setLoading(false);
    }
  };

  const addUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    setError('');
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
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add unit.');
    } finally {
      setLoading(false);
    }
  };

  const deleteUnit = async (unitId: string, unitNumber?: string) => {
    if (!propertyId) return;
    const ok = window.confirm(`Delete unit ${unitNumber ? `"${unitNumber}"` : ''}? This will hide it from lists.`);
    if (!ok) return;
    setLoading(true);
    try {
      await api.delete(`/properties/${propertyId}/units/${unitId}`);
      const unitsRes = await api.get(`/properties/${propertyId}/units`);
      setUnits(unitsRes.data);
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold">{property.name}</div>
              <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
                {property.propertyType}
              </span>
              {property.isArchived && (
                <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-red-50 text-red-600">
                  Deleted
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
                className="px-4 py-2 rounded-xl text-sm border border-emerald-200 text-emerald-600 bg-emerald-50"
                onClick={restoreProperty}
              >
                Restore
              </button>
            ) : (
              <>
                <button
                  className="px-4 py-2 rounded-xl text-sm border border-black/10"
                  onClick={() => setShowEdit(true)}
                >
                  Edit
                </button>
                <button
                  className="px-4 py-2 rounded-xl text-sm border border-red-200 text-red-600 bg-red-50"
                  onClick={deleteProperty}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
        {property.notes && <div className="text-sm text-[var(--muted)]">{property.notes}</div>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm space-y-4">
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

        <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm space-y-4">
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

        <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm space-y-4">
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
            className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-medium"
            onClick={() => setShowAddUnit(true)}
          >
            Add Unit
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-black/5">
            <tr>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Floor</th>
              <th className="px-4 py-3">Meter Reading</th>
              <th className="px-4 py-3">Rent</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit._id} className="border-b border-black/5">
                <td className="px-4 py-3">{unit.unitNumber}</td>
                <td className="px-4 py-3">{unitTypeLabels[unit.unitType] || unit.unitType}</td>
                <td className="px-4 py-3">{unit.floor || '-'}</td>
                <td className="px-4 py-3">{unit.lastMeterReading ?? 0}</td>
                <td className="px-4 py-3">₹{unit.monthlyRent}</td>
                <td className="px-4 py-3">{formatUnitStatus(unit.status)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs px-3 py-1.5 rounded-lg border border-black/10"
                      onClick={() => navigate(`/properties/${propertyId}/units/${unit._id}`)}
                    >
                      View
                    </button>
                    <button
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50"
                      onClick={() => deleteUnit(unit._id, unit.unitNumber)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!units.length && <div className="px-4 py-6 text-[var(--muted)]">No units added yet.</div>}
      </div>

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">Edit Property</div>
              <button className="text-sm text-[var(--muted)]" onClick={() => setShowEdit(false)}>
                Close
              </button>
            </div>
            <form onSubmit={saveProperty} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--muted)]">Property Name</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Property name"
                    value={editForm.name}
                    onChange={(e) => updateEditField('name', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Property Type</label>
                  <select
                    className="px-3 py-2 mt-1"
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
                    className="px-3 py-2 mt-1"
                    placeholder="Address"
                    value={editForm.address}
                    onChange={(e) => updateEditField('address', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">City</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="City"
                    value={editForm.city}
                    onChange={(e) => updateEditField('city', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">State</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="State"
                    value={editForm.state}
                    onChange={(e) => updateEditField('state', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Pincode</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Pincode"
                    value={editForm.pincode}
                    onChange={(e) => updateEditField('pincode', e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-[var(--muted)]">Notes (Optional)</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Notes"
                    value={editForm.notes}
                    onChange={(e) => updateEditField('notes', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Maintenance Charge (Monthly)</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Maintenance charge"
                    value={editForm.maintenanceCharge}
                    onChange={(e) => updateEditField('maintenanceCharge', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Electricity Unit Rate</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Rate per unit"
                    value={editForm.electricityUnitRate}
                    onChange={(e) => updateEditField('electricityUnitRate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Common Electricity Charge</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Common charge"
                    value={editForm.commonElectricityCharge}
                    onChange={(e) => updateEditField('commonElectricityCharge', e.target.value)}
                  />
                </div>
              </div>
              {error && <div className="text-sm text-[var(--danger)]">{error}</div>}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-medium"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="text-sm text-[var(--muted)]"
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
              <button className="text-sm text-[var(--muted)]" onClick={() => setShowAddUnit(false)}>
                Close
              </button>
            </div>
            <form onSubmit={addUnit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--muted)]">Unit Number</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Unit number"
                    value={unitForm.unitNumber}
                    onChange={(e) => updateUnitField('unitNumber', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Unit Type</label>
                  <select
                    className="px-3 py-2 mt-1"
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
                    className="px-3 py-2 mt-1"
                    placeholder="Floor"
                    value={unitForm.floor}
                    onChange={(e) => updateUnitField('floor', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Size (Optional)</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Size"
                    value={unitForm.size}
                    onChange={(e) => updateUnitField('size', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Monthly Rent</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Monthly rent"
                    value={unitForm.monthlyRent}
                    onChange={(e) => updateUnitField('monthlyRent', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Deposit</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Deposit"
                    value={unitForm.deposit}
                    onChange={(e) => updateUnitField('deposit', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Last Meter Reading</label>
                  <input
                    className="px-3 py-2 mt-1"
                    placeholder="Meter reading"
                    value={unitForm.lastMeterReading}
                    onChange={(e) => updateUnitField('lastMeterReading', e.target.value)}
                  />
                </div>
              </div>
              {error && <div className="text-sm text-[var(--danger)]">{error}</div>}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-medium"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Unit'}
                </button>
                <button
                  type="button"
                  className="text-sm text-[var(--muted)]"
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
