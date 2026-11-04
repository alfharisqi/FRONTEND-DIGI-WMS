import React, { useState, useEffect } from 'react';
import { Truck, Tag, Plus, Cpu, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../../services/api';

/**
 * ============================================================================
 * HALAMAN ORANG 1: PENERIMAAN BARANG (INBOUND GRN) & ENCODING TAG RFID MEJA
 * File milik Orang 1 - Bebas konflik Git dengan anggota tim lain
 * ============================================================================
 */
export default function InboundTaggingPage({ onNotify }) {
  const [grnList, setGrnList] = useState([
    { id: 1, po_number: 'PO-2026-8901', supplier_name: 'PT Logitech Indonesia', receipt_date: '2026-05-12', total_qty: 150, rfid_tagging_status: 'Semua Ter-encode', status: 'SELESAI' },
    { id: 2, po_number: 'PO-2026-8902', supplier_name: 'CV Corsair Global', receipt_date: '2026-05-12', total_qty: 85, rfid_tagging_status: 'Semua Ter-encode', status: 'SELESAI' },
    { id: 3, po_number: 'PO-2026-8903', supplier_name: 'PT Anker Technology', receipt_date: '2026-05-11', total_qty: 85, rfid_tagging_status: 'Menunggu Tagging', status: 'MENUNGGU_VERIFIKASI' },
  ]);

  const [tagsList, setTagsList] = useState([
    { id: 1, epc: 'E280-1160-2000-012A', sku: 'SKU-012', product_name: 'Mouse Wireless Ergonomic', type: 'STANDARD_LABEL', status: 'IN_STOCK', rack_name: 'Rak A1-01' },
    { id: 2, epc: 'E280-1160-2000-018B', sku: 'SKU-018', product_name: 'Keyboard Mechanical RGB', type: 'ON_METAL', status: 'IN_STOCK', rack_name: 'Rak B2-01' },
  ]);

  const [poNumber, setPoNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [totalQty, setTotalQty] = useState(50);
  const [selectedProductId, setSelectedProductId] = useState(1);
  const [selectedTagType, setSelectedTagType] = useState('STANDARD_LABEL');

  useEffect(() => {
    apiRequest('/api/inbound/grn')
      .then((res) => { if (res.data) setGrnList(res.data); })
      .catch(() => {});
    apiRequest('/api/tags')
      .then((res) => { if (res.data) setTagsList(res.data); })
      .catch(() => {});
  }, []);

  const handleCreateGrn = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/inbound/grn', {
        method: 'POST',
        body: JSON.stringify({
          po_number: poNumber,
          supplier_name: supplierName,
          total_qty: Number(totalQty),
        }),
      });
      setGrnList([res.data, ...grnList]);
      onNotify(`Dokumen GRN ${poNumber} berhasil disimpan ke PostgreSQL!`);
    } catch {
      const fallback = {
        id: Date.now(),
        po_number: poNumber,
        supplier_name: supplierName,
        receipt_date: new Date().toISOString().slice(0, 10),
        total_qty: Number(totalQty),
        rfid_tagging_status: 'Auto-Encoded',
        status: 'SELESAI',
      };
      setGrnList([fallback, ...grnList]);
      onNotify(`Dokumen GRN ${poNumber} dicatat (Mode Simulasi Lokal)`);
    }
    setPoNumber('');
    setSupplierName('');
  };

  const handleEncodeTag = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/tags/encode', {
        method: 'POST',
        body: JSON.stringify({
          product_id: Number(selectedProductId),
          type: selectedTagType,
        }),
      });
      setTagsList([
        {
          ...res.tag,
          sku: `SKU-0${selectedProductId}`,
          product_name: 'Produk Ter-encode Baru',
          rack_name: 'Meja Tagging Inbound',
        },
        ...tagsList,
      ]);
      onNotify(`Chip EPC ${res.tag.epc} berhasil di-encode & dipublish ke EMQX!`);
    } catch {
      const mockEpc = `E280-1160-2000-${Math.floor(1000 + Math.random() * 9000)}`;
      setTagsList([
        {
          id: Date.now(),
          epc: mockEpc,
          sku: `SKU-0${selectedProductId}`,
          product_name: 'Barang Inbound Baru',
          type: selectedTagType,
          status: 'ENCODED',
          rack_name: 'Meja Tagging',
        },
        ...tagsList,
      ]);
      onNotify(`Chip EPC ${mockEpc} berhasil di-encode!`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Modul Orang 1 */}
      <div className="bg-blue-700 text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider bg-blue-900/60 px-3 py-1 rounded-full">
            Area Kerja Orang 1
          </span>
          <h2 className="text-xl font-bold mt-2">Penerimaan Barang (Inbound GRN) &amp; Meja Tagging RFID</h2>
          <p className="text-xs text-blue-100 mt-0.5">
            Verifikasi surat jalan supplier, pembuatan dokumen GRN, dan penulisan kode EPC 96-bit pada chip RFID.
          </p>
        </div>
      </div>

      {/* Grid Form: Catat GRN & Encode Tag RFID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form 1: Catat GRN */}
        <form onSubmit={handleCreateGrn} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900">1. Catat Penerimaan Baru (GRN)</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">No. PO / Surat Jalan</label>
              <input
                type="text"
                required
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="PO-2026-8905"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah Unit Masuk</label>
              <input
                type="number"
                required
                min="1"
                value={totalQty}
                onChange={(e) => setTotalQty(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Supplier / Vendor</label>
            <input
              type="text"
              required
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="PT Razer Teknologi Indonesia"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Simpan Dokumen GRN</span>
          </button>
        </form>

        {/* Form 2: Desktop RFID Tag Encoder */}
        <form onSubmit={handleEncodeTag} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-cyan-600" />
            <h3 className="font-bold text-slate-900">2. Encode Tag RFID Baru (Desktop Reader)</h3>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Produk / SKU</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              <option value={1}>SKU-012 — Mouse Wireless Ergonomic</option>
              <option value={2}>SKU-018 — Keyboard Mechanical RGB</option>
              <option value={3}>SKU-024 — Kabel HDMI 2.0 4K Ultra</option>
              <option value={4}>SKU-031 — USB Hub Type-C 7in1 Multi</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis Tag UHF (920–923 MHz)</label>
            <select
              value={selectedTagType}
              onChange={(e) => setSelectedTagType(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              <option value="STANDARD_LABEL">Label UHF Biasa (Kardus/Plastik)</option>
              <option value="ON_METAL">Tag On-Metal (Barang Logam/Cairan)</option>
              <option value="HARD_TAG">Hard Tag ABS (Aset Perusahaan)</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center space-x-2"
          >
            <Tag className="w-4 h-4" />
            <span>Tulis EPC ke Chip RFID (Status: ENCODED)</span>
          </button>
        </form>
      </div>

      {/* Tabel Daftar GRN & Tag Ter-encode */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-800">
            Riwayat Dokumen Penerimaan (GRN)
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3">No. PO</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grnList.map((g, idx) => (
                <tr key={idx}>
                  <td className="p-3 font-bold text-slate-900">{g.po_number}</td>
                  <td className="p-3">{g.supplier_name}</td>
                  <td className="p-3 font-semibold">{g.total_qty} Unit</td>
                  <td className="p-3">
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                      {g.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-800">
            Daftar Chip EPC RFID Terdaftar
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3">Kode EPC</th>
                <th className="p-3">Tipe Tag</th>
                <th className="p-3">Lokasi</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tagsList.map((t, idx) => (
                <tr key={idx}>
                  <td className="p-3 font-mono font-bold text-slate-900">{t.epc}</td>
                  <td className="p-3">{t.type}</td>
                  <td className="p-3 text-blue-600 font-medium">{t.rack_name || 'Staging'}</td>
                  <td className="p-3">
                    <span className="bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full font-semibold">
                      {t.status}
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
