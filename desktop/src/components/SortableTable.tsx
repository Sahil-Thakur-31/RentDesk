import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SearchIcon, SortIcon } from './icons';
import EmptyState from './EmptyState';
import { SkeletonBlock } from './Skeleton';

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

export interface ServerTableControls {
  page: number;
  pageSize: number;
  total: number;
  search: string;
  onSearchChange: (value: string) => void;
  sortKey: string | null;
  sortDir: 'asc' | 'desc';
  onSortChange: (key: string, dir: 'asc' | 'desc') => void;
  columnFilters: Record<string, string>;
  onColumnFiltersChange: (filters: Record<string, string>) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

interface SortableTableProps<T> {
  columns: Array<TableColumn<T>>;
  data: T[];
  rowKey: (row: T) => string;
  title?: ReactNode;
  tabs?: ReactNode;
  headerAction?: ReactNode;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  extraToolbar?: ReactNode;
  loading?: boolean;
  /** Presence switches the table to server mode: `data` is treated as already-paginated rows, and search/sort/filter/page state is reported via callbacks instead of processed locally. */
  server?: ServerTableControls;
  pageSizeOptions?: number[];
}

const alignClass: Record<string, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center'
};

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 10;

const SortableTable = <T,>({
  columns,
  data,
  rowKey,
  title,
  tabs,
  headerAction,
  searchPlaceholder = 'Search...',
  emptyTitle = 'No results found',
  emptyDescription,
  emptyIcon,
  extraToolbar,
  loading = false,
  server,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS
}: SortableTableProps<T>) => {
  const isServer = Boolean(server);

  const [localSearch, setLocalSearch] = useState('');
  const [localSortKey, setLocalSortKey] = useState<string | null>(null);
  const [localSortDir, setLocalSortDir] = useState<'asc' | 'desc'>('asc');
  const [localColumnFilters, setLocalColumnFilters] = useState<Record<string, string>>({});
  const [localPage, setLocalPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(pageSizeOptions.includes(DEFAULT_PAGE_SIZE) ? DEFAULT_PAGE_SIZE : pageSizeOptions[0] || DEFAULT_PAGE_SIZE);

  const [searchInput, setSearchInput] = useState(server?.search ?? '');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (server) setSearchInput(server.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server?.search]);

  const filterableColumns = columns.filter((column) => column.filterOptions && column.filterOptions.length);
  const searchableColumns = columns.filter((column) => column.accessor);

  const processed = useMemo(() => {
    if (isServer) return data;
    let rows = data;

    for (const column of filterableColumns) {
      const value = localColumnFilters[column.key];
      if (value) {
        rows = rows.filter((row) => String(column.accessor?.(row) ?? '') === value);
      }
    }

    if (localSearch.trim()) {
      const query = localSearch.trim().toLowerCase();
      rows = rows.filter((row) =>
        searchableColumns.some((column) => String(column.accessor?.(row) ?? '').toLowerCase().includes(query))
      );
    }

    if (localSortKey) {
      const column = columns.find((entry) => entry.key === localSortKey);
      if (column?.accessor) {
        const accessor = column.accessor;
        rows = [...rows].sort((a, b) => {
          const av = accessor(a);
          const bv = accessor(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === 'number' && typeof bv === 'number') {
            return localSortDir === 'asc' ? av - bv : bv - av;
          }
          const as = String(av).toLowerCase();
          const bs = String(bv).toLowerCase();
          if (as < bs) return localSortDir === 'asc' ? -1 : 1;
          if (as > bs) return localSortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }

    return rows;
  }, [isServer, data, localSearch, localSortKey, localSortDir, localColumnFilters, columns, filterableColumns, searchableColumns]);

  const total = isServer ? server!.total : processed.length;
  const page = isServer ? server!.page : localPage;
  const pageSize = isServer ? server!.pageSize : localPageSize;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, pageCount);

  useEffect(() => {
    if (!isServer && localPage > pageCount) setLocalPage(pageCount);
  }, [isServer, localPage, pageCount]);

  const pageRows = isServer ? data : processed.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const sortKey = isServer ? server!.sortKey : localSortKey;
  const sortDir = isServer ? server!.sortDir : localSortDir;
  const columnFilters = isServer ? server!.columnFilters : localColumnFilters;

  const toggleSort = (key: string) => {
    const nextDir: 'asc' | 'desc' = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    if (isServer) {
      server!.onSortChange(key, sortKey === key ? nextDir : 'asc');
      return;
    }
    if (localSortKey === key) {
      setLocalSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setLocalSortKey(key);
      setLocalSortDir('asc');
    }
  };

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (isServer) {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => server!.onSearchChange(value), 300);
    } else {
      setLocalSearch(value);
      setLocalPage(1);
    }
  };

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    if (isServer) {
      server!.onColumnFiltersChange({ ...columnFilters, [key]: value });
      return;
    }
    setLocalColumnFilters((prev) => ({ ...prev, [key]: value }));
    setLocalPage(1);
  };

  const handlePageChange = (nextPage: number) => {
    const bounded = Math.max(1, Math.min(pageCount, nextPage));
    if (isServer) {
      server!.onPageChange(bounded);
    } else {
      setLocalPage(bounded);
    }
  };

  const handlePageSizeChange = (nextSize: number) => {
    if (isServer) {
      server!.onPageSizeChange(nextSize);
    } else {
      setLocalPageSize(nextSize);
      setLocalPage(1);
    }
  };

  const rangeStart = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, clampedPage * pageSize);

  return (
    <div className="card overflow-hidden">
      {(title || tabs || headerAction) && (
        <div className="flex items-center justify-between px-4 pt-4 pb-1 flex-wrap gap-3">
          {tabs ? (
            <div className="flex items-center gap-2 flex-wrap">{tabs}</div>
          ) : (
            title && (
              <div className="text-2xl font-bold bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] bg-clip-text text-transparent">
                {title}
              </div>
            )
          )}
          {headerAction}
        </div>
      )}
      {(searchableColumns.length > 0 || filterableColumns.length > 0 || extraToolbar) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-black/5 px-4 pt-3 pb-4">
          {searchableColumns.length > 0 && (
            <div className="relative min-w-[200px] flex-1">
              <SearchIcon width={15} height={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                className="w-full py-2 pl-9 pr-3 text-sm"
                placeholder={searchPlaceholder}
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
              />
            </div>
          )}
          {filterableColumns.map((column) => (
            <select
              key={column.key}
              className="py-2 pl-3 pr-3 text-sm"
              value={columnFilters[column.key] || ''}
              onChange={(e) => handleFilterChange(column.key, e.target.value)}
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
            {loading
              ? Array.from({ length: 6 }).map((_, r) => (
                  <tr key={`skeleton-${r}`} className="border-b border-black/5">
                    {columns.map((column, c) => (
                      <td key={column.key} className="px-4 py-3">
                        <SkeletonBlock height={14} width={c === columns.length - 1 ? '70%' : `${55 + ((r + c) % 4) * 10}%`} />
                      </td>
                    ))}
                  </tr>
                ))
              : pageRows.map((row) => (
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
      {!loading && !pageRows.length && (
        <EmptyState
          title={emptyTitle}
          description={isServer ? (server!.search || Object.values(columnFilters).some(Boolean) ? 'No rows match your search or filters.' : emptyDescription) : (data.length ? 'No rows match your search or filters.' : emptyDescription)}
          icon={emptyIcon}
        />
      )}
      {!loading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 px-4 py-3 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              className="py-1.5 pl-2 pr-6 text-xs"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span>
              {rangeStart}-{rangeEnd} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-lg border border-black/10 bg-white px-2.5 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-40 disabled:hover:bg-white"
                onClick={() => handlePageChange(clampedPage - 1)}
                disabled={clampedPage <= 1}
                aria-label="Previous page"
              >
                ←
              </button>
              <span className="px-1">
                Page {clampedPage} of {pageCount}
              </span>
              <button
                type="button"
                className="rounded-lg border border-black/10 bg-white px-2.5 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-40 disabled:hover:bg-white"
                onClick={() => handlePageChange(clampedPage + 1)}
                disabled={clampedPage >= pageCount}
                aria-label="Next page"
              >
                →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SortableTable;
