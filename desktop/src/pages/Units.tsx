import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import { cachedGet, invalidateByTag, isCached, useCachedQuery } from '../lib/queryCache';
import Badge, { type BadgeTone } from '../components/Badge';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { CloseIcon, UnitsIcon } from '../components/icons';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirmDialog';
import { formatCurrency } from '../lib/format';
import FieldError from '../components/FieldError';
import DatePicker from '../components/DatePicker';
import { formatDate } from '../lib/dateFormat';
import { isBlank, isPositiveNumber, isNonNegativeNumber, requiredMsg, type FieldErrors } from '../lib/validation';

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
  const { data: propertiesData, loading: propertiesLoading } = useCachedQuery<any[]>('/properties');
  const properties = propertiesData || [];
  const [propertyId, setPropertyId] = useState('');
  const [units, setUnits] = useState<any[]>([]);
  const [unitsTotal, setUnitsTotal] = useState(0);
  const [tab, setTab] = useState<'active' | 'deleted'>('active');
  const [showAdd, setShowAdd] = useState(false);
  const [formPropertyId, setFormPropertyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [unitsLoading, setUnitsLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const isServerMode = Boolean(propertyId);

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
  const [unitErrors, setUnitErrors] = useState<FieldErrors>({});

  const loadUnits = async (targetPropertyId: string, targetTab: 'active' | 'deleted', options?: { force?: boolean }) => {
    const archived = targetTab === 'deleted';
    const targets = targetPropertyId
      ? [{ _id: targetPropertyId, name: '' }]
      : properties;

    if (options?.force) {
      if (targetPropertyId) {
        invalidateByTag('unit', targetPropertyId);
      } else {
        properties.forEach((property) => invalidateByTag('unit', property._id));
      }
    }

    if (targetPropertyId) {
      const params = {
        archived,
        page,
        limit: pageSize,
        search: search || undefined,
        sortKey: sortKey || undefined,
        sortDir,
        unitStatus: columnFilters.status || undefined
      };
      if (!isCached(`/properties/${targetPropertyId}/units`, params)) setUnitsLoading(true);
      try {
        const result = await cachedGet(`/properties/${targetPropertyId}/units`, params);
        setUnits(result?.data || []);
        setUnitsTotal(result?.total || 0);
      } finally {
        setUnitsLoading(false);
      }
      return;
    }

    const allCached = targets.every((property) => isCached(`/properties/${property._id}/units`, { archived }));
    if (!allCached) setUnitsLoading(true);

    try {
      if (!properties.length) {
        setUnits([]);
        setUnitsTotal(0);
        return;
      }

      const responses = await Promise.all(
        properties.map((property) => cachedGet(`/properties/${property._id}/units`, { archived }))
      );
      const merged = responses.flatMap((data, index) =>
        (data || []).map((unit: any) => ({
          ...unit,
          _propertyId: properties[index]._id,
          _propertyName: properties[index].name
        }))
      );
      setUnits(merged);
      setUnitsTotal(merged.length);
    } finally {
      setUnitsLoading(false);
    }
  };

  const scopeKey = `${propertyId}::${tab}`;
  const [renderedScopeKey, setRenderedScopeKey] = useState(scopeKey);
  if (scopeKey !== renderedScopeKey) {
    setRenderedScopeKey(scopeKey);
    setUnits([]);
    setUnitsTotal(0);
    setUnitsLoading(true);
    setPage(1);
    setSearch('');
    setSortKey(null);
    setSortDir('asc');
    setColumnFilters({});
  }

  useEffect(() => {
    if (propertiesLoading) return;
    loadUnits(propertyId, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, tab, properties.length, propertiesLoading, page, pageSize, search, sortKey, sortDir, columnFilters]);

  const updateUnitField = (key: string, value: string) => {
    setUnitForm((prev) => ({ ...prev, [key]: value }));
    setUnitErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const validateUnitForm = () => {
    const next: FieldErrors = {};
    if (isBlank(formPropertyId)) next.formPropertyId = requiredMsg('Property');
    if (isBlank(unitForm.unitNumber)) next.unitNumber = requiredMsg('Unit number');
    if (!isPositiveNumber(unitForm.monthlyRent)) next.monthlyRent = 'Monthly rent must be greater than 0';
    if (!isNonNegativeNumber(unitForm.deposit)) next.deposit = 'Deposit must be a valid amount';
    setUnitErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const addUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUnitForm()) return;
    setLoading(true);
    try {
      await api.post(`/properties/${formPropertyId}/units`, {
        unitNumber: unitForm.unitNumber,
        unitType: unitForm.unitType,
        floor: unitForm.floor || undefined,
        size: unitForm.size || undefined,
        activeSince: unitForm.activeSince || undefined,
        monthlyRent: Number(unitForm.monthlyRent),
        deposit: Number(unitForm.deposit),
        lastMeterReading: unitForm.lastMeterReading ? Number(unitForm.lastMeterReading) : undefined
      });
      await loadUnits(propertyId, 'active', { force: true });
      setTab('active');
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
      sortable: false,
      accessor: (unit) => unit._propertyName || properties.find((property) => property._id === propertyId)?.name || '-'
    },
    { key: 'unitNumber', label: 'Unit', accessor: (unit) => unit.unitNumber },
    { key: 'floor', label: 'Floor', accessor: (unit) => unit.floor || '-' },
    { key: 'meterReading', label: 'Meter Reading', accessor: (unit) => unit.lastMeterReading ?? 0 },
    {
      key: 'activeSince',
      label: 'Active Since',
      sortable: false,
      accessor: (unit) => (unit.activeSince ? formatDate(unit.activeSince, { day: 'numeric', month: 'short', year: 'numeric' }) : '-')
    },
    { key: 'rent', label: 'Rent', accessor: (unit) => unit.monthlyRent, render: (unit) => `₹${formatCurrency(unit.monthlyRent)}` },
    {
      key: 'status',
      label: 'Status',
      accessor: (unit) => unit.status,
      filterOptions: [
        { value: 'occupied', label: 'Occupied' },
        { value: 'vacant', label: 'Vacant' },
        { value: 'maintenance', label: 'Under Repair' }
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
              disabled={Boolean(unit.currentTenant)}
              title={unit.currentTenant ? 'Move the tenant out before deactivating this unit.' : undefined}
              onClick={async () => {
                if (unit.currentTenant) {
                  toast.error('Cannot deactivate a unit with an active tenant. Move the tenant out first.');
                  return;
                }
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
                  await loadUnits(propertyId, 'active', { force: true });
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
                const ok = await confirmDialog({
                  title: `Restore unit "${unit.unitNumber}"?`,
                  description: 'If this unit\'s property is currently inactive, restoring this unit will also restore the property.',
                  confirmLabel: 'Restore'
                });
                if (!ok) return;
                try {
                  const targetPropertyId = unit._propertyId || propertyId;
                  const response = await api.patch(`/properties/${targetPropertyId}/units/${unit._id}/restore`);
                  await loadUnits(propertyId, 'deleted', { force: true });
                  toast.success(response.data?.propertyRestored ? 'Unit restored — its property was also restored.' : 'Unit restored.');
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
              setUnitErrors({});
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
        loading={unitsLoading}
        server={
          isServerMode
            ? {
                page,
                pageSize,
                total: unitsTotal,
                search,
                onSearchChange: (value) => {
                  setSearch(value);
                  setPage(1);
                },
                sortKey,
                sortDir,
                onSortChange: (key, dir) => {
                  setSortKey(key);
                  setSortDir(dir);
                  setPage(1);
                },
                columnFilters,
                onColumnFiltersChange: (filters) => {
                  setColumnFilters(filters);
                  setPage(1);
                },
                onPageChange: setPage,
                onPageSizeChange: (size) => {
                  setPageSize(size);
                  setPage(1);
                }
              }
            : undefined
        }
      />

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">Add Unit</div>
              <button
                className="modal-close-btn"
                onClick={() => {
                  setUnitErrors({});
                  setShowAdd(false);
                }}
                aria-label="Close"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <form onSubmit={addUnit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative md:col-span-2">
                  <label className="text-xs text-[var(--muted)]">Property</label>
                  <select
                    className={`w-full px-3 py-2 mt-1 ${unitErrors.formPropertyId ? 'input-error' : ''}`}
                    value={formPropertyId}
                    onChange={(e) => {
                      setFormPropertyId(e.target.value);
                      setUnitErrors((prev) => (prev.formPropertyId ? { ...prev, formPropertyId: undefined } : prev));
                    }}
                  >
                    <option value="">Select property</option>
                    {properties.map((property) => (
                      <option key={property._id} value={property._id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={unitErrors.formPropertyId} />
                </div>
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
                    setShowAdd(false);
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

export default Units;

