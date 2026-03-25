import { useEffect, useState } from 'react';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
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
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Paid To</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record._id} className="border-b border-black/5">
                <td className="px-4 py-3">{record._propertyName || properties.find((property) => property._id === propertyId)?.name || '-'}</td>
                <td className="px-4 py-3">{formatDate(record.date)}</td>
                <td className="px-4 py-3">{record.category}</td>
                <td className="px-4 py-3">₹{record.amount}</td>
                <td className="px-4 py-3">{record.paidTo || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!records.length && (
          <div className="px-4 py-6 text-[var(--muted)]">
            No maintenance records found.
          </div>
        )}
      </div>
    </div>
  );
};

export default Maintenance;

