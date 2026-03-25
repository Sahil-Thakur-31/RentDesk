import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
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

const Units = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [units, setUnits] = useState<any[]>([]);
  const [tab, setTab] = useState<'active' | 'deleted'>('active');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dataVersion = useDataVersion();
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
    const load = async () => {
      const response = await api.get('/properties');
      const list = response.data || [];
      setProperties(list);
    };
    load();
  }, [dataVersion]);

  const loadUnits = async (targetPropertyId: string, targetTab: 'active' | 'deleted') => {
    if (targetPropertyId) {
      const response = await api.get(
        `/properties/${targetPropertyId}/units?archived=${targetTab === 'deleted'}`
      );
      setUnits(response.data);
      return;
    }

    if (!properties.length) {
      setUnits([]);
      return;
    }

    const responses = await Promise.all(
      properties.map((property) =>
        api.get(`/properties/${property._id}/units?archived=${targetTab === 'deleted'}`)
      )
    );
    setUnits(
      responses.flatMap((response, index) =>
        (response.data || []).map((unit: any) => ({
          ...unit,
          _propertyId: properties[index]._id,
          _propertyName: properties[index].name
        }))
      )
    );
  };

  useEffect(() => {
    loadUnits(propertyId, tab);
  }, [propertyId, tab, properties, dataVersion]);

  const updateUnitField = (key: string, value: string) => {
    setUnitForm((prev) => ({ ...prev, [key]: value }));
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
      await loadUnits(propertyId, 'active');
      setTab('active');
      setUnitForm({
        unitNumber: '',
        unitType: '1bhk',
        floor: '',
        size: '',
        monthlyRent: '',
        deposit: '',
        lastMeterReading: ''
      });
      setShowAdd(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add unit.');
    } finally {
      setLoading(false);
    }
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
        <div className="flex items-center gap-3">
          <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
          <button
            className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-medium"
            onClick={() => setShowAdd(true)}
            disabled={!propertyId || tab !== 'active'}
          >
            Add Unit
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-black/5">
            <tr>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Unit</th>
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
                <td className="px-4 py-3">{unit._propertyName || properties.find((property) => property._id === propertyId)?.name || '-'}</td>
                <td className="px-4 py-3">{unit.unitNumber}</td>
                <td className="px-4 py-3">{unit.floor || '-'}</td>
                <td className="px-4 py-3">{unit.lastMeterReading ?? 0}</td>
                <td className="px-4 py-3">₹{unit.monthlyRent}</td>
                <td className="px-4 py-3">{formatUnitStatus(unit.status)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs px-3 py-1.5 rounded-lg border border-black/10"
                      onClick={() => navigate(`/properties/${unit._propertyId || propertyId}/units/${unit._id}`)}
                    >
                      View
                    </button>
                    {tab === 'active' ? (
                      <button
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50"
                        onClick={async () => {
                          const ok = window.confirm(`Delete unit "${unit.unitNumber}"? This will hide it from lists.`);
                          if (!ok) return;
                          const targetPropertyId = unit._propertyId || propertyId;
                          await api.delete(`/properties/${targetPropertyId}/units/${unit._id}`);
                          await loadUnits(propertyId, 'active');
                        }}
                      >
                        Delete
                      </button>
                    ) : (
                      <button
                        className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 bg-emerald-50"
                        onClick={async () => {
                          const targetPropertyId = unit._propertyId || propertyId;
                          await api.patch(`/properties/${targetPropertyId}/units/${unit._id}/restore`);
                          await loadUnits(propertyId, 'deleted');
                        }}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!units.length && (
          <div className="px-4 py-6 text-[var(--muted)]">
            {tab === 'active' ? 'No active units found.' : 'No deleted units found.'}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">Add Unit</div>
              <button className="text-sm text-[var(--muted)]" onClick={() => setShowAdd(false)}>
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
                <button type="button" className="text-sm text-[var(--muted)]" onClick={() => setShowAdd(false)}>
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

export default Units;

