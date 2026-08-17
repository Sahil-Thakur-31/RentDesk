import { useMemo, useState, type ReactNode } from 'react';
import { SearchIcon, SortIcon } from './icons';
import EmptyState from './EmptyState';

export interface TableColumn<T> {
  key: string;
  label: string;
  accessor?: (row: T) => string | number | null | undefined;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  filterOptions?: Array<{ value: string; label: string }>;
  filterLabel?: string;
  align?: 'left' | 'right' | 'center';
  headerClassName?: string;
  cellClassName?: string;
}

interface SortableTableProps<T> {
  columns: Array<TableColumn<T>>;
  data: T[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  extraToolbar?: ReactNode;
}

const alignClass: Record<string, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center'
};

const SortableTable = <T,>({
  columns,
  data,
  rowKey,
  searchPlaceholder = 'Search...',
  emptyTitle = 'No results found',
  emptyDescription,
  emptyIcon,
  extraToolbar
}: SortableTableProps<T>) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const filterableColumns = columns.filter((column) => column.filterOptions && column.filterOptions.length);
  const searchableColumns = columns.filter((column) => column.accessor);

  const processed = useMemo(() => {
    let rows = data;

    for (const column of filterableColumns) {
      const value = columnFilters[column.key];
      if (value) {
        rows = rows.filter((row) => String(column.accessor?.(row) ?? '') === value);
      }
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      rows = rows.filter((row) =>
        searchableColumns.some((column) => String(column.accessor?.(row) ?? '').toLowerCase().includes(query))
      );
    }

    if (sortKey) {
      const column = columns.find((entry) => entry.key === sortKey);
      if (column?.accessor) {
        const accessor = column.accessor;
        rows = [...rows].sort((a, b) => {
          const av = accessor(a);
          const bv = accessor(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === 'number' && typeof bv === 'number') {
            return sortDir === 'asc' ? av - bv : bv - av;
          }
          const as = String(av).toLowerCase();
          const bs = String(bv).toLowerCase();
          if (as < bs) return sortDir === 'asc' ? -1 : 1;
          if (as > bs) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }

    return rows;
  }, [data, search, sortKey, sortDir, columnFilters, columns, filterableColumns, searchableColumns]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="card overflow-hidden">
      {(searchableColumns.length > 0 || filterableColumns.length > 0 || extraToolbar) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-black/5 p-4">
          {searchableColumns.length > 0 && (
            <div className="relative min-w-[200px] flex-1">
              <SearchIcon width={15} height={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                className="w-full py-2 pl-9 pr-3 text-sm"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          {filterableColumns.map((column) => (
            <select
              key={column.key}
              className="py-2 pl-3 pr-3 text-sm"
              value={columnFilters[column.key] || ''}
              onChange={(e) => setColumnFilters((prev) => ({ ...prev, [column.key]: e.target.value }))}
            >
              <option value="">{`All ${column.filterLabel || column.label}`}</option>
              {column.filterOptions!.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ))}
          {extraToolbar}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-black/5">
            <tr>
              {columns.map((column) => {
                const canSort = Boolean(column.accessor) && column.sortable !== false;
                return (
                  <th
                    key={column.key}
                    className={`px-4 py-3 ${alignClass[column.align || 'left']} ${canSort ? 'cursor-pointer select-none hover:text-[var(--text)]' : ''} ${column.headerClassName || ''}`}
                    onClick={() => canSort && toggleSort(column.key)}
                  >
                    <span className={`inline-flex items-center gap-1 ${column.align === 'right' ? 'flex-row-reverse' : ''}`}>
                      {column.label}
                      {canSort && (
                        <SortIcon state={sortKey === column.key ? sortDir : 'none'} className={sortKey === column.key ? 'text-[var(--accent)]' : 'text-[var(--muted)]/60'} />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {processed.map((row) => (
              <tr key={rowKey(row)} className="border-b border-black/5">
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 ${alignClass[column.align || 'left']} ${column.cellClassName || ''}`}>
                    {column.render ? column.render(row) : (column.accessor?.(row) ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!processed.length && (
        <EmptyState title={emptyTitle} description={data.length ? 'No rows match your search or filters.' : emptyDescription} icon={emptyIcon} />
      )}
    </div>
  );
};

export default SortableTable;
