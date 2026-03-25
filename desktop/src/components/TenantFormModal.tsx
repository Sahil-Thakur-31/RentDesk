import { useEffect, useState } from 'react';
import api from '../lib/api';

type TenantFormModalProps = {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  assignedUnitId?: string;
  assignedUnitLabel?: string;
  units?: Array<{ _id: string; unitNumber: string }>;
  onSaved?: () => void;
};

const TenantFormModal = ({
  open,
  onClose,
  propertyId,
  assignedUnitId,
  assignedUnitLabel,
  units = [],
  onSaved
}: TenantFormModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletedTenants, setDeletedTenants] = useState<any[]>([]);
  const [selectedExisting, setSelectedExisting] = useState<any>(null);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    idProofType: '',
    idProofNumber: '',
    emergencyContact: '',
    assignedUnit: assignedUnitId || '',
    depositPaid: ''
  });

  useEffect(() => {
    if (!open || !propertyId) return;
    setError('');
    setForm({
      fullName: '',
      phone: '',
      email: '',
      idProofType: '',
      idProofNumber: '',
      emergencyContact: '',
      assignedUnit: assignedUnitId || '',
      depositPaid: ''
    });
    setSelectedExisting(null);
    const loadDeleted = async () => {
      try {
        const response = await api.get(`/properties/${propertyId}/tenants?status=deleted`);
        setDeletedTenants(response.data || []);
      } catch {
        setDeletedTenants([]);
      }
    };
    loadDeleted();
  }, [open, assignedUnitId, propertyId]);

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'fullName') {
      setSelectedExisting(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (selectedExisting) {
        await api.patch(`/properties/${propertyId}/tenants/${selectedExisting._id}/reactivate`, {
          fullName: form.fullName,
          phone: form.phone,
          email: form.email || undefined,
          idProofType: form.idProofType || undefined,
          idProofNumber: form.idProofNumber || undefined,
          emergencyContact: form.emergencyContact || undefined,
          assignedUnit: form.assignedUnit,
          depositPaid: form.depositPaid ? Number(form.depositPaid) : 0
        });
      } else {
        await api.post(`/properties/${propertyId}/tenants`, {
          fullName: form.fullName,
          phone: form.phone,
          email: form.email || undefined,
          idProofType: form.idProofType || undefined,
          idProofNumber: form.idProofNumber || undefined,
          emergencyContact: form.emergencyContact || undefined,
          assignedUnit: form.assignedUnit,
          depositPaid: form.depositPaid ? Number(form.depositPaid) : 0
        });
      }
      onClose();
      if (onSaved) onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add tenant.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const suggestions = form.fullName
    ? deletedTenants.filter((tenant) =>
        tenant.fullName?.toLowerCase().includes(form.fullName.toLowerCase())
      )
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
      <div className="w-full max-w-4xl bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold">Add Tenant</div>
          <button className="text-sm text-[var(--muted)]" onClick={onClose}>
            Close
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--muted)]">Full Name</label>
              <input
                className="px-3 py-2 mt-1"
                placeholder="Full name"
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                required
              />
              <div className="text-[11px] text-[var(--muted)] mt-1">
                Type a name to find previously deleted tenants.
              </div>
              {!!suggestions.length && (
                <div className="mt-2 border border-black/10 rounded-lg bg-white shadow-sm max-h-32 overflow-y-auto">
                  {suggestions.map((tenant) => (
                    <button
                      key={tenant._id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-black/5"
                      onClick={() => {
                        setSelectedExisting(tenant);
                        setForm((prev) => ({
                          ...prev,
                          fullName: tenant.fullName || '',
                          phone: tenant.phone || '',
                          email: tenant.email || '',
                          idProofType: tenant.idProofType || '',
                          idProofNumber: tenant.idProofNumber || '',
                          emergencyContact: tenant.emergencyContact || ''
                        }));
                      }}
                    >
                      {tenant.fullName} <span className="text-[var(--muted)]">(previous tenant)</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Phone</label>
              <input
                className="px-3 py-2 mt-1"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Email (Optional)</label>
              <input
                className="px-3 py-2 mt-1"
                placeholder="Email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Emergency Contact (Optional)</label>
              <input
                className="px-3 py-2 mt-1"
                placeholder="Emergency contact"
                value={form.emergencyContact}
                onChange={(e) => updateField('emergencyContact', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">ID Proof Type (Optional)</label>
              <input
                className="px-3 py-2 mt-1"
                placeholder="ID proof type"
                value={form.idProofType}
                onChange={(e) => updateField('idProofType', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">ID Proof Number (Optional)</label>
              <input
                className="px-3 py-2 mt-1"
                placeholder="ID proof number"
                value={form.idProofNumber}
                onChange={(e) => updateField('idProofNumber', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Deposit Paid Now (Optional)</label>
              <input
                className="px-3 py-2 mt-1"
                placeholder="How much deposit was received now?"
                value={form.depositPaid}
                onChange={(e) => updateField('depositPaid', e.target.value)}
              />
            </div>
          {assignedUnitId ? (
            <div>
              <label className="text-xs text-[var(--muted)]">Assigned Unit</label>
              <div className="px-3 py-2 mt-1 bg-black/5 rounded-lg text-sm">
                {assignedUnitLabel || assignedUnitId}
              </div>
            </div>
          ) : (
              <div>
                <label className="text-xs text-[var(--muted)]">Assigned Unit</label>
                <select
                  className="px-3 py-2 mt-1"
                  value={form.assignedUnit}
                  onChange={(e) => updateField('assignedUnit', e.target.value)}
                  required
                >
                  <option value="">Select unit</option>
                  {units.map((unit) => (
                    <option key={unit._id} value={unit._id}>
                      {unit.unitNumber}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {selectedExisting && (
            <div className="text-xs text-[var(--muted)] flex items-center justify-between gap-3">
              <span>Using existing tenant record. Details will be updated.</span>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded-lg border border-black/10"
                onClick={() => setSelectedExisting(null)}
              >
                Clear
              </button>
            </div>
          )}
          {error && <div className="text-sm text-[var(--danger)]">{error}</div>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-medium"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Tenant'}
            </button>
            <button type="button" className="text-sm text-[var(--muted)]" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TenantFormModal;
