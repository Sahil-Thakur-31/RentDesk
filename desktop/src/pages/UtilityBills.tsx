import { useEffect, useState } from 'react';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import Badge, { type BadgeTone } from '../components/Badge';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { UtilitiesIcon } from '../components/icons';
import { formatMonthKey } from '../lib/dateFormat';
import { useDataVersion } from '../lib/dataSync';

const statusTone = (status: string): BadgeTone => {
  if (status === 'paid') return 'success';
  if (status === 'partial') return 'warning';
  return 'danger';
};

const UtilityBills = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [bills, setBills] = useState<any[]>([]);
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
    const loadBills = async () => {
      if (propertyId) {
        const response = await api.get(`/properties/${propertyId}/utility-bills`);
        setBills(response.data);
        return;
      }
      if (!properties.length) {
        setBills([]);
        return;
      }
      const responses = await Promise.all(
        properties.map((property) => api.get(`/properties/${property._id}/utility-bills`))
      );
      setBills(
        responses.flatMap((response, index) =>
          (response.data || []).map((bill: any) => ({
            ...bill,
            _propertyName: properties[index].name
          }))
        )
      );
    };
    loadBills();
  }, [propertyId, properties, dataVersion]);

  const columns: TableColumn<any>[] = [
    {
      key: 'property',
      label: 'Property',
      accessor: (bill) => bill._propertyName || properties.find((property) => property._id === propertyId)?.name || '-'
    },
    {
      key: 'billType',
      label: 'Type',
      accessor: (bill) => bill.billType,
      filterOptions: [
        { value: 'electricity', label: 'Electricity' },
        { value: 'water', label: 'Water' }
      ]
    },
    { key: 'month', label: 'Month', accessor: (bill) => bill.month, render: (bill) => formatMonthKey(bill.month) },
    { key: 'units', label: 'Units', accessor: (bill) => bill.unitsConsumed },
    { key: 'amount', label: 'Amount', accessor: (bill) => bill.amount, render: (bill) => `₹${bill.amount}` },
    {
      key: 'status',
      label: 'Status',
      accessor: (bill) => bill.status,
      filterOptions: [
        { value: 'paid', label: 'Paid' },
        { value: 'partial', label: 'Partial' },
        { value: 'unpaid', label: 'Unpaid' }
      ],
      render: (bill) => <Badge tone={statusTone(bill.status)}>{bill.status}</Badge>
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
      </div>

      <SortableTable
        columns={columns}
        data={bills}
        rowKey={(bill) => bill._id}
        searchPlaceholder="Search by property, type..."
        emptyIcon={<UtilitiesIcon width={22} height={22} />}
        emptyTitle="No utility bills found"
        emptyDescription="Record an electricity or water reading to generate a bill for a unit."
      />
    </div>
  );
};

export default UtilityBills;
