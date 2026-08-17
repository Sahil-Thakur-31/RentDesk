import { useEffect, useState } from 'react';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import Badge, { type BadgeTone } from '../components/Badge';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { ReportsIcon } from '../components/icons';
import { formatMonthYear } from '../lib/dateFormat';
import { useDataVersion } from '../lib/dataSync';

const statusTone = (status: string): BadgeTone => {
  if (status === 'paid') return 'success';
  if (status === 'partial') return 'warning';
  return 'danger';
};

const RentRecords = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [records, setRecords] = useState<any[]>([]);
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
    const loadRecords = async () => {
      if (propertyId) {
        const response = await api.get(`/properties/${propertyId}/rent-records`);
        setRecords(response.data);
        return;
      }
      if (!properties.length) {
        setRecords([]);
        return;
      }
      const responses = await Promise.all(
        properties.map((property) => api.get(`/properties/${property._id}/rent-records`))
      );
      setRecords(
        responses.flatMap((response, index) =>
          (response.data || []).map((record: any) => ({
            ...record,
            _propertyId: properties[index]._id,
            _propertyName: properties[index].name
          }))
        )
      );
    };
    loadRecords();
  }, [propertyId, properties, dataVersion]);

  const columns: TableColumn<any>[] = [
    {
      key: 'property',
      label: 'Property',
      accessor: (record) => record._propertyName || properties.find((property) => property._id === propertyId)?.name || '-'
    },
    { key: 'tenant', label: 'Tenant', accessor: (record) => record.tenantId?.fullName || '-' },
    { key: 'unit', label: 'Unit', accessor: (record) => record.unitId?.unitNumber || '-' },
    {
      key: 'month',
      label: 'Month',
      accessor: (record) => record.year * 100 + record.month,
      render: (record) => formatMonthYear(record.month, record.year)
    },
    { key: 'amount', label: 'Amount', accessor: (record) => record.rentAmount, render: (record) => `₹${record.rentAmount}` },
    {
      key: 'status',
      label: 'Status',
      accessor: (record) => record.status,
      filterOptions: [
        { value: 'paid', label: 'Paid' },
        { value: 'partial', label: 'Partial' },
        { value: 'unpaid', label: 'Unpaid' }
      ],
      render: (record) => <Badge tone={statusTone(record.status)}>{record.status}</Badge>
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
      </div>

      <SortableTable
        columns={columns}
        data={records}
        rowKey={(record) => record._id}
        searchPlaceholder="Search by tenant, unit, property..."
        emptyIcon={<ReportsIcon width={22} height={22} />}
        emptyTitle="No rent records found"
        emptyDescription="Rent records generate automatically each month once a unit has an active tenant."
      />
    </div>
  );
};

export default RentRecords;
