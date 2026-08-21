import { useEffect, useState } from 'react';
import PropertyPicker from '../components/PropertyPicker';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { EyeIcon, UtilitiesIcon } from '../components/icons';
import DatePicker from '../components/DatePicker';
import ReceiptModal from '../components/ReceiptModal';
import { buildMaintenanceExpenseReceipt, type ReceiptData } from '../lib/receipt';
import { formatDate, shiftMonthValue } from '../lib/dateFormat';
import { cachedGet, isCached, useCachedQuery } from '../lib/queryCache';
import { formatCurrency } from '../lib/format';

const Maintenance = () => {
  const { data: propertiesData, loading: propertiesLoading } = useCachedQuery<any[]>('/properties');
  const properties = propertiesData || [];
  const [propertyId, setPropertyId] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [records, setRecords] = useState<any[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsLoading, setRecordsLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const isServerMode = Boolean(propertyId);

  const scopeKey = `${propertyId}::${month}`;
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
  }

  useEffect(() => {
    if (propertiesLoading) return;
    const loadRecords = async () => {
      if (propertyId) {
        const params = { month, page, limit: pageSize, search: search || undefined, sortKey: sortKey || undefined, sortDir };
        if (!isCached(`/properties/${propertyId}/maintenance`, params)) setRecordsLoading(true);
        try {
          const result = await cachedGet(`/properties/${propertyId}/maintenance`, params);
          setRecords(result?.data || []);
          setRecordsTotal(result?.total || 0);
        } finally {
          setRecordsLoading(false);
        }
        return;
      }

      const allCached = properties.every((property) => isCached(`/properties/${property._id}/maintenance`, { month }));
      if (!allCached) setRecordsLoading(true);

      try {
        if (!properties.length) {
          setRecords([]);
          setRecordsTotal(0);
          return;
        }
        const responses = await Promise.all(
          properties.map((property) => cachedGet(`/properties/${property._id}/maintenance`, { month }))
        );
        const merged = responses.flatMap((data, index) =>
          (data || []).map((record: any) => ({
            ...record,
            _propertyName: properties[index].name,
            _propertyId: properties[index]._id
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
  }, [propertyId, month, properties.length, propertiesLoading, page, pageSize, search, sortKey, sortDir]);

  const columns: TableColumn<any>[] = [
    {
      key: 'property',
      label: 'Property',
      sortable: false,
      accessor: (record) => record._propertyName || properties.find((property) => property._id === propertyId)?.name || '-'
    },
    { key: 'date', label: 'Date', accessor: (record) => new Date(record.date).getTime(), render: (record) => formatDate(record.date) },
    { key: 'category', label: 'Category', accessor: (record) => record.category },
    { key: 'amount', label: 'Amount', accessor: (record) => record.amount, render: (record) => `₹${formatCurrency(record.amount)}` },
    { key: 'paidTo', label: 'Paid To', sortable: false, accessor: (record) => record.paidTo || '-' },
    {
      key: 'view',
      label: '',
      sortable: false,
      render: (record) => (
        <button
          type="button"
          className="icon-btn h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            const property = properties.find((item) => item._id === (record._propertyId || propertyId));
            const propertyName = record._propertyName || property?.name || '-';
            setReceipt(buildMaintenanceExpenseReceipt(record, propertyName, property?.address));
          }}
          title="View Receipt"
        >
          <EyeIcon width={15} height={15} />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
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
                columnFilters: {},
                onColumnFiltersChange: () => {},
                onPageChange: setPage,
                onPageSizeChange: (size) => {
                  setPageSize(size);
                  setPage(1);
                }
              }
            : undefined
        }
      />
      <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
};

export default Maintenance;
