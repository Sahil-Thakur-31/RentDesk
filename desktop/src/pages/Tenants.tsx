import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import TenantFormModal from '../components/TenantFormModal';
import { useDataVersion } from '../lib/dataSync';

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
        setUnits(response.data);
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
      setUnits(unitsRes.data);
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
            Add Tenant
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-black/5">
            <tr>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant._id} className="border-b border-black/5">
                <td className="px-4 py-3">{tenant._propertyName || properties.find((property) => property._id === propertyId)?.name || '-'}</td>
                <td className="px-4 py-3">{tenant.fullName}</td>
                <td className="px-4 py-3">{tenant.phone}</td>
                <td className="px-4 py-3">{tenant.assignedUnit?.unitNumber || '-'}</td>
                <td className="px-4 py-3">{tenant.isActive ? 'Active' : 'Moved Out'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs px-3 py-1.5 rounded-lg border border-black/10"
                      onClick={() => navigate(`/properties/${tenant._propertyId || propertyId}/tenants/${tenant._id}`)}
                    >
                      View
                    </button>
                    {tab === 'active' && (
                      <button
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50"
                        onClick={async () => {
                          const ok = window.confirm(`Remove "${tenant.fullName}" from this property?`);
                          if (!ok) return;
                          await api.patch(`/properties/${tenant._propertyId || propertyId}/tenants/${tenant._id}/move-out`);
                          await refresh();
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!tenants.length && (
          <div className="px-4 py-6 text-[var(--muted)]">
            No tenants found.
          </div>
        )}
      </div>

      <TenantFormModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        propertyId={propertyId}
        units={units}
        onSaved={refresh}
      />
    </div>
  );
};

export default Tenants;

