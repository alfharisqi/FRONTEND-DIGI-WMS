import React, { useEffect, useState } from 'react';
import {
  Boxes,
  PackagePlus,
  PackageOpen,
  ArrowRightLeft,
  RefreshCw,
  Search,
  CheckCircle2,
  X,
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

export default function MasterBoxPage({ showNotification, lastEvent }) {
  const [boxes, setBoxes] = useState([]);
  const [summary, setSummary] = useState({
    total_boxes: 0,
    sealed_boxes: 0,
    in_rack_boxes: 0,
    unpacked_boxes: 0,
    total_units_in_active_boxes: 0,
  });
  const [products, setProducts] = useState([]);
  const [racks, setRacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Modal Terima Master Box Baru
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    product_id: '',
    qty_per_box: 10,
    location_code: 'INB01',
    master_epc: '',
    notes: '',
  });

  // Modal Putaway Master Box
  const [putawayBox, setPutawayBox] = useState(null);
  const [targetRack, setTargetRack] = useState('');
  const [savingPutaway, setSavingPutaway] = useState(false);

  // Modal Hasil Break-Pack (EPC Satuan yang Terbentuk)
  const [unpackingId, setUnpackingId] = useState(null);
  const [unpackedResult, setUnpackedResult] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [boxRes, prodRes, locRes] = await Promise.all([
        fetch(`${API_BASE_URL}/boxes`),
        fetch(`${API_BASE_URL}/products`),
        fetch(`${API_BASE_URL}/locations`),
      ]);
      const [boxJson, prodJson, locJson] = await Promise.all([
        boxRes.json(),
        prodRes.json(),
        locRes.json(),
      ]);

      setBoxes(Array.isArray(boxJson.data) ? boxJson.data : []);
      if (boxJson.summary) setSummary(boxJson.summary);

      const prodList = Array.isArray(prodJson.data) ? prodJson.data : [];
      setProducts(prodList);

      const locList = Array.isArray(locJson.data) ? locJson.data : [];
      const rackOnly = locList.filter((l) => l.location_type === 'RACK');
      setRacks(rackOnly);
      if (rackOnly.length > 0 && !targetRack) {
        setTargetRack(rackOnly[0].code);
      }
    } catch (err) {
      console.error('Gagal memuat data Master Box:', err);
      showNotification?.('Gagal memuat data Master Box dari server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [lastEvent]);

  const handleCreateBox = async (e) => {
    e.preventDefault();
    if (!form.product_id) {
      showNotification?.('Silakan pilih produk terlebih dahulu.', 'warn');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/boxes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: form.product_id,
          qty_per_box: Number(form.qty_per_box),
          location_code: form.location_code,
          master_epc: form.master_epc.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Gagal mendaftarkan Master Box.');
      showNotification?.(json.message, 'success');
      setShowCreateModal(false);
      setForm({ product_id: '', qty_per_box: 10, location_code: 'INB01', master_epc: '', notes: '' });
      await fetchAll();
    } catch (err) {
      showNotification?.(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handlePutawayBox = async (e) => {
    e.preventDefault();
    if (!putawayBox || !targetRack) return;
    setSavingPutaway(true);
    try {
      const res = await fetch(`${API_BASE_URL}/boxes/${encodeURIComponent(putawayBox.id)}/putaway`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_code: targetRack }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Gagal putaway Master Box.');
      showNotification?.(json.message, 'success');
      setPutawayBox(null);
      await fetchAll();
    } catch (err) {
      showNotification?.(err.message, 'error');
    } finally {
      setSavingPutaway(false);
    }
  };

  const handleUnpackBox = async (box) => {
    if (
      !window.confirm(
        `Break-Pack ${box.box_code}?\n1 Master Box akan dipecah menjadi ${box.qty_per_box} tag RFID satuan untuk produk ${box.sku}.`
      )
    ) {
      return;
    }
    setUnpackingId(box.id);
    try {
      const res = await fetch(`${API_BASE_URL}/boxes/${encodeURIComponent(box.id)}/unpack`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Gagal memecah Master Box.');
      showNotification?.(json.message, 'success');
      setUnpackedResult({
        box_code: box.box_code,
        sku: box.sku,
        product_name: box.product_name,
        target_status: json.data?.target_status,
        generated_epcs: json.data?.generated_epcs || [],
      });
      await fetchAll();
    } catch (err) {
      showNotification?.(err.message, 'error');
    } finally {
      setUnpackingId(null);
    }
  };

  const filteredBoxes = boxes.filter((b) => {
    if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        String(b.box_code || '').toLowerCase().includes(q) ||
        String(b.master_epc || '').toLowerCase().includes(q) ||
        String(b.sku || '').toLowerCase().includes(q) ||
        String(b.product_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusBadge = (status) => {
    if (status === 'SEALED') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status === 'IN_RACK') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'UNPACKED') return 'bg-slate-100 text-slate-600 border-slate-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" strokeWidth={1.75} />
            <h1 className="text-lg font-bold text-slate-900">Master Box / Karton & Break-Pack</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Terima dan simpan stok per karton menggunakan 1 Master Tag RFID tanpa membongkar isi. Pecah menjadi tag satuan (Break-Pack) saat dibutuhkan untuk eceran/POS.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition"
          >
            <PackagePlus className="w-4 h-4" strokeWidth={1.75} />
            <span>Terima Master Box</span>
          </button>
          <button
            type="button"
            onClick={fetchAll}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"
            title="Muat Ulang"
          >
            <RefreshCw className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* 3 Simple KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Box Aktif (Tersegel / Di Rak)</span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {(summary.sealed_boxes || 0) + (summary.in_rack_boxes || 0)}
            </span>
            <span className="text-xs text-slate-400">
              box ({summary.in_rack_boxes || 0} di rak, {summary.sealed_boxes || 0} di staging)
            </span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Unit Dalam Box Aktif</span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600">
              {summary.total_units_in_active_boxes || 0}
            </span>
            <span className="text-xs text-slate-400">unit tersimpan utuh</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Box Sudah Break-Pack</span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{summary.unpacked_boxes || 0}</span>
            <span className="text-xs text-slate-400">dipecah ke tag satuan</span>
          </div>
        </div>
      </div>

      {/* Filter & Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {['ALL', 'SEALED', 'IN_RACK', 'UNPACKED'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  statusFilter === tab
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab === 'ALL'
                  ? 'Semua'
                  : tab === 'SEALED'
                  ? 'Tersegel (Staging)'
                  : tab === 'IN_RACK'
                  ? 'Di Rak'
                  : 'Sudah Break-Pack'}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode box, EPC, SKU..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <th className="py-3 px-4">Kode Box & Master EPC</th>
                <th className="py-3 px-4">Produk</th>
                <th className="py-3 px-4 text-center">Isi / Box</th>
                <th className="py-3 px-4">Lokasi</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Memuat data Master Box...
                  </td>
                </tr>
              ) : filteredBoxes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Belum ada Master Box. Klik <strong>"Terima Master Box"</strong> untuk mendaftarkan 1 karton berisi banyak unit tanpa membongkar isi.
                  </td>
                </tr>
              ) : (
                filteredBoxes.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <p className="font-mono font-bold text-slate-900">{b.box_code}</p>
                      <p className="font-mono text-[10px] text-slate-400">{b.master_epc}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{b.product_name}</p>
                      <p className="font-mono text-[10px] text-blue-600">{b.sku}</p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-slate-900">{b.qty_per_box}</span>
                      <span className="text-slate-400 ml-1">unit</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {b.location_code ? `${b.location_code} - ${b.location_name}` : 'Staging (INB01)'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge(
                          b.status
                        )}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {(b.status === 'SEALED' || b.status === 'IN_RACK') && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setPutawayBox(b);
                              if (racks.length > 0) setTargetRack(racks[0].code);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
                            title="Pindahkan 1 box utuh ke rak"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>Putaway Rak</span>
                          </button>
                          <button
                            type="button"
                            disabled={unpackingId === b.id}
                            onClick={() => handleUnpackBox(b)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition disabled:opacity-50"
                            title="Pecah 1 box menjadi tag RFID satuan"
                          >
                            <PackageOpen className="w-3.5 h-3.5" />
                            <span>{unpackingId === b.id ? 'Memecah...' : 'Break-Pack'}</span>
                          </button>
                        </>
                      )}
                      {b.status === 'UNPACKED' && (
                        <span className="text-[11px] text-slate-400">Sudah dipecah</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Terima Master Box Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-900">Terima Master Box / Karton Baru</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateBox} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Produk di Dalam Box *</label>
                <select
                  required
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="">-- Pilih Produk (SKU) --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Isi per Box (Unit) *</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    required
                    value={form.qty_per_box}
                    onChange={(e) => setForm({ ...form, qty_per_box: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lokasi Awal</label>
                  <select
                    value={form.location_code}
                    onChange={(e) => setForm({ ...form, location_code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="INB01">INB01 - Staging Inbound</option>
                    {racks.map((r) => (
                      <option key={r.id || r.code} value={r.code}>
                        {r.code} - {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Master EPC Karton (Opsional — 24 Hex)
                </label>
                <input
                  type="text"
                  maxLength={24}
                  placeholder="Kosongkan untuk auto-generate 1 Master EPC"
                  value={form.master_epc}
                  onChange={(e) => setForm({ ...form, master_epc: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan (Opsional)</label>
                <input
                  type="text"
                  placeholder="cth: PO-2026-991, segel pabrik utuh"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {creating ? 'Menyimpan...' : 'Simpan Master Box'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Putaway Master Box ke Rak */}
      {putawayBox && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-900">Putaway Master Box ke Rak</h3>
              <button
                type="button"
                onClick={() => setPutawayBox(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePutawayBox} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-mono font-bold text-slate-900">{putawayBox.box_code}</p>
                <p className="text-slate-600 mt-0.5">
                  {putawayBox.sku} — {putawayBox.qty_per_box} unit dalam 1 box
                </p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rak Tujuan *</label>
                <select
                  required
                  value={targetRack}
                  onChange={(e) => setTargetRack(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  {racks.map((r) => (
                    <option key={r.id || r.code} value={r.code}>
                      {r.code} - {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPutawayBox(null)}
                  className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingPutaway}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  {savingPutaway ? 'Memindahkan...' : 'Pindahkan Box'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hasil Break-Pack (Daftar EPC Satuan Terbentuk) */}
      {unpackedResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <h3 className="font-bold text-sm">Break-Pack Berhasil</h3>
              </div>
              <button
                type="button"
                onClick={() => setUnpackedResult(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-600">
                Box <strong className="font-mono text-slate-900">{unpackedResult.box_code}</strong> telah dipecah menjadi{' '}
                <strong>{unpackedResult.generated_epcs.length} tag RFID satuan</strong> berstatus{' '}
                <span className="font-mono font-semibold text-emerald-700">{unpackedResult.target_status}</span>:
              </p>
              <div className="max-h-52 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 font-mono text-[11px]">
                {unpackedResult.generated_epcs.map((epc, i) => (
                  <div key={epc} className="flex justify-between text-slate-700">
                    <span>{i + 1}. {epc}</span>
                    <span className="text-emerald-600">{unpackedResult.target_status}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setUnpackedResult(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
