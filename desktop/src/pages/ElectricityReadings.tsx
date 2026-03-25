import { useEffect, useState } from 'react';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import { shiftMonthValue } from '../lib/dateFormat';
import { useDataVersion } from '../lib/dataSync';

type ReadingRow = {
  propertyId: string;
  propertyName: string;
  electricityUnitRate: number;
  commonElectricityCharge: number;
  unitId: string;
  unitNumber: string;
  lastReading: number;
  currentReading: string;
  nextReading: number | null;
  calculatedUnits: number;
  calculatedAmount: number;
  isInvalid?: boolean;
  invalidMessage?: string;
};

const mapRow = (row: any): ReadingRow => ({
  propertyId: row.propertyId,
  propertyName: row.propertyName,
  electricityUnitRate: Number(row.electricityUnitRate || 0),
  commonElectricityCharge: Number(row.commonElectricityCharge || 0),
  unitId: row.unitId,
  unitNumber: row.unitNumber,
  lastReading: Number(row.lastReading || 0),
  currentReading: row.currentReading != null ? String(row.currentReading) : '',
  nextReading: row.nextReading != null ? Number(row.nextReading) : null,
  calculatedUnits: Number(row.calculatedUnits || 0),
  calculatedAmount: Number(row.calculatedAmount || 0),
  isInvalid: false,
  invalidMessage: ''
});

