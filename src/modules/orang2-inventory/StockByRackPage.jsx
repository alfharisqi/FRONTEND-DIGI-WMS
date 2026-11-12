import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../../config/api';

export default function StockByRackPage({
  lastEvent,
  searchQuery = '',
  mqttConnected = false,
  showNotification,
}) {
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [selectedRack, setSelectedRack] = useState('ALL');

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

  // Memuat data saat halaman pertama kali dibuka.
  useEffect(() => {
    fetchStockByRack();
  }, [fetchStockByRack]);

  // App.jsx sudah memiliki satu koneksi MQTT global.
  // Jika event stok diterima, halaman mengambil ulang data dari API.
  useEffect(() => {
    if (lastEvent?.topic === 'wms/stock/realtime') {
      fetchStockByRack();
    }
  }, [lastEvent, fetchStockByRack]);

  const rackOptions = useMemo(
    () => [...new Set(stockData.map((item) => item.rack_code))].sort(),
    [stockData]
  );

  const filteredData = useMemo(() => {
    const keyword = `${localSearch || searchQuery}`.trim().toLowerCase();

    return stockData.filter((item) => {
      const matchesRack =
        selectedRack === 'ALL' || item.rack_code === selectedRack;

      const matchesSearch =
        !keyword ||
        item.rack_code?.toLowerCase().includes(keyword) ||
        item.rack_name?.toLowerCase().includes(keyword) ||
        item.sku?.toLowerCase().includes(keyword) ||
        item.product_name?.toLowerCase().includes(keyword) ||
        item.category?.toLowerCase().includes(keyword);

      return matchesRack && matchesSearch;
    });
  }, [stockData, localSearch, searchQuery, selectedRack]);

  const totalQuantity = stockData.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );

  const totalProducts = new Set(stockData.map((item) => item.product_id)).size;
  const totalRacks = new Set(stockData.map((item) => item.location_id)).size;

  const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID').format(value);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Inventaris Stok per Rak
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Monitoring jumlah barang pada setiap rak berdasarkan item
              berstatus IN_STOCK.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-semibold px-3 py-2 rounded-xl border ${
                mqttConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-current mr-2" />
              MQTT {mqttConnected ? 'Terhubung' : 'Terputus'}
            </span>

            <button
              type="button"
              onClick={fetchStockByRack}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold"
            >
              {loading ? 'Memuat...' : '↻ Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">
            Total Stok di Rak
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatNumber(totalQuantity)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Unit barang</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">
            Produk Tersimpan
          </p>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {formatNumber(totalProducts)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Jenis produk berbeda</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">
            Rak Terisi
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            {formatNumber(totalRacks)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Rak dengan stok</p>
        </div>
      </div>

      {/* Tabel stok */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                Rincian Stok per Lokasi
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Data diambil dari endpoint inventaris backend.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Cari SKU, barang, atau rak..."
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />

              <select
                value={selectedRack}
                onChange={(e) => setSelectedRack(e.target.value)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                <option value="ALL">Semua Rak</option>
                {rackOptions.map((rack) => (
                  <option key={rack} value={rack}>
                    Rak {rack}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="m-4 p-4 bg-rose-50 border border-rose-200 rounded-xl">
            <p className="text-sm text-rose-700 font-semibold">
              Gagal memuat data stok
            </p>
            <p className="text-xs text-rose-600 mt-1">{error}</p>
            <button
              type="button"
              onClick={fetchStockByRack}
              className="mt-2 text-xs font-semibold text-rose-700 underline"
            >
              Coba lagi
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            Memuat data inventaris...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="p-4">No.</th>
                  <th className="p-4">Kode Rak</th>
                  <th className="p-4">Nama Rak</th>
                  <th className="p-4">SKU</th>
                  <th className="p-4">Nama Produk</th>
                  <th className="p-4">Kategori</th>
                  <th className="p-4 text-right">Jumlah Stok</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredData.map((item, index) => (
                  <tr
                    key={`${item.location_id}-${item.product_id}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="p-4 text-slate-400">{index + 1}</td>
                    <td className="p-4">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">
                        {item.rack_code}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-slate-700">
                      {item.rack_name}
                    </td>
                    <td className="p-4 font-mono text-slate-600">
                      {item.sku}
                    </td>
                    <td className="p-4 font-semibold text-slate-900">
                      {item.product_name}
                    </td>
                    <td className="p-4 text-slate-500">{item.category}</td>
                    <td className="p-4 text-right">
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
                        {formatNumber(Number(item.quantity))}
                      </span>
                    </td>
                  </tr>
                ))}

                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-10 text-center">
                      <p className="font-semibold text-slate-700">
                        Tidak ada data stok ditemukan.
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Coba ubah kata kunci atau filter rak.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
          <span>{filteredData.length} baris data</span>
          <span>Update melalui API dan MQTT</span>
        </div>
      </div>
    </div>
  );
}
