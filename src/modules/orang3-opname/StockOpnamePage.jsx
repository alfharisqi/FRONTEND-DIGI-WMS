import React, { useEffect, useState, useRef } from 'react';
import { API_BASE_URL } from '../../config/api';

export default function StockOpnamePage({
  activeMenu = 'rfid-opname',
  lastEvent,
  showNotification,
}) {
  const [products, setProducts] = useState([]);
  const [selectedZone, setSelectedZone] = useState('A1');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  const [discrepancyRows, setDiscrepancyRows] = useState([]);

  // Gate Alarm State (Persis Template Awal digiwms.html)
  const [gateStatus, setGateStatus] = useState('AMAN'); // 'AMAN' | 'ALARM' | 'CROSSREAD'
  const [gateIncidents, setGateIncidents] = useState([
    {
      time: '12 Mei 2026 14:20',
      epc: 'E280-1160-2000-042E',
      name: 'Gaming Headset 7.1',
      antenna: 'Antena 1 & 2 (Keluar)',
      rssi: '-55 dBm',
      status: 'Authorized Out',
      action: 'Lolos Verifikasi',
    },
    {
      time: '12 Mei 2026 11:05',
      epc: 'E280-1160-2000-055F',
      name: 'SSD External 1TB',
      antenna: 'Antena 1 & 2 (Keluar)',
      rssi: '-50 dBm',
      status: 'Authorized Out',
      action: 'Lolos Verifikasi',
    },
  ]);

  const audioCtxRef = useRef(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/products`);
      const json = await res.json();
      const prods = json.data || [];
      setProducts(prods);
      buildDiscrepancyTable(prods);
    } catch (err) {
      console.error('Error loading Opname products:', err);
    }
  };

  const buildDiscrepancyTable = (prods) => {
    const rows = prods.map((p, idx) => {
      const sysStock = Number(p.current_stock || 0);
      // Simulasi selisih 1 item pada produk pertama untuk demonstrasi audit
      const physicalScan = idx === 0 && sysStock > 1 ? sysStock - 1 : sysStock;
      const diff = physicalScan - sysStock;
      return {
        sku: p.sku,
        name: p.name,
        location: idx % 2 === 0 ? 'Rak A1-01' : 'Rak B2-01',
        systemStock: sysStock,
        scannedStock: physicalScan,
        diff,
        diagnosis:
          diff === 0
            ? 'Cocok 100% (Matched)'
            : diff < 0
            ? 'Selisih Kurang / Shrinkage'
            : 'Surplus / Salah Rak',
        approved: diff === 0,
      };
    });
    setDiscrepancyRows(rows);
  };

  useEffect(() => {
    fetchProducts();
  }, [lastEvent]);

  // Web Audio Siren Sound Effect
  const playSirenBeep = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(680, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(980, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Ignore audio block
    }
  };

  const runHandheldOpnameSimulation = () => {
    setScanning(true);
    setScanProgress(0);
    setScannedCount(0);
    let step = 0;
    const interval = setInterval(() => {
      step += 25;
      setScanProgress(step);
      setScannedCount((prev) => prev + Math.floor(12 + Math.random() * 15));
      if (step >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setScanning(false);
          fetchProducts();
          showNotification?.(
            `Pemindaian Handheld RFID Zona ${selectedZone} selesai!`,
            'success'
          );
        }, 400);
      }
    }, 300);
  };

  const handleApproveAdjustment = async () => {
    const mismatch = discrepancyRows.find((r) => r.diff !== 0 && !r.approved);
    if (!mismatch) {
      showNotification?.('Semua stok sudah sesuai dengan Buku Besar Ledger!', 'info');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/opname/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: mismatch.sku,
          physical_qty: mismatch.scannedStock,
          notes: `Rekonsiliasi Handheld RFID Zona ${selectedZone}`,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        showNotification?.(
          json.message || `Penyesuaian ${mismatch.sku} berhasil ditulis ke Ledger!`,
          'success'
        );
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const testGateSimulation = async (mode) => {
    const nowStr = new Date().toLocaleTimeString('id-ID');
    if (mode === 'authorized') {
      setGateStatus('AMAN');
      setGateIncidents((prev) => [
        {
          time: `Hari ini ${nowStr}`,
          epc: 'E280-1160-2000-042E',
          name: 'Gaming Headset 7.1 (Gate Pass Valid)',
          antenna: 'Antena 1 & 2 (Keluar)',
          rssi: '-51 dBm',
          status: 'Authorized Out',
          action: 'Lolos Verifikasi',
        },
        ...prev,
      ]);
      showNotification?.('Gate Pass SAH: Lampu Hijau menyala, barang diizinkan keluar.', 'success');
    } else if (mode === 'unauthorized') {
      setGateStatus('ALARM');
      playSirenBeep();
      const illegalEpc = 'E280-6894-0000-991A';
      setGateIncidents((prev) => [
        {
          time: `Hari ini ${nowStr}`,
          epc: illegalEpc,
          name: 'Mouse Wireless Logi (TANPA SURAT JALAN)',
          antenna: 'Antena 1 (Pintu Utama)',
          rssi: '-44 dBm',
          status: 'ILLEGAL / UNPAID',
          action: 'SIRINE & RELAY AKTIF',
        },
        ...prev,
      ]);
      // Publish ke EMQX via Backend
      fetch(`${API_BASE_URL}/mqtt/test-publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'digiwms/rfid/gate-alarm',
          payload: {
            epc_code: illegalEpc,
            gate_id: 'GATE-EXIT-01',
            rssi: -44,
            alert: 'UNAUTHORIZED_EXIT',
          },
        }),
      }).catch(() => {});
      showNotification?.(
        'PERINGATAN! Barang keluar tanpa izin terdeteksi di Gerbang RFID!',
        'error'
      );
    } else {
      setGateStatus('CROSSREAD');
      setGateIncidents((prev) => [
        {
          time: `Hari ini ${nowStr}`,
          epc: 'E280-1160-2000-012A',
          name: 'Barang di Rak Dekat Pintu (Sinyal Lemah)',
          antenna: 'Antena 2 (Dalam)',
          rssi: '-76 dBm',
          status: 'Cross-Read Filtered',
          action: 'Diabaikan (< -65 dBm)',
        },
        ...prev,
      ]);
      showNotification?.(
        'Sinyal lemah (-76 dBm) dari rak dekat pintu berhasil diredam oleh algoritma RSSI.',
        'info'
      );
    }
  };

  // ============================================================================
  // MENU 1: SIMULASI OPNAME HANDHELD (Persis Template Awal digiwms.html)
  // ============================================================================
  if (activeMenu === 'rfid-opname') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-900">
                Simulasi Stock Opname Handheld RFID
              </h2>
              <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200">
                Cycle Count
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Audit fisik nirkabel dengan scanner RFID handheld (Chainway/Zebra) untuk mencocokkan data fisik vs sistem.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none"
            >
              <option value="A1">Zona A1 (Aksesoris Komputer)</option>
              <option value="B2">Zona B2 (Periferal Gaming)</option>
              <option value="C3">Zona C3 (Kabel & Konektor)</option>
            </select>
            <button
              onClick={runHandheldOpnameSimulation}
              disabled={scanning}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-2"
            >
              <span>📡</span>
              <span>{scanning ? 'Memindai...' : 'Mulai Scan Handheld'}</span>
            </button>
          </div>
        </div>

        {/* Handheld Reader Live Status Widget */}
        {(scanning || scanProgress > 0) && (
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center space-x-4">
                <div className="relative w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  {scanning && (
                    <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400 radar-sweep"></div>
                  )}
                  <span className="text-2xl">🔫</span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">
                    {scanning
                      ? 'Memindai Gelombang Radio UHF...'
                      : `Pemindaian Zona ${selectedZone} Selesai`}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Handheld Device:{' '}
                    <span className="text-emerald-400 font-mono">
                      Chainway C72 Android RFID (920.5 MHz)
                    </span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center w-full md:w-auto">
                <div className="bg-slate-800 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Tags Terbaca</span>
                  <span className="text-2xl font-bold text-emerald-400">{scannedCount}</span>
                </div>
                <div className="bg-slate-800 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Kecepatan Scan</span>
                  <span className="text-2xl font-bold text-white">
                    240 <span className="text-xs text-slate-400">tag/s</span>
                  </span>
                </div>
                <div className="bg-slate-800 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Sinyal Rata-rata</span>
                  <span className="text-2xl font-bold text-blue-400">
                    -54 <span className="text-xs text-slate-400">dBm</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Kemajuan Pemindaian Zona {selectedZone}</span>
                <span>{scanProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${scanProgress}%` }}
                  className="bg-emerald-500 h-full transition-all duration-300"
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Opname Discrepancy Results Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Hasil Audit Selisih (Discrepancy Analysis)
              </h3>
              <p className="text-xs text-slate-500">
                Perbandingan data sistem terhadap hasil pemindaian handheld terakhir.
              </p>
            </div>
            <button
              onClick={handleApproveAdjustment}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all flex items-center space-x-2"
            >
              <span>✅</span>
              <span>Setujui Penyesuaian ke Ledger</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="p-4">SKU / Nama Barang</th>
                  <th className="p-4">Lokasi Sistem</th>
                  <th className="p-4">Stok Sistem</th>
                  <th className="p-4">Hasil Scan RFID</th>
                  <th className="p-4">Selisih</th>
                  <th className="p-4">Diagnosa Audit</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {discrepancyRows.map((row) => (
                  <tr key={row.sku} className="hover:bg-slate-50">
                    <td className="p-4">
                      <p className="font-bold text-slate-900">{row.name}</p>
                      <span className="text-xs font-mono text-blue-600">{row.sku}</span>
                    </td>
                    <td className="p-4">{row.location}</td>
                    <td className="p-4 font-bold">{row.systemStock} Unit</td>
                    <td className="p-4 font-bold text-blue-600">{row.scannedStock} Unit</td>
                    <td
                      className={`p-4 font-extrabold ${
                        row.diff === 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {row.diff > 0 ? `+${row.diff}` : row.diff}
                    </td>
                    <td className="p-4 text-xs font-medium">{row.diagnosis}</td>
                    <td className="p-4 text-right">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${
                          row.diff === 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {row.diff === 0 ? 'Matched' : 'Perlu Rekonsiliasi'}
                      </span>
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

  // ============================================================================
  // MENU 2: GATE ALARM & KEAMANAN LIVE (Persis Template Awal digiwms.html)
  // ============================================================================
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900">
              Monitoring Gerbang RFID & Alarm Fisik
            </h2>
            <span className="bg-rose-50 text-rose-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-rose-200">
              Loss Prevention
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Sistem pencegah kehilangan berbasis pembacaan tag pada pintu gerbang gudang (Fixed Reader + Relay GPIO).
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {gateStatus === 'ALARM' && (
            <button
              onClick={() => setGateStatus('AMAN')}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all flex items-center space-x-2"
            >
              <span>🔇</span>
              <span>Matikan Sirine</span>
            </button>
          )}
          <span className="bg-emerald-50 text-emerald-700 text-xs px-3 py-1.5 rounded-xl font-semibold border border-emerald-200 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Reader Gate: Online</span>
          </span>
        </div>
      </div>

      {/* Interactive Gate Strobe Visualization Box */}
      <div
        className={`bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl border-4 transition-all duration-300 relative overflow-hidden ${
          gateStatus === 'ALARM'
            ? 'border-rose-500 animate-strobe-red'
            : 'border-slate-700'
        }`}
      >
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Gate Physical Illustration */}
          <div className="flex items-center space-x-6 sm:space-x-10">
            {/* Antena Kiri */}
            <div className="flex flex-col items-center">
              <div className="w-8 sm:w-10 h-44 bg-gradient-to-b from-slate-600 to-slate-800 rounded-xl border border-slate-500 flex flex-col justify-around items-center py-3 shadow-lg">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                <span className="text-[9px] font-bold text-slate-400 rotate-90">ANT-01</span>
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              </div>
              <span className="text-[10px] text-slate-400 mt-2 font-medium">Antena Luar</span>
            </div>

            {/* Area Tengah Gerbang / Lampu Strobo */}
            <div className="flex flex-col items-center text-center">
              <div
                className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 flex flex-col items-center justify-center shadow-2xl transition-all duration-300 text-4xl ${
                  gateStatus === 'ALARM'
                    ? 'border-rose-500 bg-rose-500/30 animate-bounce'
                    : 'border-emerald-500 bg-emerald-500/20'
                }`}
              >
                {gateStatus === 'ALARM' ? '🚨' : '🛡️'}
              </div>
              <h3
                className={`text-lg font-bold mt-3 tracking-wide ${
                  gateStatus === 'ALARM' ? 'text-rose-300' : 'text-emerald-400'
                }`}
              >
                {gateStatus === 'ALARM'
                  ? 'ALARM SIRINE AKTIF: BARANG ILEGAL!'
                  : 'STATUS: AMAN'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {gateStatus === 'ALARM'
                  ? 'Tag keluar tanpa Gate Pass terdeteksi! Relay GPIO mengunci pintu.'
                  : 'Gerbang siaga. Tidak ada barang ilegal terdeteksi.'}
              </p>
            </div>

            {/* Antena Kanan */}
            <div className="flex flex-col items-center">
              <div className="w-8 sm:w-10 h-44 bg-gradient-to-b from-slate-600 to-slate-800 rounded-xl border border-slate-500 flex flex-col justify-around items-center py-3 shadow-lg">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                <span className="text-[9px] font-bold text-slate-400 rotate-90">ANT-02</span>
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              </div>
              <span className="text-[10px] text-slate-400 mt-2 font-medium">Antena Dalam</span>
            </div>
          </div>

          {/* Interactive Simulation Test Bench */}
          <div className="w-full lg:w-96 bg-slate-950/70 p-5 rounded-2xl border border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              🎮 Uji Coba Lapangan (Simulator)
            </h4>
            <div className="space-y-2.5">
              <button
                onClick={() => testGateSimulation('authorized')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-between transition-all"
              >
                <span>✅ Barang Keluar SAH (Gate Pass)</span>
                <span className="text-[10px] bg-emerald-800 px-2 py-0.5 rounded">Hijau</span>
              </button>

              <button
                onClick={() => testGateSimulation('unauthorized')}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-between shadow-lg shadow-rose-600/30 transition-all"
              >
                <span>⚠️ Barang Keluar ILEGAL (Pencurian)</span>
                <span className="text-[10px] bg-rose-800 px-2 py-0.5 rounded font-bold">
                  ALARM SIRINE
                </span>
              </button>

              <button
                onClick={() => testGateSimulation('crossread')}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-between transition-all"
              >
                <span>🛡️ Filter Cross-Read (Rak Dekat Pintu)</span>
                <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded">RSSI Redam</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Incident & Gate Events Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Log Kejadian Gerbang & Alarm (Incident Log)
            </h3>
            <p className="text-xs text-slate-500">
              Riwayat waktu nyata pembacaan antena gerbang dan pemicuan relay.
            </p>
          </div>
          <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-lg font-medium">
            Otomatis terhubung ke EMQX & CCTV
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <th className="p-4">Waktu Event</th>
                <th className="p-4">EPC Tag</th>
                <th className="p-4">Barang / Deskripsi</th>
                <th className="p-4">Antena Gerbang</th>
                <th className="p-4">Sinyal (RSSI)</th>
                <th className="p-4">Status Otorisasi</th>
                <th className="p-4 text-right">Tindakan Keamanan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {gateIncidents.map((inc, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-4 text-xs text-slate-500">{inc.time}</td>
                  <td className="p-4 font-mono font-bold text-slate-800">{inc.epc}</td>
                  <td className="p-4 font-medium">{inc.name}</td>
                  <td className="p-4 text-xs">{inc.antenna}</td>
                  <td className="p-4 font-mono text-xs">{inc.rssi}</td>
                  <td className="p-4">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold ${
                        inc.status.includes('ILLEGAL')
                          ? 'bg-rose-100 text-rose-700'
                          : inc.status.includes('Authorized')
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </td>
                  <td className="p-4 text-right font-semibold text-xs">{inc.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