const ElectricityReadings = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [rows, setRows] = useState<ReadingRow[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    const loadRows = async () => {
      if (propertyId) {
        const response = await api.get(
          `/properties/${propertyId}/utility-bills/electricity-readings?month=${month}`
        );
        setRows(
          (response.data?.rows || []).map((row: any) =>
            mapRow({
              ...row,
              propertyId,
              propertyName: properties.find((property) => property._id === propertyId)?.name || 'Property',
              electricityUnitRate: response.data?.rates?.electricityUnitRate || 0,
              commonElectricityCharge: response.data?.rates?.commonElectricityCharge || 0
            })
          )
        );
        return;
      }

      if (!properties.length) {
        setRows([]);
        return;
      }

      const responses = await Promise.all(
        properties.map((property) =>
          api.get(`/properties/${property._id}/utility-bills/electricity-readings?month=${month}`)
        )
      );

      setRows(
        responses.flatMap((response, index) =>
          (response.data?.rows || []).map((row: any) =>
            mapRow({
              ...row,
              propertyId: properties[index]._id,
              propertyName: properties[index].name,
              electricityUnitRate: response.data?.rates?.electricityUnitRate || 0,
              commonElectricityCharge: response.data?.rates?.commonElectricityCharge || 0
            })
          )
        )
      );
    };

    loadRows();
  }, [propertyId, month, properties, dataVersion]);

  const updateReading = (unitId: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.unitId !== unitId) return row;

        const current = Number(value || 0);
        let invalidMessage = '';

        if (value !== '' && current <= row.lastReading) {
          invalidMessage = 'Must be greater than last reading.';
        } else if (value !== '' && row.nextReading != null && current > row.nextReading) {
          invalidMessage = `Must be less than or equal to next saved reading (${row.nextReading}).`;
        }

        const isInvalid = invalidMessage !== '';
        const consumed = isInvalid ? 0 : Math.max(0, current - row.lastReading);
        const amount = Math.floor(consumed * row.electricityUnitRate + row.commonElectricityCharge);

        return {
          ...row,
          currentReading: value,
          calculatedUnits: consumed,
          calculatedAmount: Number.isFinite(amount) ? amount : 0,
          isInvalid,
          invalidMessage
        };
      })
    );
  };

  const saveAll = async () => {
    if (!month) {
      setError('Please select a month.');
      return;
    }

    if (rows.some((row) => row.isInvalid)) {
      setError('Please fix the highlighted readings before saving.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const payload = rows
        .filter((row) => row.currentReading !== '')
        .map((row) => ({
          propertyId: row.propertyId,
          unitId: row.unitId,
          currentReading: Number(row.currentReading)
        }));
      const grouped = payload.reduce<Record<string, Array<{ unitId: string; currentReading: number }>>>((acc, row) => {
        if (!acc[row.propertyId]) acc[row.propertyId] = [];
        acc[row.propertyId].push({ unitId: row.unitId, currentReading: row.currentReading });
        return acc;
      }, {});

      await Promise.all(
        Object.entries(grouped).map(([targetPropertyId, readings]) =>
          api.post(`/properties/${targetPropertyId}/utility-bills/electricity-readings`, {
            month,
            readings
          })
        )
      );

      if (propertyId) {
        const refreshed = await api.get(
          `/properties/${propertyId}/utility-bills/electricity-readings?month=${month}`
        );
        setRows(
          (refreshed.data?.rows || []).map((row: any) =>
            mapRow({
              ...row,
              propertyId,
              propertyName: properties.find((property) => property._id === propertyId)?.name || 'Property',
              electricityUnitRate: refreshed.data?.rates?.electricityUnitRate || 0,
              commonElectricityCharge: refreshed.data?.rates?.commonElectricityCharge || 0
            })
          )
        );
      } else {
        const responses = await Promise.all(
          properties.map((property) =>
            api.get(`/properties/${property._id}/utility-bills/electricity-readings?month=${month}`)
          )
        );
        setRows(
          responses.flatMap((response, index) =>
            (response.data?.rows || []).map((row: any) =>
              mapRow({
                ...row,
                propertyId: properties[index]._id,
                propertyName: properties[index].name,
                electricityUnitRate: response.data?.rates?.electricityUnitRate || 0,
                commonElectricityCharge: response.data?.rates?.commonElectricityCharge || 0
              })
            )
          )
        );
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save readings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
          <button
            type="button"
            className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 active:translate-y-0"
            onClick={() => setMonth((prev) => shiftMonthValue(prev, -1))}
            aria-label="Previous month"
          >
            ←
          </button>
          <input
            type="month"
            className="border border-black/10 rounded-lg px-3 py-2 text-sm"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button
            type="button"
            className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 active:translate-y-0"
            onClick={() => setMonth((prev) => shiftMonthValue(prev, 1))}
            aria-label="Next month"
          >
            →
          </button>
        </div>
        <button
          className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-medium"
          onClick={saveAll}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Readings'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-black/5">
            <tr>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Last Reading</th>
              <th className="px-4 py-3">Current Reading</th>
              <th className="px-4 py-3">Units Used</th>
              <th className="px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.unitId} className="border-b border-black/5">
                <td className="px-4 py-3">{row.propertyName}</td>
                <td className="px-4 py-3">{row.unitNumber}</td>
                <td className="px-4 py-3">{row.lastReading}</td>
                <td className="px-4 py-3">
                  <input
                    className={`border rounded-lg px-3 py-2 text-sm w-32 ${
                      row.isInvalid ? 'border-red-300 bg-red-50' : 'border-black/10'
                    }`}
                    value={row.currentReading}
                    onChange={(e) => updateReading(row.unitId, e.target.value)}
                    placeholder="Reading"
                  />
                  {row.invalidMessage ? (
                    <div className="mt-1 text-xs text-red-600">{row.invalidMessage}</div>
                  ) : row.nextReading != null ? (
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      Next saved reading: {row.nextReading}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">{row.calculatedUnits}</td>
                <td className="px-4 py-3">{`\u20B9${row.calculatedAmount}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="px-4 py-6 text-[var(--muted)]">No units found.</div>}
      </div>

      {error && <div className="text-sm text-[var(--danger)]">{error}</div>}
      <div className="text-xs text-[var(--muted)]">
        You can edit any month. The reading must stay above the previous month and not exceed the next saved month.
      </div>
      <div className="text-xs text-[var(--muted)]">
        Calculation: (Current Reading - Last Reading) x Electricity Unit Rate + Common Electricity Charge
      </div>
    </div>
  );
};

export default ElectricityReadings;

