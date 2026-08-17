import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import { useDataVersion } from '../lib/dataSync';
import Badge, { type BadgeTone } from '../components/Badge';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { CloseIcon, UnitsIcon } from '../components/icons';
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

const Units = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [units, setUnits] = useState<any[]>([]);
  const [tab, setTab] = useState<'active' | 'deleted'>('active');
  const [showAdd, setShowAdd] = useState(false);
  const [formPropertyId, setFormPropertyId] = useState('');
  const [loading, setLoading] = useState(false);
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
    if (!formPropertyId) {
      toast.error('Please select a property.');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/properties/${formPropertyId}/units`, {
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
      toast.success('Unit added.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add unit.');
    } finally {
      setLoading(false);
    }
  };

  const unitColumns: TableColumn<any>[] = [
    {
      key: 'property',
      label: 'Property',
      accessor: (unit) => unit._propertyName || properties.find((property) => property._id === propertyId)?.name || '-'
    },
    { key: 'unitNumber', label: 'Unit', accessor: (unit) => unit.unitNumber },
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
            onClick={() => navigate(`/properties/${unit._propertyId || propertyId}/units/${unit._id}`)}
          >
            View
          </button>
          {tab === 'active' ? (
            <button
              className="btn btn-sm btn-danger"
              onClick={async () => {
                const ok = await confirmDialog({
                  title: `Mark unit "${unit.unitNumber}" as inactive?`,
                  description: 'This will hide it from active lists. You can restore it from the Inactive tab.',
                  confirmLabel: 'Deactivate',
                  danger: true
                });
                if (!ok) return;
                try {
                  const targetPropertyId = unit._propertyId || propertyId;
                  await api.delete(`/properties/${targetPropertyId}/units/${unit._id}`);
                  await loadUnits(propertyId, 'active');
                  toast.success('Unit marked inactive.');
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || 'Failed to update unit.');
                }
              }}
            >
              Deactivate
            </button>
          ) : (
            <button
              className="btn btn-sm btn-success"
              onClick={async () => {
                try {
                  const targetPropertyId = unit._propertyId || propertyId;
                  await api.patch(`/properties/${targetPropertyId}/units/${unit._id}/restore`);
                  await loadUnits(propertyId, 'deleted');
                  toast.success('Unit restored.');
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || 'Failed to restore unit.');
                }
              }}
            >
              Restore
            </button>
          )}
        </div>
      )
    }
  ];

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
        <div className="flex items-center gap-3">
          <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
          <button
            className="btn btn-primary"
            onClick={() => {
              setFormPropertyId(propertyId);
              setShowAdd(true);
            }}
            disabled={tab !== 'active'}
          >
            Add Unit
          </button>
        </div>
      </div>

      <SortableTable
        columns={unitColumns}
        data={units}
        rowKey={(unit) => unit._id}
        searchPlaceholder="Search units by number, floor, property..."
        emptyIcon={<UnitsIcon width={22} height={22} />}
        emptyTitle={tab === 'active' ? 'No active units found' : 'No inactive units found'}
        emptyDescription={tab === 'active' ? 'Add a unit to this property to start tracking rent and occupancy.' : 'Units you deactivate will show up here.'}
      />

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">Add Unit</div>
              <button className="modal-close-btn" onClick={() => setShowAdd(false)} aria-label="Close">
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <form onSubmit={addUnit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs text-[var(--muted)]">Property</label>
                  <select
                    className="w-full px-3 py-2 mt-1"
                    value={formPropertyId}
                    onChange={(e) => setFormPropertyId(e.target.value)}
                    required
                  >
                    <option value="">Select property</option>
                    {properties.map((property) => (
                      <option key={property._id} value={property._id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                <button type="button" className="btn btn-cancel" onClick={() => setShowAdd(false)}>
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

