import { useEffect, useState } from 'react';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import { formatMonthKey } from '../lib/dateFormat';
import { useDataVersion } from '../lib/dataSync';

const statusColor = (status: string) => {
  if (status === 'paid') return 'text-[var(--success)]';
  if (status === 'partial') return 'text-[var(--warning)]';
  return 'text-[var(--danger)]';
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-black/5">
            <tr>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3">Units</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill._id} className="border-b border-black/5">
                <td className="px-4 py-3">{bill._propertyName || properties.find((property) => property._id === propertyId)?.name || '-'}</td>
                <td className="px-4 py-3">{bill.billType}</td>
                <td className="px-4 py-3">{formatMonthKey(bill.month)}</td>
                <td className="px-4 py-3">{bill.unitsConsumed}</td>
                <td className="px-4 py-3">₹{bill.amount}</td>
                <td className={`px-4 py-3 ${statusColor(bill.status)}`}>{bill.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!bills.length && (
          <div className="px-4 py-6 text-[var(--muted)]">
            No utility bills found.
          </div>
        )}
      </div>
    </div>
  );
};

export default UtilityBills;

