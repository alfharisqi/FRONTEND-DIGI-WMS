import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function parseRowDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function DataTable({
  data = [],
  columns = [],
  searchPlaceholder = 'Cari data...',
  externalSearch = '',
  initialSorting = [],
  dateField = null,
  filters = [],
  toolbarActions = null,
  emptyMessage = 'Tidak ada data yang cocok.',
  defaultPageSize = 10,
}) {
  const [sorting, setSorting] = useState(initialSorting);
  const [globalFilter, setGlobalFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [facetValues, setFacetValues] = useState({});
  const [columnVisibility, setColumnVisibility] = useState({});
  const [viewOpen, setViewOpen] = useState(false);
  const viewRef = useRef(null);

  useEffect(() => {
    const onOutside = (e) => {
      if (viewRef.current && !viewRef.current.contains(e.target)) {
        setViewOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const effectiveSearch = (globalFilter || externalSearch || '').trim();

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      // Facet filters
      for (const f of filters) {
        const selected = facetValues[f.key];
        if (selected && selected !== 'ALL') {
          const val =
            typeof f.getValue === 'function' ? f.getValue(row) : row?.[f.key];
          if (String(val ?? '').toUpperCase() !== String(selected).toUpperCase()) {
            return false;
          }
        }
      }

      // Date range filter
      if (dateField && (dateFrom || dateTo)) {
        const raw =
          typeof dateField === 'function' ? dateField(row) : row?.[dateField];
        const rowDate = parseRowDate(raw);
        if (!rowDate) return false;
        if (dateFrom) {
          const start = new Date(`${dateFrom}T00:00:00`);
          if (rowDate < start) return false;
        }
        if (dateTo) {
          const end = new Date(`${dateTo}T23:59:59.999`);
          if (rowDate > end) return false;
        }
      }

      return true;
    });
  }, [data, filters, facetValues, dateField, dateFrom, dateTo]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter: effectiveSearch,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: defaultPageSize,
      },
    },
  });

  const hasActiveFilters =
    Boolean(globalFilter) ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Object.values(facetValues).some((v) => v && v !== 'ALL');

  const resetAllFilters = () => {
    setGlobalFilter('');
    setDateFrom('');
    setDateTo('');
    setFacetValues({});
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Date Range Filter */}
          {dateField && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="date"
                aria-label="Dari tanggal"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-6 bg-transparent text-xs text-foreground outline-none"
                title="Dari Tanggal"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="date"
                aria-label="Sampai tanggal"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-6 bg-transparent text-xs text-foreground outline-none"
                title="Sampai Tanggal"
              />
            </div>
          )}

          {/* Facet Select Filters */}
          {filters.map((f) => (
            <select
              key={f.key}
              aria-label={f.label}
              value={facetValues[f.key] || 'ALL'}
              onChange={(e) =>
                setFacetValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">Semua {f.label}</option>
              {f.options.map((opt) => {
                const value = typeof opt === 'string' ? opt : opt.value;
                const label = typeof opt === 'string' ? opt : opt.label;
                return (
                  <option key={value} value={value}>
                    {label}
                  </option>
                );
              })}
            </select>
          ))}

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="h-8 px-2.5 text-xs text-muted-foreground"
            >
              Reset
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Right side: Column View Toggle + Extra Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div ref={viewRef} className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setViewOpen((prev) => !prev)}
              className="h-8 gap-1.5 text-xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Kolom</span>
            </Button>
            {viewOpen && (
              <div className="absolute right-0 mt-1.5 z-40 w-44 rounded-md border bg-popover p-1.5 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
                <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground border-b mb-1">
                  Tampilkan Kolom
                </div>
                {table
                  .getAllColumns()
                  .filter((col) => col.getCanHide())
                  .map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 rounded-sm px-2 py-1 text-xs hover:bg-accent cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={col.getIsVisible()}
                        onChange={col.getToggleVisibilityHandler()}
                        className="rounded border-input accent-primary"
                      />
                      <span className="truncate capitalize">
                        {typeof col.columnDef.header === 'string'
                          ? col.columnDef.header
                          : col.id}
                      </span>
                    </label>
                  ))}
              </div>
            )}
          </div>
          {toolbarActions}
        </div>
      </div>

      {/* Table Surface */}
      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="border-b bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {sorted === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5 text-foreground" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5 text-foreground" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-muted/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5 align-middle text-xs">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <div>
          Menampilkan{' '}
          <span className="font-medium text-foreground">
            {table.getRowModel().rows.length}
          </span>{' '}
          dari{' '}
          <span className="font-medium text-foreground">
            {table.getFilteredRowModel().rows.length}
          </span>{' '}
          baris
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span>Baris</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-7 rounded-md border border-input bg-background px-1.5 text-xs text-foreground"
            >
              {[10, 20, 30, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="font-medium text-foreground">
            Hal {table.getState().pagination.pageIndex + 1} /{' '}
            {Math.max(table.getPageCount(), 1)}
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
