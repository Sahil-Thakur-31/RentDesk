import { useEffect, useState } from 'react';
import PropertyPicker from '../components/PropertyPicker';
import Badge, { type BadgeTone } from '../components/Badge';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { EyeIcon, UtilitiesIcon } from '../components/icons';
import DatePicker from '../components/DatePicker';
import ReceiptModal from '../components/ReceiptModal';
import { buildUtilityBillReceipt, type ReceiptData } from '../lib/receipt';
import { formatMonthKey, shiftMonthValue } from '../lib/dateFormat';
import { cachedGet, isCached, useCachedQuery } from '../lib/queryCache';
import { formatCurrency } from '../lib/format';

const statusTone = (status: string): BadgeTone => {
  if (status === 'paid') return 'success';
  if (status === 'partial') return 'warning';
  return 'danger';
};

const UtilityBills = () => {
  const { data: propertiesData, loading: propertiesLoading } = useCachedQuery<any[]>('/properties');
  const properties = propertiesData || [];
  const [propertyId, setPropertyId] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [bills, setBills] = useState<any[]>([]);
  const [billsTotal, setBillsTotal] = useState(0);
  const [billsLoading, setBillsLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const isServerMode = Boolean(propertyId);
  const baseParams = { month, billType: columnFilters.billType || undefined, status: columnFilters.status || undefined };

  const scopeKey = `${propertyId}::${month}`;
  const [renderedScopeKey, setRenderedScopeKey] = useState(scopeKey);
  if (scopeKey !== renderedScopeKey) {
    setRenderedScopeKey(scopeKey);
    setBills([]);
    setBillsTotal(0);
    setBillsLoading(true);
    setPage(1);
    setSearch('');
    setSortKey(null);
    setSortDir('asc');
    setColumnFilters({});
  }

  useEffect(() => {
    if (propertiesLoading) return;
    const loadBills = async () => {
      if (propertyId) {
        const params = { ...baseParams, page, limit: pageSize, search: search || undefined, sortKey: sortKey || undefined, sortDir };
        if (!isCached(`/properties/${propertyId}/utility-bills`, params)) setBillsLoading(true);
        try {
          const result = await cachedGet(`/properties/${propertyId}/utility-bills`, params);
          setBills(result?.data || []);
          setBillsTotal(result?.total || 0);
        } finally {
          setBillsLoading(false);
        }
        return;
      }

      const allCached = properties.every((property) => isCached(`/properties/${property._id}/utility-bills`, { month }));
      if (!allCached) setBillsLoading(true);

      try {
        if (!properties.length) {
          setBills([]);
          setBillsTotal(0);
          return;
        }
        const responses = await Promise.all(
          properties.map((property) => cachedGet(`/properties/${property._id}/utility-bills`, { month }))
        );
        const merged = responses.flatMap((data, index) =>
          (data || []).map((bill: any) => ({
            ...bill,
            _propertyName: properties[index].name,
            _propertyId: properties[index]._id
          }))
        );
        setBills(merged);
        setBillsTotal(merged.length);
      } finally {
        setBillsLoading(false);
      }
    };
    loadBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, month, properties.length, propertiesLoading, page, pageSize, search, sortKey, sortDir, columnFilters]);

  const columns: TableColumn<any>[] = [
    {
      key: 'property',
      label: 'Property',
      sortable: false,
      accessor: (bill) => bill._propertyName || properties.find((property) => property._id === propertyId)?.name || '-'
    },
    {
      key: 'billType',
      label: 'Type',
      sortable: false,
      accessor: (bill) => bill.billType,
      filterOptions: [
        { value: 'electricity', label: 'Electricity' },
        { value: 'water', label: 'Water' }
      ]
    },
    { key: 'month', label: 'Month', accessor: (bill) => bill.month, render: (bill) => formatMonthKey(bill.month) },
    { key: 'units', label: 'Units', accessor: (bill) => bill.unitsConsumed },
    { key: 'amount', label: 'Amount', accessor: (bill) => bill.amount, render: (bill) => `₹${formatCurrency(bill.amount)}` },
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
    },
    {
      key: 'view',
      label: '',
      sortable: false,
      render: (bill) => (
        <button
          type="button"
          className="icon-btn h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            const property = properties.find((item) => item._id === (bill._propertyId || propertyId));
            const propertyName = bill._propertyName || property?.name || '-';
            setReceipt(buildUtilityBillReceipt(bill, propertyName, property?.address));
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
        data={bills}
        rowKey={(bill) => bill._id}
        searchPlaceholder="Search by property, type..."
        emptyIcon={<UtilitiesIcon width={22} height={22} />}
        emptyTitle="No utility bills found"
        emptyDescription="Record an electricity or water reading to generate a bill for a unit."
        loading={billsLoading}
        server={
          isServerMode
            ? {
                page,
                pageSize,
                total: billsTotal,
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
      <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
};

export default UtilityBills;
