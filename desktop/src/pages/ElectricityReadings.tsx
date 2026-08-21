import { useEffect, useState } from 'react';
import api from '../lib/api';
import PropertyPicker from '../components/PropertyPicker';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { UnitsIcon } from '../components/icons';
import DatePicker from '../components/DatePicker';
import { shiftMonthValue } from '../lib/dateFormat';
import { cachedGet, invalidateByTag, isCached, useCachedQuery } from '../lib/queryCache';
import { toast } from '../lib/toast';
import { formatCurrency } from '../lib/format';
import FieldError from '../components/FieldError';

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
  const { data: propertiesData, loading: propertiesLoading } = useCachedQuery<any[]>('/properties');
  const properties = propertiesData || [];
  const [propertyId, setPropertyId] = useState('');
  const [rows, setRows] = useState<ReadingRow[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(true);

  const loadRows = async (options?: { force?: boolean }) => {
    const targets = propertyId ? [{ _id: propertyId }] : properties;
    if (options?.force) {
      targets.forEach((property) => invalidateByTag('utilityBill', property._id, month));
    }
    const allCached = targets.every((property) =>
      isCached(`/properties/${property._id}/utility-bills/electricity-readings`, { month })
    );
    if (!allCached) setRowsLoading(true);

    try {
      if (propertyId) {
        const data = await cachedGet(`/properties/${propertyId}/utility-bills/electricity-readings`, { month });
        setRows(
          (data?.rows || []).map((row: any) =>
            mapRow({
              ...row,
              propertyId,
              propertyName: properties.find((property) => property._id === propertyId)?.name || 'Property',
              electricityUnitRate: data?.rates?.electricityUnitRate || 0,
              commonElectricityCharge: data?.rates?.commonElectricityCharge || 0
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
          cachedGet(`/properties/${property._id}/utility-bills/electricity-readings`, { month })
        )
      );

      setRows(
        responses.flatMap((data, index) =>
          (data?.rows || []).map((row: any) =>
            mapRow({
              ...row,
              propertyId: properties[index]._id,
              propertyName: properties[index].name,
              electricityUnitRate: data?.rates?.electricityUnitRate || 0,
              commonElectricityCharge: data?.rates?.commonElectricityCharge || 0
            })
          )
        )
      );
    } finally {
      setRowsLoading(false);
    }
  };

  const scopeKey = `${propertyId}::${month}`;
  const [renderedScopeKey, setRenderedScopeKey] = useState(scopeKey);
  if (scopeKey !== renderedScopeKey) {
    setRenderedScopeKey(scopeKey);
    setRows([]);
    setRowsLoading(true);
  }

  useEffect(() => {
    if (propertiesLoading) return;
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, month, properties.length, propertiesLoading]);

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
      toast.error('Please select a month.');
      return;
    }

    if (rows.some((row) => row.isInvalid)) {
      toast.error('Please fix the highlighted readings before saving.');
      return;
    }

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

      await loadRows({ force: true });
      toast.success('Readings saved.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save readings.');
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<ReadingRow>[] = [
    { key: 'property', label: 'Property', accessor: (row) => row.propertyName },
    { key: 'unit', label: 'Unit', accessor: (row) => row.unitNumber },
    { key: 'lastReading', label: 'Last Reading', accessor: (row) => row.lastReading },
    {
      key: 'currentReading',
      label: 'Current Reading',
      accessor: (row) => (row.currentReading ? Number(row.currentReading) : null),
      sortable: false,
      render: (row) => (
        <div className="relative">
          <input
            className={`border rounded-lg px-3 py-2 text-sm w-32 ${row.isInvalid ? 'input-error' : 'border-black/10'}`}
            value={row.currentReading}
            onChange={(e) => updateReading(row.unitId, e.target.value)}
            placeholder="Reading"
          />
          <FieldError message={row.invalidMessage} />
          {!row.invalidMessage && row.nextReading != null ? (
            <div className="mt-1 text-xs text-[var(--muted)]">
              Next saved reading: {row.nextReading}
            </div>
          ) : null}
        </div>
      )
    },
    { key: 'calculatedUnits', label: 'Units Used', accessor: (row) => row.calculatedUnits },
    { key: 'calculatedAmount', label: 'Amount', accessor: (row) => row.calculatedAmount, render: (row) => `₹${formatCurrency(row.calculatedAmount)}` }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
          <button
            type="button"
            className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={() => setMonth((prev) => shiftMonthValue(prev, -1))}
            aria-label="Previous month"
          >
            ←
          </button>
          <DatePicker
            picker="month"
            className="w-[150px] px-3 py-2 rounded-xl border border-black/10"
            value={month}
            onChange={(next) => setMonth(next)}
          />
          <button
            type="button"
            className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={() => setMonth((prev) => shiftMonthValue(prev, 1))}
            aria-label="Next month"
          >
            →
          </button>
        </div>
        <button
          className="btn btn-primary"
          onClick={saveAll}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Readings'}
        </button>
      </div>

      <SortableTable
        columns={columns}
        data={rows}
        rowKey={(row) => row.unitId}
        searchPlaceholder="Search by property or unit..."
        emptyIcon={<UnitsIcon width={22} height={22} />}
        emptyTitle="No units found"
        emptyDescription="Add units to this property to record meter readings."
        loading={rowsLoading}
      />

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

