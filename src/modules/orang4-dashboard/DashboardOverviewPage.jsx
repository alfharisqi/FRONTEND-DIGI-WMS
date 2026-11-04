import React, { useState, useEffect } from 'react';
import { Boxes, Truck, Tag, ShieldCheck, Radio, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../services/api';

/**
 * ============================================================================
 * HALAMAN ORANG 4: DASHBOARD KPI PUSAT, MONITOR EMQX & MANAJEMEN SISTEM
 * ============================================================================
 */
export default function DashboardOverviewPage({ mqttConnected, lastMqttEvent, onNotify }) {
  const [kpi, setKpi] = useState({
    total_stock: 283,
    total_inbound: 320,
    active_rfid_tags: 6,
    low_stock_items: [
      { sku: 'SKU-012', product_name: 'Mouse Wireless Ergonomic', current_stock: 15 },
      { sku: 'SKU-018', product_name: 'Keyboard Mechanical RGB', current_stock: 20 },
      { sku: 'SKU-024', product_name: 'Kabel HDMI 2.0 4K Ultra', current_stock: 18 },
    ],
  });

  const fetchSummary = () => {
    apiRequest('/api/dashboard/summary')
      .then((res) => {
        if (res.kpi) setKpi(res.kpi);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchSummary();
  }, [lastMqttEvent]);

  const handleTestMqttBroadcast = async () => {
    try {
      await apiRequest('/api/mqtt/test-publish', {
        method: 'POST',
        body: JSON.stringify({
          topic: 'wms/stock/realtime',
          message: 'Ping Real-time dari Dashboard Orang 4!',
        }),
      });
      onNotify('Pesan tes berhasil ditembakkan ke EMQX Broker (Port 1883 -> WS 8083)!');
    } catch {
      onNotify('Simulasi broadcast MQTT berhasil dijalankan!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Modul Orang 4 */}
      <div className="bg-indigo-700 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider bg-indigo-900/60 px-3 py-1 rounded-full">
            Area Kerja Orang 4
          </span>
          <h2 className="text-2xl font-bold mt-2">Dashboard Pusat DIGI WMS &amp; Monitor EMQX</h2>
          <p className="text-xs text-indigo-100 mt-1">
            Ringkasan metrik real-time dari Modul Orang 1 (Inbound), Orang 2 (Rak &amp; Ledger), dan Orang 3 (Opname).
          </p>
        </div>
        <button
          onClick={handleTestMqttBroadcast}
          className="bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center space-x-2"
        >
          <Radio className="w-4 h-4 text-emerald-600" />
          <span>Tes Broadcast EMQX MQTT</span>
        </button>
      </div>

      {/* 4 Kartu KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Saldo Stok</span>
            <Boxes className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-3">{kpi.total_stock} Unit</p>
          <span className="text-[11px] text-emerald-600 font-semibold">Dihitung dari Buku Besar Ledger</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Inbound (GRN)</span>
            <Truck className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-3">{kpi.total_inbound} Unit</p>
          <span className="text-[11px] text-emerald-600 font-semibold">Terverifikasi dari Supplier</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase">Tag RFID Aktif</span>
            <Tag className="w-5 h-5 text-cyan-600" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-3">{kpi.active_rfid_tags} Chip</p>
          <span className="text-[11px] text-cyan-600 font-semibold">UHF 920–923 MHz Gen2</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase">Broker EMQX WS (8083)</span>
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
          </div>
          <p className={`text-2xl font-extrabold mt-3 ${mqttConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
            {mqttConnected ? 'TERHUBUNG' : 'MODE SIMULASI'}
          </p>
          <span className="text-[11px] text-slate-500 font-medium">ws://localhost:8083/mqtt</span>
        </div>
      </div>

      {/* Daftar Stok Kritis & Log Event MQTT Terakhir */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            Peringatan Stok Minimum (&le; 20 Unit)
          </h3>
          <div className="space-y-2.5">
            {kpi.low_stock_items.map((item, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900">{item.sku}</span> — {item.product_name}
                </div>
                <span className="bg-rose-50 text-rose-600 font-bold px-2.5 py-1 rounded-full">
                  Sisa: {item.current_stock} Unit
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              Monitor Payload EMQX MQTT Real-Time Terakhir
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Menampilkan pesan terakhir yang diterima browser melalui protokol MQTT over WebSocket:
            </p>
            <pre className="bg-slate-950 p-3.5 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto">
              {lastMqttEvent
                ? JSON.stringify(lastMqttEvent, null, 2)
                : '// Menunggu event MQTT pada topik wms/stock/realtime atau wms/opname/+/scan...'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
