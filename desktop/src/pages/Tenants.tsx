import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import TenantFormModal from '../components/TenantFormModal';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { TenantsIcon } from '../components/icons';
import { cachedGet, invalidateByTag, isCached, useCachedQuery } from '../lib/queryCache';
import { formatDate } from '../lib/dateFormat';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirmDialog';

const Tenants = () => {
  const navigate = useNavigate();
  const { data: propertiesData, loading: propertiesLoading } = useCachedQuery<any[]>('/properties');
  const properties = propertiesData || [];
  const [propertyId, setPropertyId] = useState('');
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantsTotal, setTenantsTotal] = useState(0);
  const [units, setUnits] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<'active' | 'deleted'>('active');
  const [tenantsLoading, setTenantsLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const isServerMode = Boolean(propertyId);

  const loadTenants = async (
    targetPropertyId: string,
    targetTab: 'active' | 'deleted',
    options?: { force?: boolean }
  ) => {
    const targets = targetPropertyId ? [{ _id: targetPropertyId }] : properties;
    if (options?.force) {
      if (targetPropertyId) invalidateByTag('tenant', targetPropertyId);
      else properties.forEach((property) => invalidateByTag('tenant', property._id));
    }

    if (targetPropertyId) {
      const params = {
        status: targetTab,
        page,
        limit: pageSize,
        search: search || undefined,
        sortKey: sortKey || undefined,
        sortDir
      };
      if (!isCached(`/properties/${targetPropertyId}/tenants`, params)) setTenantsLoading(true);
      try {
        const result = await cachedGet(`/properties/${targetPropertyId}/tenants`, params);
        setTenants(result?.data || []);
        setTenantsTotal(result?.total || 0);
      } finally {
        setTenantsLoading(false);
      }
      return;
    }

    const allCached = targets.every((property) => isCached(`/properties/${property._id}/tenants`, { status: targetTab }));
    if (!allCached) setTenantsLoading(true);

    try {
      if (!properties.length) {
        setTenants([]);
        setTenantsTotal(0);
        return;
      }
      const responses = await Promise.all(
        properties.map((property) => cachedGet(`/properties/${property._id}/tenants`, { status: targetTab }))
      );
      const merged = responses.flatMap((data, index) =>
        (data || []).map((tenant: any) => ({
          ...tenant,
          _propertyId: properties[index]._id,
          _propertyName: properties[index].name
        }))
      );
      setTenants(merged);
      setTenantsTotal(merged.length);
    } finally {
      setTenantsLoading(false);
    }
  };

  const loadUnits = async (targetPropertyId: string) => {
    if (targetPropertyId) {
      const data = await cachedGet(`/properties/${targetPropertyId}/units`);
      setUnits((data || []).map((unit: any) => ({ ...unit, _propertyId: targetPropertyId })));
      return;
    }
    if (!properties.length) {
      setUnits([]);
      return;
    }
    const responses = await Promise.all(properties.map((property) => cachedGet(`/properties/${property._id}/units`)));
    setUnits(
      responses.flatMap((data, index) =>
        (data || []).map((unit: any) => ({
          ...unit,
          _propertyId: properties[index]._id
        }))
      )
    );
  };

  const scopeKey = `${propertyId}::${tab}`;
  const [renderedScopeKey, setRenderedScopeKey] = useState(scopeKey);
  if (scopeKey !== renderedScopeKey) {
    setRenderedScopeKey(scopeKey);
    setTenants([]);
    setTenantsTotal(0);
    setTenantsLoading(true);
    setPage(1);
    setSearch('');
    setSortKey(null);
    setSortDir('asc');
  }

  useEffect(() => {
    if (propertiesLoading) return;
    loadTenants(propertyId, tab);
    loadUnits(propertyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, tab, properties.length, propertiesLoading, page, pageSize, search, sortKey, sortDir]);

  const refresh = async () => {
    await Promise.all([loadTenants(propertyId, tab, { force: true }), loadUnits(propertyId)]);
  };

  const tenantColumns: TableColumn<any>[] = [
    {
      key: 'property',
      label: 'Property',
      sortable: false,
      accessor: (tenant) => tenant._propertyName || properties.find((property) => property._id === propertyId)?.name || '-'
    },
    { key: 'fullName', label: 'Name', accessor: (tenant) => tenant.fullName },
    { key: 'phone', label: 'Phone', accessor: (tenant) => tenant.phone },
    { key: 'unit', label: 'Unit', accessor: (tenant) => tenant.assignedUnit?.unitNumber || '-' },
    {
      key: 'movedInDate',
      label: 'In',
      accessor: (tenant) => new Date(tenant.movedInDate || tenant.createdAt).getTime(),
      render: (tenant) => (
        <span>
          {formatDate(tenant.movedInDate || tenant.createdAt)}
          {tenant.movedOutDate ? ` - ${formatDate(tenant.movedOutDate)}` : ''}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (tenant) => (
        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm btn-info"
            onClick={() => navigate(`/properties/${tenant._propertyId || propertyId}/tenants/${tenant._id}`)}
          >
            View
          </button>
          {tab === 'active' && (
            <button
              className="btn btn-sm btn-danger"
              onClick={async () => {
                const ok = await confirmDialog({
                  title: `Mark "${tenant.fullName}" as inactive?`,
                  description: 'This moves them out of the active tenant list. You can find them again from the Inactive tab.',
                  confirmLabel: 'Deactivate',
                  danger: true
                });
                if (!ok) return;
                try {
                  await api.patch(`/properties/${tenant._propertyId || propertyId}/tenants/${tenant._id}/move-out`);
                  await refresh();
                  toast.success('Tenant marked inactive.');
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || 'Failed to update tenant.');
                }
              }}
            >
              Deactivate
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
            onClick={() => setShowAdd(true)}
            disabled={tab !== 'active'}
          >
            Add Tenant
          </button>
        </div>
      </div>

      <SortableTable
        columns={tenantColumns}
        data={tenants}
        rowKey={(tenant) => tenant._id}
        searchPlaceholder="Search tenants by name, phone, unit..."
        emptyIcon={<TenantsIcon width={22} height={22} />}
        emptyTitle="No tenants found"
        emptyDescription="Add a tenant to a unit to start tracking rent and payments."
        loading={tenantsLoading}
        server={
          isServerMode
            ? {
                page,
                pageSize,
                total: tenantsTotal,
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
                columnFilters: {},
                onColumnFiltersChange: () => {},
                onPageChange: setPage,
                onPageSizeChange: (size) => {
                  setPageSize(size);
                  setPage(1);
                }
              }
            : undefined
        }
      />

      <TenantFormModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        propertyId={propertyId}
        properties={properties}
        units={units}
        onSaved={refresh}
      />
    </div>
  );
};

export default Tenants;
