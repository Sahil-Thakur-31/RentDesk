import { useEffect, useState } from 'react';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { UtilitiesIcon } from '../components/icons';
import { formatDate } from '../lib/dateFormat';
import { useDataVersion } from '../lib/dataSync';

const Maintenance = () => {
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
        const response = await api.get(`/properties/${propertyId}/maintenance`);
        setRecords(response.data);
        return;
      }
      if (!properties.length) {
        setRecords([]);
        return;
      }
      const responses = await Promise.all(
        properties.map((property) => api.get(`/properties/${property._id}/maintenance`))
      );
      setRecords(
        responses.flatMap((response, index) =>
          (response.data || []).map((record: any) => ({
            ...record,
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
    { key: 'date', label: 'Date', accessor: (record) => new Date(record.date).getTime(), render: (record) => formatDate(record.date) },
    { key: 'category', label: 'Category', accessor: (record) => record.category },
    { key: 'amount', label: 'Amount', accessor: (record) => record.amount, render: (record) => `₹${record.amount}` },
    { key: 'paidTo', label: 'Paid To', accessor: (record) => record.paidTo || '-' }
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
        searchPlaceholder="Search by category, paid to..."
        emptyIcon={<UtilitiesIcon width={22} height={22} />}
        emptyTitle="No maintenance records found"
        emptyDescription="Expenses logged for this property will appear here."
      />
    </div>
  );
};

export default Maintenance;
