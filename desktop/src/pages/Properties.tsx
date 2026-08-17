import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useDataVersion } from '../lib/dataSync';
import Badge, { type BadgeTone } from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { BuildingIcon, CloseIcon } from '../components/icons';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirmDialog';

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
      toast.success('Property added.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add property.');
    } finally {
      setLoading(false);
    }
  };

  const restoreProperty = async (propertyId: string, propertyName?: string) => {
    if (!propertyId) return;
    const ok = await confirmDialog({
      title: `Restore ${propertyName ? `"${propertyName}"` : 'this property'}?`,
      confirmLabel: 'Restore'
    });
    if (!ok) return;
    setLoading(true);
    try {
      await api.patch(`/properties/${propertyId}/restore`);
      await loadProperties();
      toast.success('Property restored.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to restore property.');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
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
            Inactive
          </button>
        </div>
        <button
          className="btn btn-primary"
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
              <button className="modal-close-btn" onClick={closeModal} aria-label="Close">
                <CloseIcon width={18} height={18} />
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
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Property'}
                </button>
                <button
                  type="button"
                  className="btn btn-cancel"
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
          <div key={property._id} className="card p-5">
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
                className="btn btn-sm btn-info"
                onClick={() => navigate(`/properties/${property._id}`)}
              >
                View
              </button>
              {tab === 'active' && (
                <button
                  className="btn btn-sm btn-danger"
                  onClick={async () => {
                    const ok = await confirmDialog({
                      title: `Mark ${property.name ? `"${property.name}"` : 'this property'} as inactive?`,
                      description: 'This will hide it from active lists. You can restore it from the Inactive tab.',
                      confirmLabel: 'Deactivate',
                      danger: true
                    });
                    if (!ok) return;
                    setLoading(true);
                    try {
                      await api.delete(`/properties/${property._id}`);
                      await loadProperties();
                      toast.success('Property marked inactive.');
                    } catch (err: any) {
                      toast.error(err?.response?.data?.message || 'Failed to update property.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Deactivate
                </button>
              )}
              {tab === 'deleted' && (
                <button
                  className="btn btn-sm btn-success"
                  onClick={() => restoreProperty(property._id, property.name)}
                >
                  Restore
                </button>
              )}
            </div>
          </div>
        ))}
        {!properties.length && (
          <div className="md:col-span-2 card">
            <EmptyState
              icon={<BuildingIcon width={22} height={22} />}
              title={tab === 'active' ? 'No active properties found' : 'No inactive properties found'}
              description={tab === 'active' ? 'Add your first property to start managing units and tenants.' : 'Properties you deactivate will show up here.'}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Properties;
