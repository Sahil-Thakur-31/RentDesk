import { useEffect, useState } from 'react';
import PropertyPicker from '../components/PropertyPicker';
import Badge, { type BadgeTone } from '../components/Badge';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { ReportsIcon } from '../components/icons';
import { formatMonthYear, shiftMonthValue } from '../lib/dateFormat';
import { cachedGet, isCached, useCachedQuery } from '../lib/queryCache';
import { formatCurrency } from '../lib/format';

const statusTone = (status: string): BadgeTone => {
  if (status === 'paid') return 'success';
  if (status === 'partial') return 'warning';
  return 'danger';
};

const RentRecords = () => {
  const { data: propertiesData, loading: propertiesLoading } = useCachedQuery<any[]>('/properties');
  const properties = propertiesData || [];
  const [propertyId, setPropertyId] = useState('');
  const [monthValue, setMonthValue] = useState(new Date().toISOString().slice(0, 7));
  const [records, setRecords] = useState<any[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsLoading, setRecordsLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const isServerMode = Boolean(propertyId);

  const [year, month] = monthValue.split('-').map(Number);
  const baseParams = { month, year, status: columnFilters.status || undefined };

  const scopeKey = `${propertyId}::${monthValue}`;
  const [renderedScopeKey, setRenderedScopeKey] = useState(scopeKey);
  if (scopeKey !== renderedScopeKey) {
    setRenderedScopeKey(scopeKey);
    setRecords([]);
    setRecordsTotal(0);
    setRecordsLoading(true);
    setPage(1);
    setSearch('');
    setSortKey(null);
    setSortDir('asc');
    setColumnFilters({});
  }

  useEffect(() => {
    if (propertiesLoading) return;
    const loadRecords = async () => {
      if (propertyId) {
        const params = { ...baseParams, page, limit: pageSize, search: search || undefined, sortKey: sortKey || undefined, sortDir };
        if (!isCached(`/properties/${propertyId}/rent-records`, params)) setRecordsLoading(true);
        try {
          const result = await cachedGet(`/properties/${propertyId}/rent-records`, params);
          setRecords(result?.data || []);
          setRecordsTotal(result?.total || 0);
        } finally {
          setRecordsLoading(false);
        }
        return;
      }

      const targets = properties;
      const allCached = targets.every((property) => isCached(`/properties/${property._id}/rent-records`, baseParams));
      if (!allCached) setRecordsLoading(true);

      try {
        if (!properties.length) {
          setRecords([]);
          setRecordsTotal(0);
          return;
        }
        const responses = await Promise.all(
          properties.map((property) => cachedGet(`/properties/${property._id}/rent-records`, baseParams))
        );
        const merged = responses.flatMap((data, index) =>
          (data || []).map((record: any) => ({
            ...record,
            _propertyId: properties[index]._id,
            _propertyName: properties[index].name
          }))
        );
        setRecords(merged);
        setRecordsTotal(merged.length);
      } finally {
        setRecordsLoading(false);
      }
    };
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, monthValue, properties.length, propertiesLoading, page, pageSize, search, sortKey, sortDir, columnFilters]);

  const columns: TableColumn<any>[] = [
    {
      key: 'property',
      label: 'Property',
      sortable: false,
      accessor: (record) => record._propertyName || properties.find((property) => property._id === propertyId)?.name || '-'
    },
    { key: 'tenant', label: 'Tenant', sortable: false, accessor: (record) => record.tenantId?.fullName || '-' },
    { key: 'unit', label: 'Unit', sortable: false, accessor: (record) => record.unitId?.unitNumber || '-' },
    {
      key: 'month',
      label: 'Month',
      accessor: (record) => record.year * 100 + record.month,
      render: (record) => formatMonthYear(record.month, record.year)
    },
    { key: 'amount', label: 'Amount', accessor: (record) => record.rentAmount, render: (record) => `₹${formatCurrency(record.rentAmount)}` },
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
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 active:translate-y-0"
          onClick={() => setMonthValue((prev) => shiftMonthValue(prev, -1))}
          aria-label="Previous month"
        >
          ←
        </button>
        <input
          type="month"
          className="border border-black/10 rounded-lg px-3 py-2 text-sm"
          value={monthValue}
          onChange={(e) => setMonthValue(e.target.value)}
        />
        <button
          type="button"
          className="h-10 w-10 rounded-xl border border-black/10 bg-white text-slate-700 text-2xl font-black leading-none shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 active:translate-y-0"
          onClick={() => setMonthValue((prev) => shiftMonthValue(prev, 1))}
          aria-label="Next month"
        >
          →
        </button>
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
        loading={recordsLoading}
        server={
          isServerMode
            ? {
                page,
                pageSize,
                total: recordsTotal,
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
                columnFilters,
                onColumnFiltersChange: (filters) => {
                  setColumnFilters(filters);
                  setPage(1);
                },
                onPageChange: setPage,
                onPageSizeChange: (size) => {
                  setPageSize(size);
                  setPage(1);
                }
              }
            : undefined
        }
      />
    </div>
  );
};

export default RentRecords;
