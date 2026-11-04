import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config/api';

export default function InventoryLedgerPage({
  activeMenu = 'penyimpanan',
  lastEvent,
  searchQuery = '',
  showNotification,
}) {
  const [locations, setLocations] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [localSearch, setLocalSearch] = useState('');

  // Putaway Form State
  const [epcCode, setEpcCode] = useState('E280689400004001A1B2C301');
  const [targetLoc, setTargetLoc] = useState('LOC-A-01-01');

  // Shipping & Outbound State (from digiwms.html)
  const [shippingList, setShippingList] = useState([
    {
      resi: 'JX-8839-2910',
      dest: 'PT Toko Makmur Jaya (Jakarta)',
      courier: 'JNE Regular',
      date: '12 Mei 2026',
      gatePass: 'GP-8839-OK',
      status: 'Terkirim',
    },
    {
      resi: 'SPX-9921-3341',
      dest: 'CV Digital Solusindo (Bandung)',
      courier: 'SiCepat Ekspres',
      date: '12 Mei 2026',
      gatePass: 'GP-9921-OK',
      status: 'Dalam Perjalanan',
    },
    {
      resi: 'JX-9920-1182',
      dest: 'Surya Abadi Games (Surabaya)',
      courier: 'JNE Express',
      date: '13 Mei 2026',
      gatePass: 'GP-9920-OK',
      status: 'Siap Kirim (Gate Pass Aktif)',
    },
  ]);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [shipForm, setShipForm] = useState({
    resi: `JX-${Math.floor(1000 + Math.random() * 9000)}-7788`,
    courier: 'JNE Express',
    dest: '',
  });

  const fetchInventoryData = async () => {
    try {
      const [locRes, ledRes] = await Promise.all([
        fetch(`${API_BASE_URL}/locations`),
        fetch(`${API_BASE_URL}/ledger`),
      ]);
      const locJson = await locRes.json();
      const ledJson = await ledRes.json();
      setLocations(locJson.data || []);
      setLedger(ledJson.data || []);
    } catch (err) {
      console.error('Error loading Inventory & Ledger:', err);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, [lastEvent]);

  const handlePutaway = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/putaway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epc_code: epcCode, target_location: targetLoc }),
      });
      const json = await res.json();
      if (res.ok) {
        showNotification?.(
          json.message || `Tag ${epcCode} dipindahkan ke ${targetLoc}`,
          'success'
        );
        fetchInventoryData();
      } else {
        showNotification?.(json.message || 'Gagal memindahkan rak', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddShipping = (e) => {
    e.preventDefault();
    const gpCode = `GP-${Math.floor(1000 + Math.random() * 9000)}-OK`;
    setShippingList([
      {
        resi: shipForm.resi,
        dest: shipForm.dest,
        courier: shipForm.courier,
        date: new Date().toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        gatePass: gpCode,
        status: 'Siap Kirim (Gate Pass Aktif)',
      },
      ...shippingList,
    ]);
    showNotification?.(`Pengiriman ${shipForm.resi} & Gate Pass ${gpCode} diterbitkan!`, 'success');
    setShowShippingModal(false);
    setShipForm({
      resi: `JX-${Math.floor(1000 + Math.random() * 9000)}-7788`,
      courier: 'JNE Express',
      dest: '',
    });
  };

  const combinedSearch = (localSearch || searchQuery).toLowerCase();

  // ============================================================================
  // MENU 1: PENYIMPANAN (LOCATIONS / RACKS) + PUTAWAY
  // ============================================================================
  if (activeMenu === 'penyimpanan') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Peta & Zona Lokasi Rak Gudang</h2>
            <p className="text-xs text-slate-500 mt-1">
              Denah kapasitas zona rak penyimpanan aktif di dalam gudang dan penempatan Putaway RFID.
            </p>
          </div>
          <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-3.5 py-2 rounded-xl border border-blue-200">
            {locations.length} Zona Rak Terdaftar
          </span>
        </div>

        {/* Grid Zona Rak Gudang */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {locations.map((loc) => {
            const pct = Math.min(
              100,
              Math.round((Number(loc.occupied || 0) / Number(loc.capacity || 100)) * 100)
            );
            return (
              <div
                key={loc.code}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                    {loc.code}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {loc.zone}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 mt-3 text-base">{loc.name}</h4>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Okupansi Rak</span>
                    <span className="font-bold text-slate-800">
                      {loc.occupied || 0} / {loc.capacity} Unit ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.max(pct, 6)}%` }}
                      className={`h-full rounded-full ${
                        pct > 85 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Form Putaway / Pindah Lokasi Rak */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 text-base">
            Putaway & Transfer Tag RFID Antar-Rak
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Pindahkan barang dari Staging Inbound menuju Rak Penyimpanan Utama.
          </p>
          <form onSubmit={handlePutaway} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              value={epcCode}
              onChange={(e) => setEpcCode(e.target.value)}
              placeholder="Kode EPC Tag RFID"
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
            />
            <select
              value={targetLoc}
              onChange={(e) => setTargetLoc(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              {locations.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.code} — {l.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm shadow-md transition"
            >
              Simpan Putaway Rak
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MENU 2: PICKING & PACKING PESANAN (Persis Template Awal digiwms.html)
  // ============================================================================
  if (activeMenu === 'picking') {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Picking & Packing Pesanan</h2>
            <p className="text-xs text-slate-500 mt-1">
              Daftar pesanan yang siap diambil (picking) dan dikemas (packing) oleh petugas gudang.
            </p>
          </div>
          <button
            onClick={() =>
              showNotification?.('Batch picking baru berhasil dibuat untuk 3 pesanan', 'success')
            }
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-md transition-all flex items-center space-x-2"
          >
            <span>📋</span>
            <span>Buat Batch Picking</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
                Menunggu Picking
              </span>
              <span className="text-xs text-slate-400 font-medium">14 Pesanan</span>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between font-semibold text-sm">
                  <span>ORD-8821</span>
                  <span className="text-blue-600">3 Item</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Rak A1-02 (Mouse Wireless, Mousepad)
                </p>
                <button
                  onClick={() =>
                    showNotification?.('Petugas memulai Picking ORD-8821 di Rak A1-02', 'info')
                  }
                  className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 rounded-lg font-medium"
                >
                  Mulai Picking
                </button>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between font-semibold text-sm">
                  <span>ORD-8822</span>
                  <span className="text-blue-600">5 Item</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Rak B2-01 (Keyboard Mechanical)</p>
                <button
                  onClick={() =>
                    showNotification?.('Petugas memulai Picking ORD-8822 di Rak B2-01', 'info')
                  }
                  className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 rounded-lg font-medium"
                >
                  Mulai Picking
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                Proses Packing
              </span>
              <span className="text-xs text-slate-400 font-medium">8 Pesanan</span>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between font-semibold text-sm">
                  <span>ORD-8819</span>
                  <span className="text-blue-600">2 Item</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Packing Station #2 (Bubble Wrap + Box)
                </p>
                <button
                  onClick={() =>
                    showNotification?.(
                      'Pesanan ORD-8819 selesai dikemas & Gate Pass diterbitkan!',
                      'success'
                    )
                  }
                  className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1.5 rounded-lg font-medium"
                >
                  Selesai Packing
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                Siap Kirim & Gate Pass
              </span>
              <span className="text-xs text-slate-400 font-medium">25 Pesanan</span>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between font-semibold text-sm">
                  <span>ORD-8815</span>
                  <span className="text-emerald-600">JNE Express</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Resi: JX-9920-1182 (Gate Pass Active)
                </p>
                <span className="inline-block mt-2 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  Menunggu Kurir Pickup
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MENU 3: PENGIRIMAN (SHIPPING / OUTBOUND)
  // ============================================================================
  if (activeMenu === 'pengiriman') {
    const filteredShip = shippingList.filter(
      (s) =>
        s.resi.toLowerCase().includes(combinedSearch) ||
        s.dest.toLowerCase().includes(combinedSearch) ||
        s.courier.toLowerCase().includes(combinedSearch)
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Manajemen Pengiriman & Gate Pass (Outbound)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Daftar pengiriman barang keluar gudang, otorisasi gerbang keluar, dan pelacakan kurir.
            </p>
          </div>
          <button
            onClick={() => setShowShippingModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-md transition-all flex items-center space-x-2"
          >
            <span>➕</span>
            <span>Buat Pengiriman Baru</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Cari resi, tujuan, atau kurir..."
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="p-4">No. Resi / Ref</th>
                  <th className="p-4">Tujuan / Pelanggan</th>
                  <th className="p-4">Kurir</th>
                  <th className="p-4">Tanggal Kirim</th>
                  <th className="p-4">Gate Pass</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredShip.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-4 font-mono font-bold text-blue-600">{s.resi}</td>
                    <td className="p-4 font-medium">{s.dest}</td>
                    <td className="p-4">{s.courier}</td>
                    <td className="p-4 text-slate-500">{s.date}</td>
                    <td className="p-4">
                      <span className="bg-emerald-50 text-emerald-700 font-mono text-xs px-2.5 py-1 rounded-lg font-bold">
                        {s.gatePass}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-lg font-semibold">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showShippingModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-900">
                  Buat Pengiriman & Gate Pass Baru
                </h3>
                <button
                  onClick={() => setShowShippingModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleAddShipping} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      No. Resi / Surat Jalan
                    </label>
                    <input
                      type="text"
                      required
                      value={shipForm.resi}
                      onChange={(e) => setShipForm({ ...shipForm, resi: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Kurir Pengiriman
                    </label>
                    <select
                      value={shipForm.courier}
                      onChange={(e) => setShipForm({ ...shipForm, courier: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    >
                      <option value="JNE Express">JNE Express</option>
                      <option value="SiCepat Ekspres">SiCepat Ekspres</option>
                      <option value="J&T Cargo">J&T Cargo</option>
                      <option value="Internal Armada Gudang">Internal Armada Gudang</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Tujuan / Nama Pelanggan
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="PT Sentosa Computer (Surabaya)"
                    value={shipForm.dest}
                    onChange={(e) => setShipForm({ ...shipForm, dest: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs text-blue-800">
                    Menyimpan pengiriman akan menerbitkan <b>Gate Pass resmi</b>, sehingga reader gerbang RFID mengizinkan barang lewat tanpa memicu alarm.
                  </p>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowShippingModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-medium shadow-md"
                  >
                    Terbitkan & Simpan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // MENU 4: BUKU BESAR PERGERAKAN (LEDGER APPEND-ONLY)
  // ============================================================================
  const filteredLedger = ledger.filter(
    (m) =>
      m.sku?.toLowerCase().includes(combinedSearch) ||
      m.movement_type?.toLowerCase().includes(combinedSearch) ||
      m.reference_doc?.toLowerCase().includes(combinedSearch)
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900">
              Buku Besar Pergerakan Stok (Stock Ledger)
            </h2>
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-indigo-200">
              Append-Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Seluruh mutasi tercatat permanen tanpa menimpa angka stok; menjamin setiap selisih dapat diaudit.
          </p>
        </div>
        <button
          onClick={() =>
            showNotification?.('Buku besar berhasil diexport ke CSV/Excel!', 'success')
          }
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-md transition-all flex items-center space-x-2"
        >
          <span>📥</span>
          <span>Export Data Ledger</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between gap-3">
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Cari tipe mutasi, SKU, atau dokumen referensi..."
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-full sm:w-80 focus:outline-none"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <th className="p-4">ID Transaksi</th>
                <th className="p-4">Waktu</th>
                <th className="p-4">Tipe Transaksi</th>
                <th className="p-4">SKU / Barang</th>
                <th className="p-4">Dokumen Ref</th>
                <th className="p-4">Jumlah Mutasi</th>
                <th className="p-4">Catatan Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLedger.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="p-4 font-mono font-bold text-slate-500">TX-{1000 + Number(m.id)}</td>
                  <td className="p-4 text-xs text-slate-400">
                    {new Date(m.created_at).toLocaleString('id-ID')}
                  </td>
                  <td className="p-4">
                    <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-lg font-bold font-mono">
                      {m.movement_type}
                    </span>
                  </td>
                  <td className="p-4 font-mono font-semibold text-slate-900">{m.sku}</td>
                  <td className="p-4 font-mono text-xs text-slate-600">{m.reference_doc}</td>
                  <td
                    className={`p-4 font-extrabold ${
                      Number(m.qty_change) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {Number(m.qty_change) >= 0 ? `+${m.qty_change}` : m.qty_change}
                  </td>
                  <td className="p-4 text-xs text-slate-500">{m.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
