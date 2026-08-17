import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import TenantFormModal from '../components/TenantFormModal';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { TenantsIcon } from '../components/icons';
import { useDataVersion } from '../lib/dataSync';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirmDialog';

const Tenants = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [tenants, setTenants] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<'active' | 'deleted'>('active');
  const dataVersion = useDataVersion();

  useEffect(() => {
    const load = async () => {
      const response = await api.get('/properties');
      const list = response.data || [];
      setProperties(list);
    };
    load();
  }, [dataVersion]);

  useEffect(() => {
    const loadTenants = async () => {
      if (propertyId) {
        const response = await api.get(`/properties/${propertyId}/tenants?status=${tab}`);
        setTenants(response.data);
        return;
      }
      if (!properties.length) {
        setTenants([]);
        return;
      }
      const responses = await Promise.all(
        properties.map((property) => api.get(`/properties/${property._id}/tenants?status=${tab}`))
      );
      setTenants(
        responses.flatMap((response, index) =>
          (response.data || []).map((tenant: any) => ({
            ...tenant,
            _propertyId: properties[index]._id,
            _propertyName: properties[index].name
          }))
        )
      );
    };
    loadTenants();
  }, [propertyId, tab, properties, dataVersion]);

  useEffect(() => {
    const loadUnits = async () => {
      if (propertyId) {
        const response = await api.get(`/properties/${propertyId}/units`);
        setUnits((response.data || []).map((unit: any) => ({ ...unit, _propertyId: propertyId })));
        return;
      }
      if (!properties.length) {
        setUnits([]);
        return;
      }
      const responses = await Promise.all(
        properties.map((property) => api.get(`/properties/${property._id}/units`))
      );
      setUnits(
        responses.flatMap((response, index) =>
          (response.data || []).map((unit: any) => ({
            ...unit,
            _propertyId: properties[index]._id
          }))
        )
      );
    };
    loadUnits();
  }, [propertyId, properties, dataVersion]);

  const refresh = async () => {
    if (propertyId) {
      const [tenantsRes, unitsRes] = await Promise.all([
        api.get(`/properties/${propertyId}/tenants?status=${tab}`),
        api.get(`/properties/${propertyId}/units`)
      ]);
      setTenants(tenantsRes.data);
      setUnits((unitsRes.data || []).map((unit: any) => ({ ...unit, _propertyId: propertyId })));
      return;
    }

    const [tenantResponses, unitResponses] = await Promise.all([
      Promise.all(properties.map((property) => api.get(`/properties/${property._id}/tenants?status=${tab}`))),
      Promise.all(properties.map((property) => api.get(`/properties/${property._id}/units`)))
    ]);

    setTenants(
      tenantResponses.flatMap((response, index) =>
        (response.data || []).map((tenant: any) => ({
          ...tenant,
          _propertyId: properties[index]._id,
          _propertyName: properties[index].name
        }))
      )
    );
    setUnits(
      unitResponses.flatMap((response, index) =>
        (response.data || []).map((unit: any) => ({
          ...unit,
          _propertyId: properties[index]._id
        }))
      )
    );
  };

  const tenantColumns: TableColumn<any>[] = [
    {
      key: 'property',
      label: 'Property',
      accessor: (tenant) => tenant._propertyName || properties.find((property) => property._id === propertyId)?.name || '-'
    },
    { key: 'fullName', label: 'Name', accessor: (tenant) => tenant.fullName },
    { key: 'phone', label: 'Phone', accessor: (tenant) => tenant.phone },
    { key: 'unit', label: 'Unit', accessor: (tenant) => tenant.assignedUnit?.unitNumber || '-' },
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

