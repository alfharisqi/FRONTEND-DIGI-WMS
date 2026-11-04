import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config/api';

export default function InboundTaggingPage({
  activeMenu = 'penerimaan',
  lastEvent,
  searchQuery = '',
  showNotification,
}) {
  const [products, setProducts] = useState([]);
  const [tags, setTags] = useState([]);
  const [receivingList, setReceivingList] = useState([
    {
      po: 'PO-2026-8901',
      supplier: 'PT Logitech Indonesia',
      date: '12 Mei 2026',
      qty: 150,
      rfidStatus: 'Semua Ter-encode',
      status: 'Selesai',
    },
    {
      po: 'PO-2026-8902',
      supplier: 'CV Corsair Global',
      date: '12 Mei 2026',
      qty: 85,
      rfidStatus: 'Semua Ter-encode',
      status: 'Selesai',
    },
    {
      po: 'PO-2026-8903',
      supplier: 'PT Anker Technology',
      date: '11 Mei 2026',
      qty: 85,
      rfidStatus: 'Menunggu Tagging',
      status: 'Menunggu Verifikasi',
    },
  ]);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tagStatusFilter, setTagStatusFilter] = useState('');
  const [localSearch, setLocalSearch] = useState('');

  // Modal states
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [showEncodeModal, setShowEncodeModal] = useState(false);
  const [showSkuModal, setShowSkuModal] = useState(false);

  // Forms
  const [grnForm, setGrnForm] = useState({
    po: `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    supplier: 'PT Razer Indonesia',
    sku: 'SKU-MOUSE-001',
    qty: 25,
  });

  const [encodeForm, setEncodeForm] = useState({
    sku: 'SKU-MOUSE-001',
    epc_code: '',
    tagType: 'Label Biasa (UHF)',
    status: 'ACTIVE',
  });

  const [skuForm, setSkuForm] = useState({
    sku: '',
    name: '',
    category: 'Aksesoris Komputer',
    price_idr: 350000,
    min_stock: 20,
  });

  const fetchData = async () => {
    try {
      const [prodRes, tagRes] = await Promise.all([
        fetch(`${API_BASE_URL}/products`),
        fetch(`${API_BASE_URL}/rfid/tags`),
      ]);
      const prodJson = await prodRes.json();
      const tagJson = await tagRes.json();
      const prodData = prodJson.data || [];
      setProducts(prodData);
      setTags(tagJson.data || []);
      if (prodData.length > 0 && !grnForm.sku) {
        setGrnForm((f) => ({ ...f, sku: prodData[0].sku }));
        setEncodeForm((f) => ({ ...f, sku: prodData[0].sku }));
      }
    } catch (err) {
      console.error('Error loading Inbound data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [lastEvent]);

  const generateRandomEpc = () => {
    const hex = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16)
        .toString(16)
        .toUpperCase()
    ).join('');
    setEncodeForm({ ...encodeForm, epc_code: `E2806894${hex}` });
  };

  const handleCreateGrn = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/inbound/grn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: grnForm.sku,
          qty: Number(grnForm.qty),
          supplier_name: grnForm.supplier,
          po_number: grnForm.po,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setReceivingList([
          {
            po: grnForm.po,
            supplier: grnForm.supplier,
            date: new Date().toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }),
            qty: Number(grnForm.qty),
            rfidStatus: 'Semua Ter-encode',
            status: 'Selesai',
          },
          ...receivingList,
        ]);
        showNotification?.(json.message || 'Penerimaan GRN berhasil dicatat ke Ledger!', 'success');
        setShowGrnModal(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEncodeTag = async (e) => {
    e.preventDefault();
    const epcToUse =
      encodeForm.epc_code ||
      `E2806894${Array.from({ length: 16 }, () =>
        Math.floor(Math.random() * 16)
          .toString(16)
          .toUpperCase()
      ).join('')}`;
    try {
      const res = await fetch(`${API_BASE_URL}/rfid/encode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epc_code: epcToUse,
          sku: encodeForm.sku,
          location_code: 'LOC-STAGE-01',
        }),
      });
      const json = await res.json();
      if (res.ok) {
        showNotification?.(`Tag ${epcToUse} berhasil di-encode!`, 'success');
        setShowEncodeModal(false);
        setEncodeForm({ ...encodeForm, epc_code: '' });
        fetchData();
      } else {
        showNotification?.(json.message || 'Gagal encode tag', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSku = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skuForm),
      });
      const json = await res.json();
      if (res.ok) {
        showNotification?.(json.message || 'SKU Barang berhasil ditambahkan', 'success');
        setShowSkuModal(false);
        setSkuForm({
          sku: '',
          name: '',
          category: 'Aksesoris Komputer',
          price_idr: 350000,
          min_stock: 20,
        });
        fetchData();
      } else {
        showNotification?.(json.message || 'Gagal menambah SKU', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const combinedSearch = (localSearch || searchQuery).toLowerCase();

  // ============================================================================
  // MENU 1: PENERIMAAN (RECEIVING / INBOUND)
  // ============================================================================
  if (activeMenu === 'penerimaan') {
    const filteredReceiving = receivingList.filter((item) => {
      const matchSearch =
        item.po.toLowerCase().includes(combinedSearch) ||
        item.supplier.toLowerCase().includes(combinedSearch);
      const matchStatus = !statusFilter || item.status === statusFilter;
      return matchSearch && matchStatus;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Manajemen Penerimaan Barang (Inbound & GRN)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Catat surat jalan masuk dari supplier, verifikasi fisik, dan siapkan encoding tag RFID.
            </p>
          </div>
          <button
            onClick={() => setShowGrnModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-md shadow-blue-600/20 transition-all flex items-center space-x-2"
          >
            <span>➕</span>
            <span>Catat Penerimaan Baru</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-3">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Cari nomor PO atau supplier..."
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center space-x-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
              >
                <option value="">Semua Status</option>
                <option value="Selesai">Selesai</option>
                <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="p-4">No. PO / Ref</th>
                  <th className="p-4">Supplier</th>
                  <th className="p-4">Tanggal Masuk</th>
                  <th className="p-4">Jumlah Item</th>
                  <th className="p-4">Status RFID</th>
                  <th className="p-4">Status Penerimaan</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredReceiving.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-4 font-bold text-blue-600 font-mono">{row.po}</td>
                    <td className="p-4 font-medium">{row.supplier}</td>
                    <td className="p-4 text-slate-500">{row.date}</td>
                    <td className="p-4 font-semibold">{row.qty} Unit</td>
                    <td className="p-4">
                      <span className="bg-cyan-50 text-cyan-700 text-xs px-2.5 py-1 rounded-lg font-semibold">
                        {row.rfidStatus}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${
                          row.status === 'Selesai'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() =>
                          showNotification?.(`Detail Surat Jalan ${row.po} terverifikasi`, 'info')
                        }
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Detail GRN
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Catat Penerimaan Baru */}
        {showGrnModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-900">
                  Catat Penerimaan Baru (Inbound GRN)
                </h3>
                <button
                  onClick={() => setShowGrnModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleCreateGrn} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      No. PO / Ref
                    </label>
                    <input
                      type="text"
                      required
                      value={grnForm.po}
                      onChange={(e) => setGrnForm({ ...grnForm, po: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Pilih SKU Produk
                    </label>
                    <select
                      value={grnForm.sku}
                      onChange={(e) => setGrnForm({ ...grnForm, sku: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    >
                      {products.map((p) => (
                        <option key={p.sku} value={p.sku}>
                          {p.sku} — {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Supplier / Vendor
                  </label>
                  <input
                    type="text"
                    required
                    value={grnForm.supplier}
                    onChange={(e) => setGrnForm({ ...grnForm, supplier: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Total Unit Masuk (+ Ledger)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={grnForm.qty}
                    onChange={(e) => setGrnForm({ ...grnForm, qty: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowGrnModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-medium shadow-md"
                  >
                    Simpan Penerimaan
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
  // MENU 2: STOK BARANG (INVENTORY)
  // ============================================================================
  if (activeMenu === 'stok') {
    const filteredProducts = products.filter((p) => {
      const matchSearch =
        p.name?.toLowerCase().includes(combinedSearch) ||
        p.sku?.toLowerCase().includes(combinedSearch);
      const matchCat = !categoryFilter || p.category === categoryFilter;
      return matchSearch && matchCat;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Inventaris Stok Barang Gudang</h2>
            <p className="text-xs text-slate-500 mt-1">
              Daftar lengkap seluruh barang tersimpan beserta lokasi rak dan penanda RFID.
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowEncodeModal(true)}
              className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-md transition-all flex items-center space-x-2"
            >
              <span>🏷️</span>
              <span>Encode Tag Baru</span>
            </button>
            <button
              onClick={() => setShowSkuModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-md shadow-blue-600/20 transition-all flex items-center space-x-2"
            >
              <span>➕</span>
              <span>Tambah SKU Barang</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-3">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Cari nama barang atau SKU..."
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center space-x-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
              >
                <option value="">Semua Kategori</option>
                <option value="Elektronik">Elektronik</option>
                <option value="Aksesoris">Aksesoris</option>
                <option value="Aksesoris Komputer">Aksesoris Komputer</option>
                <option value="Periferal Gaming">Periferal Gaming</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="p-4">SKU / Kode</th>
                  <th className="p-4">Nama Barang</th>
                  <th className="p-4">Kategori</th>
                  <th className="p-4">Lokasi Rak</th>
                  <th className="p-4">Jumlah Stok</th>
                  <th className="p-4">Status Stok</th>
                  <th className="p-4 text-right">Harga Satuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProducts.map((p) => {
                  const isLow = Number(p.current_stock) <= Number(p.min_stock || 15);
                  return (
                    <tr key={p.id || p.sku} className="hover:bg-slate-50">
                      <td className="p-4 font-mono font-bold text-blue-600">{p.sku}</td>
                      <td className="p-4 font-semibold text-slate-900">{p.name}</td>
                      <td className="p-4 text-slate-500">{p.category}</td>
                      <td className="p-4">
                        <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-medium">
                          Rak A1-01
                        </span>
                      </td>
                      <td className="p-4 font-extrabold text-base">{p.current_stock} Unit</td>
                      <td className="p-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${
                            isLow
                              ? 'bg-rose-50 text-rose-600 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {isLow ? 'Stok Rendah' : 'Aman'}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-slate-600">
                        Rp {Number(p.price_idr || 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Tambah SKU */}
        {showSkuModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-900">Tambah Barang / SKU Baru</h3>
                <button
                  onClick={() => setShowSkuModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleAddSku} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Nama Barang
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Headset Gaming Wireless"
                    value={skuForm.name}
                    onChange={(e) => setSkuForm({ ...skuForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      SKU / Kode Barang
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="SKU-HEAD-009"
                      value={skuForm.sku}
                      onChange={(e) => setSkuForm({ ...skuForm, sku: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Kategori
                    </label>
                    <select
                      value={skuForm.category}
                      onChange={(e) => setSkuForm({ ...skuForm, category: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    >
                      <option value="Elektronik">Elektronik</option>
                      <option value="Aksesoris">Aksesoris</option>
                      <option value="Aksesoris Komputer">Aksesoris Komputer</option>
                      <option value="Periferal Gaming">Periferal Gaming</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Harga Satuan (Rp)
                    </label>
                    <input
                      type="number"
                      required
                      value={skuForm.price_idr}
                      onChange={(e) =>
                        setSkuForm({ ...skuForm, price_idr: Number(e.target.value) })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Stok Minimum Alert
                    </label>
                    <input
                      type="number"
                      required
                      value={skuForm.min_stock}
                      onChange={(e) =>
                        setSkuForm({ ...skuForm, min_stock: Number(e.target.value) })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowSkuModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-medium shadow-md"
                  >
                    Simpan Barang
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Encode Tag */}
        {showEncodeModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-900">Encode Tag RFID Baru</h3>
                <button
                  onClick={() => setShowEncodeModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleEncodeTag} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Pilih Barang / SKU
                  </label>
                  <select
                    value={encodeForm.sku}
                    onChange={(e) => setEncodeForm({ ...encodeForm, sku: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    {products.map((p) => (
                      <option key={p.sku} value={p.sku}>
                        {p.sku} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    EPC 96-Bit Hex Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Otomatis jika dikosongkan"
                      value={encodeForm.epc_code}
                      onChange={(e) =>
                        setEncodeForm({ ...encodeForm, epc_code: e.target.value })
                      }
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={generateRandomEpc}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold"
                    >
                      Generate
                    </button>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEncodeModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-cyan-600 text-white hover:bg-cyan-700 rounded-xl text-sm font-medium shadow-md"
                  >
                    Tulis ke Chip RFID
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
  // MENU 3: RFID TAG & ENCODING (CORE)
  // ============================================================================
  const filteredTags = tags.filter((t) => {
    const matchSearch =
      t.epc_code?.toLowerCase().includes(combinedSearch) ||
      t.sku?.toLowerCase().includes(combinedSearch) ||
      t.product_name?.toLowerCase().includes(combinedSearch);
    const matchStatus = !tagStatusFilter || t.status === tagStatusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900">
              Manajemen Tag RFID UHF & Encoding
            </h2>
            <span className="bg-cyan-50 text-cyan-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-cyan-200">
              920–923 MHz
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Daftar chip EPC terdaftar, tipe tag (Label/On-Metal/Hard Tag), dan status siklus hidup tag.
          </p>
        </div>
        <button
          onClick={() => setShowEncodeModal(true)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-md shadow-cyan-600/20 transition-all flex items-center space-x-2"
        >
          <span>🏷️</span>
          <span>Encode Tag Baru (Desktop Reader)</span>
        </button>
      </div>

      {/* Siklus Status Info (Persis Template Awal digiwms.html) */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between text-xs gap-3">
        <span className="font-bold text-slate-300 uppercase tracking-wider">
          Siklus Hidup Tag:
        </span>
        <div className="flex items-center flex-wrap gap-2">
          <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg">
            1. Belum Dipakai
          </span>
          <span className="text-slate-600">→</span>
          <span className="bg-blue-900/60 text-blue-300 px-2.5 py-1 rounded-lg">
            2. Ter-encode
          </span>
          <span className="text-slate-600">→</span>
          <span className="bg-emerald-900/60 text-emerald-300 px-2.5 py-1 rounded-lg">
            3. In Stock
          </span>
          <span className="text-slate-600">→</span>
          <span className="bg-amber-900/60 text-amber-300 px-2.5 py-1 rounded-lg">
            4. Reserved
          </span>
          <span className="text-slate-600">→</span>
          <span className="bg-indigo-900/60 text-indigo-300 px-2.5 py-1 rounded-lg font-bold">
            5. Authorized Out
          </span>
          <span className="text-slate-600">→</span>
          <span className="bg-slate-700 text-slate-400 px-2.5 py-1 rounded-lg">
            6. Keluar / Terjual
          </span>
        </div>
      </div>

      {/* RFID Tags Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-3">
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Cari EPC atau Nama Barang..."
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={tagStatusFilter}
            onChange={(e) => setTagStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
          >
            <option value="">Semua Status Tag</option>
            <option value="ACTIVE">In Stock (ACTIVE)</option>
            <option value="SOLD">Authorized Out / SOLD</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <th className="p-4">EPC Tag (Hex Code)</th>
                <th className="p-4">Barang / SKU</th>
                <th className="p-4">Tipe Tag</th>
                <th className="p-4">Lokasi Rak</th>
                <th className="p-4">Kekuatan RSSI</th>
                <th className="p-4">Status Otorisasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTags.map((t) => (
                <tr key={t.epc_code} className="hover:bg-slate-50">
                  <td className="p-4 font-mono font-bold text-cyan-700">{t.epc_code}</td>
                  <td className="p-4">
                    <p className="font-semibold text-slate-900">{t.product_name || t.sku}</p>
                    <span className="text-xs text-slate-400 font-mono">{t.sku}</span>
                  </td>
                  <td className="p-4 text-xs text-slate-600">Label UHF Gen2</td>
                  <td className="p-4">
                    <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-mono">
                      {t.location_code}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-xs text-emerald-600">-54 dBm</td>
                  <td className="p-4">
                    <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-lg font-semibold">
                      {t.status === 'ACTIVE' ? 'In Stock' : t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Encode Tag */}
      {showEncodeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-900">Encode Tag RFID Baru</h3>
              <button
                onClick={() => setShowEncodeModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEncodeTag} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Pilih Barang / SKU
                </label>
                <select
                  value={encodeForm.sku}
                  onChange={(e) => setEncodeForm({ ...encodeForm, sku: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  {products.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Kode EPC 96-Bit (Hex)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Kosongkan untuk Auto-Generate"
                    value={encodeForm.epc_code}
                    onChange={(e) =>
                      setEncodeForm({ ...encodeForm, epc_code: e.target.value })
                    }
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={generateRandomEpc}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-200">
                <p className="text-xs text-cyan-800">
                  Sistem akan men-generate EPC 96-bit berstandar Gen2 yang unik di rentang frekuensi 920–923 MHz dan mempublikasikannya ke EMQX MQTT.
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEncodeModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 text-white hover:bg-cyan-700 rounded-xl text-sm font-medium shadow-md"
                >
                  Tulis ke Chip RFID
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
