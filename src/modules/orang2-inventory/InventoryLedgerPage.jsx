import React, { useState, useEffect } from 'react';
import { Boxes, MapPin, History, ArrowRightCircle } from 'lucide-react';
import { apiRequest } from '../../services/api';

/**
 * ============================================================================
 * HALAMAN ORANG 2: PENYIMPANAN RAK (PUTAWAY), STOK REAL-TIME & BUKU BESAR
 * Otomatis menerima pembaruan live dari EMQX MQTT topik: wms/stock/realtime
 * ============================================================================
 */
export default function InventoryLedgerPage({ lastMqttEvent, onNotify }) {
  const [stockList, setStockList] = useState([
    { product_id: 1, sku: 'SKU-012', product_name: 'Mouse Wireless Ergonomic', category: 'Aksesoris Komputer', current_stock: 15, stock_status: 'STOK_RENDAH' },
    { product_id: 2, sku: 'SKU-018', product_name: 'Keyboard Mechanical RGB', category: 'Periferal Gaming', current_stock: 20, stock_status: 'STOK_RENDAH' },
    { product_id: 3, sku: 'SKU-024', product_name: 'Kabel HDMI 2.0 4K Ultra', category: 'Kabel & Konektor', current_stock: 18, stock_status: 'STOK_RENDAH' },
    { product_id: 4, sku: 'SKU-031', product_name: 'USB Hub Type-C 7in1 Multi', category: 'Aksesoris Komputer', current_stock: 25, stock_status: 'AMAN' },
    { product_id: 5, sku: 'SKU-042', product_name: 'Gaming Headset 7.1 Surround', category: 'Periferal Gaming', current_stock: 120, stock_status: 'AMAN' },
    { product_id: 6, sku: 'SKU-055', product_name: 'SSD External 1TB NVMe Pro', category: 'Aksesoris Komputer', current_stock: 85, stock_status: 'AMAN' },
  ]);

  const [ledgerList, setLedgerList] = useState([
    { tx_code: 'TX-1001', movement_type: 'INBOUND_GRN', sku: 'SKU-012', from_location: 'Supplier PO-2026-8901', to_location: 'Rak A1-01', qty: 15, reference_doc: 'PO-2026-8901' },
    { tx_code: 'TX-1004', movement_type: 'PUTAWAY', sku: 'SKU-031', from_location: 'Zona Transit D2', to_location: 'Rak A1-01', qty: 25, reference_doc: 'PO-2026-8901' },
  ]);

  const [putawayProductId, setPutawayProductId] = useState(1);
  const [putawayLocationId, setPutawayLocationId] = useState(1);
  const [putawayQty, setPutawayQty] = useState(10);

  const fetchInventoryData = () => {
    apiRequest('/api/inventory/stock')
      .then((res) => { if (res.data) setStockList(res.data); })
      .catch(() => {});
    apiRequest('/api/inventory/ledger')
      .then((res) => { if (res.data) setLedgerList(res.data); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchInventoryData();
  }, []);

  // Reaksi otomatis ketika ada pesan masuk dari EMQX MQTT (wms/stock/realtime)
  useEffect(() => {
    if (lastMqttEvent && lastMqttEvent.topic === 'wms/stock/realtime') {
      fetchInventoryData();
    }
  }, [lastMqttEvent]);

  const handlePutawaySubmit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/inventory/putaway', {
        method: 'POST',
        body: JSON.stringify({
          product_id: Number(putawayProductId),
          location_id: Number(putawayLocationId),
          qty: Number(putawayQty),
          reference_doc: 'PUTAWAY-HANDHELD',
        }),
      });
      fetchInventoryData();
      onNotify('Putaway berhasil! Stok & Ledger terupdate live via EMQX MQTT.');
    } catch {
      // Fallback jika mode simulasi lokal
      setStockList((prev) =>
        prev.map((item) =>
          item.product_id === Number(putawayProductId)
            ? {
                ...item,
                current_stock: item.current_stock + Number(putawayQty),
                stock_status: item.current_stock + Number(putawayQty) <= 20 ? 'STOK_RENDAH' : 'AMAN',
              }
            : item
        )
      );
      setLedgerList([
        {
          tx_code: `TX-${Date.now().toString().slice(-4)}`,
          movement_type: 'PUTAWAY',
          sku: `SKU-0${putawayProductId}`,
          from_location: 'Zona Transit Inbound',
          to_location: `Rak Lokasi #${putawayLocationId}`,
          qty: Number(putawayQty),
          reference_doc: 'PUTAWAY-HANDHELD',
        },
        ...ledgerList,
      ]);
      onNotify(`Putaway +${putawayQty} unit berhasil dicatat ke Buku Besar Ledger!`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Modul Orang 2 */}
      <div className="bg-emerald-700 text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider bg-emerald-900/60 px-3 py-1 rounded-full">
            Area Kerja Orang 2
          </span>
          <h2 className="text-xl font-bold mt-2">Penyimpanan Rak (Putaway) &amp; Buku Besar Stok (Immutable Ledger)</h2>
          <p className="text-xs text-emerald-100 mt-0.5">
            Penempatan barang ke lokasi rak fisik dan kalkulasi stok otomatis berbasis riwayat mutasi (terhubung live ke EMQX).
          </p>
        </div>
      </div>

      {/* Form Putaway Rak */}
      <form onSubmit={handlePutawaySubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2 mb-4">
          <MapPin className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-slate-900">Simulasi Putaway (Tempatkan Barang ke Rak &amp; Catat ke Ledger)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Barang (SKU)</label>
            <select
              value={putawayProductId}
              onChange={(e) => setPutawayProductId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              {stockList.map((s) => (
                <option key={s.product_id} value={s.product_id}>
                  {s.sku} — {s.product_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Lokasi Rak Tujuan</label>
            <select
              value={putawayLocationId}
              onChange={(e) => setPutawayLocationId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              <option value={1}>Rak A1-01 (Zona Aksesoris A)</option>
              <option value={2}>Rak A2-04 (Zona Aksesoris B)</option>
              <option value={4}>Rak B2-01 (Zona Periferal Gaming)</option>
              <option value={6}>Rak C3-02 (Zona Kabel &amp; Konektor)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah Unit Masuk Rak</label>
            <input
              type="number"
              min="1"
              required
              value={putawayQty}
              onChange={(e) => setPutawayQty(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center space-x-2"
          >
            <ArrowRightCircle className="w-4 h-4" />
            <span>Putaway &amp; Publish EMQX</span>
          </button>
        </div>
      </form>

      {/* Tabel Stok Real-time & Buku Besar Mutasi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600" />
              Saldo Stok Aktual (View Buku Besar)
            </span>
            <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-semibold">
              Live via wms/stock/realtime
            </span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3">SKU</th>
                <th className="p-3">Nama Barang</th>
                <th className="p-3">Saldo Ledger</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stockList.map((item) => (
                <tr key={item.product_id}>
                  <td className="p-3 font-bold text-slate-900">{item.sku}</td>
                  <td className="p-3">{item.product_name}</td>
                  <td className="p-3 font-extrabold text-slate-900">{item.current_stock} Unit</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold ${
                        item.stock_status === 'STOK_RENDAH'
                          ? 'bg-rose-50 text-rose-600'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {item.stock_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              Buku Besar Pergerakan Stok (Append-Only Ledger)
            </span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3">Kode TX</th>
                <th className="p-3">Tipe</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Ke Lokasi</th>
                <th className="p-3">Mutasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledgerList.map((tx, idx) => (
                <tr key={idx}>
                  <td className="p-3 font-mono font-semibold text-slate-900">{tx.tx_code}</td>
                  <td className="p-3">
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold">
                      {tx.movement_type}
                    </span>
                  </td>
                  <td className="p-3 font-bold">{tx.sku}</td>
                  <td className="p-3 text-blue-600">{tx.to_location}</td>
                  <td className="p-3 font-bold text-emerald-600">
                    {tx.qty > 0 ? `+${tx.qty}` : tx.qty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
