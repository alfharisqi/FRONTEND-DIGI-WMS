import React, { useState } from 'react';
import { ScanLine, CheckCheck, Radio } from 'lucide-react';
import { apiRequest } from '../../services/api';

/**
 * ============================================================================
 * HALAMAN ORANG 3: STOCK OPNAME HANDHELD RFID & REKONSILIASI SELISIH
 * ============================================================================
 */
export default function HandheldOpnamePage({ onNotify }) {
  const [zone, setZone] = useState('A1');
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sessionCode, setSessionCode] = useState('OPN-A1-2026');
  const [discrepancies, setDiscrepancies] = useState([
    { id: 1, product_id: 1, sku: 'SKU-012', name: 'Mouse Wireless Ergonomic', rack: 'Rak A1-01', sysQty: 15, scanQty: 15, diff: 0, status: 'COCOK (100% Match)' },
    { id: 2, product_id: 4, sku: 'SKU-031', name: 'USB Hub Type-C 7in1 Multi', rack: 'Rak A1-03', sysQty: 25, scanQty: 24, diff: -1, status: 'SALAH RAK (1 di Rak A1-02)' },
    { id: 3, product_id: 6, sku: 'SKU-055', name: 'SSD External 1TB NVMe Pro', rack: 'Rak A2-04', sysQty: 85, scanQty: 85, diff: 0, status: 'COCOK (100% Match)' },
  ]);

  const handleStartHandheldScan = () => {
    setScanning(true);
    setProgress(0);
    let current = 0;

    const timer = setInterval(async () => {
      current += 25;
      setProgress(current);
      if (current >= 100) {
        clearInterval(timer);
        setScanning(false);
        try {
          const res = await apiRequest('/api/stocktake/scan-submit', {
            method: 'POST',
            body: JSON.stringify({
              zone_code: zone,
              total_expected: 125,
              total_scanned: 124,
              total_matched: 124,
              total_missing: 0,
              total_misplaced: 1,
            }),
          });
          setSessionCode(res.data.session_code);
          onNotify(`Sesi ${res.data.session_code} selesai dipindai & dipublish ke EMQX!`);
        } catch {
          onNotify(`Pemindaian Handheld Zona ${zone} selesai (124/125 Tag Cocok)!`);
        }
      }
    }, 250);
  };

  const handleApproveAdjustment = async () => {
    try {
      await apiRequest('/api/stocktake/approve', {
        method: 'POST',
        body: JSON.stringify({
          session_code: sessionCode,
          product_id: 4,
          diff_qty: -1,
          from_rack: 'Rak A1-03',
          to_rack: 'Koreksi Opname Rak A1-02',
        }),
      });
      onNotify('Penyesuaian selisih opname berhasil disetujui & tercatat di Ledger Orang 2!');
    } catch {
      onNotify('Penyesuaian selisih opname berhasil disetujui (Simulasi Lokal)!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Modul Orang 3 */}
      <div className="bg-amber-600 text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider bg-amber-900/50 px-3 py-1 rounded-full">
            Area Kerja Orang 3
          </span>
          <h2 className="text-xl font-bold mt-2">Audit Stock Opname Handheld RFID &amp; Rekonsiliasi Selisih</h2>
          <p className="text-xs text-amber-100 mt-0.5">
            Pemindaian nirkabel ratusan tag per detik menggunakan Handheld Reader (Offline-First) dan persetujuan koreksi stok.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-slate-900 bg-white"
          >
            <option value="A1">Zona A1 (Aksesoris)</option>
            <option value="B2">Zona B2 (Gaming)</option>
            <option value="C3">Zona C3 (Kabel)</option>
          </select>
          <button
            onClick={handleStartHandheldScan}
            disabled={scanning}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2"
          >
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>{scanning ? `Memindai (${progress}%)...` : 'Mulai Scan Handheld'}</span>
          </button>
        </div>
      </div>

      {/* Tabel Hasil Selisih Opname */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-amber-600" />
              Hasil Analisis Selisih Opname (Sesi: {sessionCode})
            </h3>
            <p className="text-xs text-slate-500">
              Selisih tidak langsung menimpa stok, melainkan wajib disetujui supervisor ke Buku Besar.
            </p>
          </div>
          <button
            onClick={handleApproveAdjustment}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Setujui Penyesuaian ke Ledger</span>
          </button>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="p-3.5">SKU / Nama Barang</th>
              <th className="p-3.5">Lokasi Rak Sistem</th>
              <th className="p-3.5">Stok Sistem</th>
              <th className="p-3.5">Terbaca Handheld</th>
              <th className="p-3.5">Selisih</th>
              <th className="p-3.5">Diagnosa Audit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {discrepancies.map((d) => (
              <tr key={d.id}>
                <td className="p-3.5 font-bold text-slate-900">
                  {d.sku} — {d.name}
                </td>
                <td className="p-3.5 text-blue-600 font-semibold">{d.rack}</td>
                <td className="p-3.5 font-bold">{d.sysQty} Unit</td>
                <td className="p-3.5 font-bold text-emerald-600">{d.scanQty} Unit</td>
                <td className="p-3.5 font-extrabold text-rose-600">{d.diff}</td>
                <td className="p-3.5">
                  <span
                    className={`px-2.5 py-1 rounded-full font-semibold ${
                      d.diff === 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
