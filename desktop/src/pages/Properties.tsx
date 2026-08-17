import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useDataVersion } from '../lib/dataSync';
import Badge, { type BadgeTone } from '../components/Badge';

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

const Properties = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<any[]>([]);
  const [tab, setTab] = useState<'active' | 'deleted'>('active');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dataVersion = useDataVersion();
  const [form, setForm] = useState({
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

  useEffect(() => {
    loadProperties();
  }, [tab, dataVersion]);

  const loadProperties = async () => {
    const response = await api.get(`/properties?archived=${tab === 'deleted'}`);
    setProperties(response.data);
  };

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        maintenanceCharge: form.maintenanceCharge ? Number(form.maintenanceCharge) : undefined,
        electricityUnitRate: form.electricityUnitRate ? Number(form.electricityUnitRate) : undefined,
        commonElectricityCharge: form.commonElectricityCharge ? Number(form.commonElectricityCharge) : undefined
      };
      await api.post('/properties', payload);
      setShowAdd(false);
      setForm({
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
      await loadProperties();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add property.');
    } finally {
      setLoading(false);
    }
  };

  const restoreProperty = async (propertyId: string, propertyName?: string) => {
    if (!propertyId) return;
    const ok = window.confirm(`Restore ${propertyName ? `"${propertyName}"` : 'this property'}?`);
    if (!ok) return;
    setError('');
    setLoading(true);
    try {
      await api.patch(`/properties/${propertyId}/restore`);
      await loadProperties();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to restore property.');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setError('');
    setForm({
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
    setShowAdd(true);
  };

  const closeModal = () => {
    setShowAdd(false);
    setError('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            className={`px-4 py-2 rounded-full text-sm border ${
              tab === 'active'
                ? 'bg-[var(--accent)] text-white border-transparent'
                : 'border-black/10 text-[var(--muted)]'
            }`}
            onClick={() => setTab('active')}
          >
            Active
          </button>
          <button
            className={`px-4 py-2 rounded-full text-sm border ${
              tab === 'deleted'
                ? 'bg-[var(--danger)] text-white border-transparent'
                : 'border-black/10 text-[var(--muted)]'
            }`}
            onClick={() => setTab('deleted')}
          >
            Deleted
          </button>
        </div>
        <button
          className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-medium shadow-[0_10px_20px_rgba(15,118,110,0.25)]"
          onClick={openAdd}
        >
          Add Property
        </button>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
        <div className="w-full max-w-4xl bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">New Property</div>
              <button className="text-sm text-[var(--muted)]" onClick={closeModal}>
                Close
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--muted)]">Property Name</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Property name"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Property Type</label>
                  <select
                    className="w-full px-3 py-2 mt-1"
                    value={form.propertyType}
                    onChange={(e) => updateField('propertyType', e.target.value)}
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
                    value={form.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">City</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="City"
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">State</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="State"
                    value={form.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Pincode</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Pincode"
                    value={form.pincode}
                    onChange={(e) => updateField('pincode', e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-[var(--muted)]">Notes (Optional)</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Notes"
                    value={form.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Maintenance Charge (Monthly)</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Maintenance charge"
                    value={form.maintenanceCharge}
                    onChange={(e) => updateField('maintenanceCharge', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Electricity Unit Rate</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Rate per unit"
                    value={form.electricityUnitRate}
                    onChange={(e) => updateField('electricityUnitRate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Common Electricity Charge</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="Common charge"
                    value={form.commonElectricityCharge}
                    onChange={(e) => updateField('commonElectricityCharge', e.target.value)}
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
                  {loading ? 'Saving...' : 'Save Property'}
                </button>
                <button
                  type="button"
                  className="text-sm text-[var(--muted)]"
                  onClick={closeModal}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {properties.map((property) => (
          <div key={property._id} className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="text-lg font-semibold">{property.name}</div>
              <Badge tone={propertyTypeTone[property.propertyType] || 'neutral'}>
                {propertyTypeLabels[property.propertyType] || property.propertyType}
              </Badge>
            </div>
            <div className="text-sm text-[var(--muted)]">{property.address}</div>
            <div className="text-xs text-[var(--muted)] mt-2">{property.city}, {property.state}</div>
            <div className="mt-4 flex items-center gap-2">
              <button
                className="text-sm px-3 py-1.5 rounded-lg border border-black/10"
                onClick={() => navigate(`/properties/${property._id}`)}
              >
                View
              </button>
              {tab === 'active' && (
                <button
                  className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50"
                  onClick={async () => {
                    const ok = window.confirm(
                      `Delete ${property.name ? `"${property.name}"` : 'this property'}? This will hide it from all lists.`
                    );
                    if (!ok) return;
                    setLoading(true);
                    try {
                      await api.delete(`/properties/${property._id}`);
                      await loadProperties();
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Delete
                </button>
              )}
              {tab === 'deleted' && (
                <button
                  className="text-sm px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 bg-emerald-50"
                  onClick={() => restoreProperty(property._id, property.name)}
                >
                  Restore
                </button>
              )}
            </div>
          </div>
        ))}
        {!properties.length && (
          <div className="text-[var(--muted)]">
            {tab === 'active' ? 'No active properties found.' : 'No deleted properties found.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default Properties;
