import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, Package, MapPin, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function StockByRackPage({
  lastEvent,
  searchQuery = '',
  mqttConnected = false,
}) {
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStockByRack = useCallback(async () => {
    try {
      setError('');
      const response = await fetch(`${API_BASE_URL}/inventory/stock-by-rack`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP Error ${response.status}`);
      }
      setStockData(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      console.error('Gagal mengambil stok per rak:', err);
      setError(err.message || 'Gagal mengambil data stok.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStockByRack();
  }, [fetchStockByRack]);

  useEffect(() => {
    if (lastEvent?.topic === 'wms/stock/realtime') {
      fetchStockByRack();
    }
  }, [lastEvent, fetchStockByRack]);

  const rackOptions = useMemo(
    () => [...new Set(stockData.map((item) => item.rack_code).filter(Boolean))].sort(),
    [stockData]
  );

  const categoryOptions = useMemo(
    () => [...new Set(stockData.map((item) => item.category).filter(Boolean))].sort(),
    [stockData]
  );

  const totalQuantity = stockData.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );
  const totalProducts = new Set(stockData.map((item) => item.product_id)).size;
  const totalRacks = new Set(stockData.map((item) => item.location_id)).size;

  const formatNumber = (value) => new Intl.NumberFormat('id-ID').format(value);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'rack_code',
        header: 'Kode Rak',
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono font-semibold">
            {row.original.rack_code}
          </Badge>
        ),
      },
      {
        accessorKey: 'rack_name',
        header: 'Nama Rak',
        cell: ({ row }) => (
          <span className="font-medium">{row.original.rack_name}</span>
        ),
      },
      {
        accessorKey: 'sku',
        header: 'SKU',
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            {row.original.sku}
          </span>
        ),
      },
      {
        accessorKey: 'product_name',
        header: 'Nama Produk',
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.product_name}
          </span>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Kategori',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.category}</span>
        ),
      },
      {
        id: 'packaging',
        header: 'Rincian Kemasan',
        cell: ({ row }) => {
          const boxCount = Number(row.original.box_count || 0);
          const boxQty = Number(row.original.box_quantity || 0);
          const unitQty = Number(row.original.unit_quantity || 0);
          return (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {boxCount > 0 && (
                <Badge variant="secondary" className="font-mono">
                  📦 {boxCount} Box ({formatNumber(boxQty)} unit)
                </Badge>
              )}
              {unitQty > 0 && (
                <Badge variant="outline" className="font-mono">
                  🏷️ {formatNumber(unitQty)} Satuan
                </Badge>
              )}
              {boxCount === 0 && unitQty === 0 && (
                <span className="text-muted-foreground">-</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'quantity',
        header: 'Jumlah Stok',
        accessorFn: (row) => Number(row.quantity || 0),
        cell: ({ row }) => (
          <Badge variant="success" className="font-semibold">
            {formatNumber(Number(row.original.quantity || 0))} unit
          </Badge>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Header matching Sidebar icon (Layers) */}
      <div
        data-tour="stock-rack-header"
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Inventaris Stok per Rak
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitoring jumlah barang pada setiap rak berdasarkan item berstatus IN_STOCK.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={mqttConnected ? 'success' : 'destructive'} className="gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            MQTT {mqttConnected ? 'Terhubung' : 'Terputus'}
          </Badge>
          <Button
            type="button"
            size="sm"
            onClick={fetchStockByRack}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Memuat...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div data-tour="stock-rack-summary" className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stok di Rak</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalQuantity)}</div>
            <p className="text-xs text-muted-foreground">Unit barang tersedia</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produk Tersimpan</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalProducts)}</div>
            <p className="text-xs text-muted-foreground">Jenis SKU berbeda</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rak Terisi</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalRacks)}</div>
            <p className="text-xs text-muted-foreground">Lokasi rak aktif</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <p className="font-semibold">Gagal memuat data stok</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* TanStack DataTable */}
      <div data-tour="stock-rack-table">
        {loading ? (
          <div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
            Memuat data inventaris...
          </div>
        ) : (
          <DataTable
            data={stockData}
            columns={columns}
            externalSearch={searchQuery}
            searchPlaceholder="Cari SKU, barang, atau rak..."
            initialSorting={[{ id: 'rack_code', desc: false }]}
            filters={[
              {
                key: 'rack_code',
                label: 'Rak',
                options: rackOptions.map((r) => ({ value: r, label: `Rak ${r}` })),
              },
              {
                key: 'category',
                label: 'Kategori',
                options: categoryOptions.map((c) => ({ value: c, label: c })),
              },
            ]}
            emptyMessage="Tidak ada data stok ditemukan."
          />
        )}
      </div>
    </div>
  );
}
