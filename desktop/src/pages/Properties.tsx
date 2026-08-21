import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { cachedGet, invalidateByTag, isCached } from '../lib/queryCache';
import Badge, { type BadgeTone } from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { SkeletonCardGrid } from '../components/Skeleton';
import { BuildingIcon, CloseIcon } from '../components/icons';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirmDialog';
import FieldError from '../components/FieldError';
import DatePicker from '../components/DatePicker';
import { formatDate } from '../lib/dateFormat';
import { isBlank, requiredMsg, type FieldErrors } from '../lib/validation';

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
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [form, setForm] = useState({
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
  const [errors, setErrors] = useState<FieldErrors>({});

  const [renderedTab, setRenderedTab] = useState(tab);
  if (tab !== renderedTab) {
    setRenderedTab(tab);
    setProperties([]);
    setPropertiesLoading(true);
  }

  useEffect(() => {
    loadProperties(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const loadProperties = async (targetTab: 'active' | 'deleted', options?: { force?: boolean }) => {
    const params = { archived: targetTab === 'deleted' };
    if (options?.force) invalidateByTag('property');
    if (!isCached('/properties', params)) setPropertiesLoading(true);
    try {
      const data = await cachedGet('/properties', params);
      setProperties(data || []);
    } finally {
      setPropertiesLoading(false);
    }
  };

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const validate = () => {
    const next: FieldErrors = {};
    if (isBlank(form.name)) next.name = requiredMsg('Property name');
    if (isBlank(form.address)) next.address = requiredMsg('Address');
    if (isBlank(form.city)) next.city = requiredMsg('City');
    if (isBlank(form.state)) next.state = requiredMsg('State');
    if (isBlank(form.pincode)) next.pincode = requiredMsg('Pincode');
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
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
        size: '',
        notes: '',
        activeSince: '',
        maintenanceCharge: '',
        electricityUnitRate: '',
        commonElectricityCharge: ''
      });
      setErrors({});
      await loadProperties(tab, { force: true });
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
      description: 'Its units will stay inactive — restore any units you need individually from Units.',
      confirmLabel: 'Restore'
    });
    if (!ok) return;
    setLoading(true);
    try {
      await api.patch(`/properties/${propertyId}/restore`);
      await loadProperties(tab, { force: true });
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
      size: '',
      notes: '',
      activeSince: '',
      maintenanceCharge: '',
      electricityUnitRate: '',
      commonElectricityCharge: ''
    });
    setErrors({});
    setShowAdd(true);
  };

  const closeModal = () => {
    setShowAdd(false);
    setErrors({});
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
            <form onSubmit={submit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">Property Name</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${errors.name ? 'input-error' : ''}`}
                    placeholder="Property name"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                  <FieldError message={errors.name} />
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
                <div className="relative md:col-span-2">
                  <label className="text-xs text-[var(--muted)]">Address</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${errors.address ? 'input-error' : ''}`}
                    placeholder="Address"
                    value={form.address}
                    onChange={(e) => updateField('address', e.target.value)}
                  />
                  <FieldError message={errors.address} />
                </div>
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">City</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${errors.city ? 'input-error' : ''}`}
                    placeholder="City"
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                  />
                  <FieldError message={errors.city} />
                </div>
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">State</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${errors.state ? 'input-error' : ''}`}
                    placeholder="State"
                    value={form.state}
                    onChange={(e) => updateField('state', e.target.value)}
                  />
                  <FieldError message={errors.state} />
                </div>
                <div className="relative">
                  <label className="text-xs text-[var(--muted)]">Pincode</label>
                  <input
                    className={`w-full px-3 py-2 mt-1 ${errors.pincode ? 'input-error' : ''}`}
                    placeholder="Pincode"
                    value={form.pincode}
                    onChange={(e) => updateField('pincode', e.target.value)}
                  />
                  <FieldError message={errors.pincode} />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Size in sq ft (Optional)</label>
                  <input
                    className="w-full px-3 py-2 mt-1"
                    placeholder="e.g. 1200"
                    value={form.size}
                    onChange={(e) => updateField('size', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Active Since (Optional)</label>
                  <DatePicker
                    className="w-full px-3 py-2 mt-1 rounded-xl border border-black/10"
                    value={form.activeSince}
                    onChange={(next) => updateField('activeSince', next)}
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

      {propertiesLoading ? (
        <SkeletonCardGrid count={4} />
      ) : (
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
            {property.activeSince && (
              <div className="text-xs text-[var(--muted)] mt-1">Active since {formatDate(property.activeSince, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            )}
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
                      description: 'This will also deactivate all its units and hide it from active lists. Units with an active tenant must be vacated first — you can restore it later from the Inactive tab.',
                      confirmLabel: 'Deactivate',
                      danger: true
                    });
                    if (!ok) return;
                    setLoading(true);
                    try {
                      await api.delete(`/properties/${property._id}`);
                      await loadProperties(tab, { force: true });
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
      )}
    </div>
  );
};

export default Properties;
