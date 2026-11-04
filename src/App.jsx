import React, { useState, useEffect } from 'react';
import { createMqttSubscription } from './config/mqttClient';
import { API_BASE_URL } from './config/api';
import DashboardOverviewPage from './modules/orang4-dashboard/DashboardOverviewPage';
import InboundTaggingPage from './modules/orang1-inbound/InboundTaggingPage';
import InventoryLedgerPage from './modules/orang2-inventory/InventoryLedgerPage';
import StockOpnamePage from './modules/orang3-opname/StockOpnamePage';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');

  // State User Aktif (RBAC Auth — dikelola oleh Orang 4)
  const [currentUser, setCurrentUser] = useState({
    id: 1,
    username: 'admin_wms',
    full_name: 'Sarah Jenkins',
    role: 'Supervisor Gudang',
  });

  // State Toast Notification (Persis Template Awal digiwms.html)
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'success',
  });

  // State Modal Global Tambah Barang Cepat dari Header
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickItem, setQuickItem] = useState({
    sku: '',
    name: '',
    category: 'Aksesoris Komputer',
    price_idr: 350000,
    min_stock: 20,
  });

  const showNotification = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3200);
  };

  useEffect(() => {
    const sub = createMqttSubscription(
      (event) => {
        setLastEvent(event);
      },
      (status) => {
        setMqttConnected(status);
      }
    );
    return () => sub.disconnect();
  }, []);

  const switchTab = (tabId) => {
    setActiveTab(tabId);
    setSidebarOpen(false);
  };

  const handleGlobalSearch = (val) => {
    setGlobalSearch(val);
    if (val.trim().length > 1 && activeTab === 'dashboard') {
      setActiveTab('stok');
    }
  };

  const handleQuickAddItem = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quickItem),
      });
      const json = await res.json();
      if (res.ok) {
        showNotification(json.message || 'Barang berhasil ditambahkan!', 'success');
        setShowQuickAddModal(false);
        setQuickItem({
          sku: '',
          name: '',
          category: 'Aksesoris Komputer',
          price_idr: 350000,
          min_stock: 20,
        });
        setLastEvent({
          topic: 'digiwms/product/created',
          payload: json.data,
          receivedAt: new Date().toLocaleTimeString('id-ID'),
        });
      } else {
        showNotification(json.message || 'Gagal menambah barang', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const navClass = (tabId) =>
    `nav-item flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full text-left ${
      activeTab === tabId
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  // Pemetaan Menu Template Awal digiwms.html -> 4 Modul Tim (Tanpa Konflik Git)
  const renderMainContent = () => {
    // 1. Modul Orang 4 (Dashboard, Laporan Analitik/RBAC/Audit, Pengaturan, Flyer)
    if (['dashboard', 'laporan', 'pengaturan', 'flyer'].includes(activeTab)) {
      return (
        <DashboardOverviewPage
          activeMenu={activeTab}
          switchTab={switchTab}
          openAddProductModal={() => setShowQuickAddModal(true)}
          lastEvent={lastEvent}
          mqttConnected={mqttConnected}
          currentUser={currentUser}
          onUserSwitch={setCurrentUser}
          showNotification={showNotification}
        />
      );
    }

    // 2. Modul Orang 1 (Penerimaan Inbound GRN, Stok Barang, Tag & Encoding RFID)
    if (['penerimaan', 'stok', 'rfid-tag'].includes(activeTab)) {
      return (
        <InboundTaggingPage
          activeMenu={activeTab}
          lastEvent={lastEvent}
          searchQuery={globalSearch}
          showNotification={showNotification}
        />
      );
    }

    // 3. Modul Orang 2 (Penyimpanan Rak, Picking & Packing, Pengiriman Outbound, Ledger Pergerakan)
    if (['penyimpanan', 'picking', 'pengiriman', 'ledger'].includes(activeTab)) {
      return (
        <InventoryLedgerPage
          activeMenu={activeTab}
          lastEvent={lastEvent}
          searchQuery={globalSearch}
          showNotification={showNotification}
        />
      );
    }

    // 4. Modul Orang 3 (Opname Handheld RFID & Gate Alarm Live)
    if (['rfid-opname', 'rfid-gate'].includes(activeTab)) {
      return (
        <StockOpnamePage
          activeMenu={activeTab}
          lastEvent={lastEvent}
          showNotification={showNotification}
        />
      );
    }

    return null;
  };

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans text-slate-800 antialiased overflow-hidden">
      {/* ================= SIDEBAR NAVIGATION (PERSIS TEMPLATE AWAL digiwms.html) ================= */}
      <aside
        className={`w-64 bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 z-30 shrink-0 md:relative absolute inset-y-0 left-0 shadow-xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo Brand */}
        <div className="h-16 flex items-center justify-between px-6 bg-slate-950/50 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-500/30">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-wide">DIGI WMS</span>
              <span className="block text-[10px] text-blue-400 font-medium">
                RFID Warehouse & POS
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto custom-scrollbar">
          {/* Operasional Utama */}
          <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase mb-1">
            Menu Utama
          </p>
          <button onClick={() => switchTab('dashboard')} className={navClass('dashboard')}>
            <span>📊</span>
            <span>Dashboard</span>
          </button>
          <button onClick={() => switchTab('penerimaan')} className={navClass('penerimaan')}>
            <span>🚚</span>
            <span>Penerimaan (Inbound)</span>
            <span className="ml-auto bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full font-semibold">
              320
            </span>
          </button>
          <button onClick={() => switchTab('stok')} className={navClass('stok')}>
            <span>📦</span>
            <span>Stok Barang</span>
          </button>
          <button onClick={() => switchTab('penyimpanan')} className={navClass('penyimpanan')}>
            <span>📍</span>
            <span>Penyimpanan (Rak)</span>
          </button>
          <button onClick={() => switchTab('picking')} className={navClass('picking')}>
            <span>📋</span>
            <span>Picking & Packing</span>
          </button>
          <button onClick={() => switchTab('pengiriman')} className={navClass('pengiriman')}>
            <span>🚀</span>
            <span>Pengiriman (Outbound)</span>
            <span className="ml-auto bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full font-semibold">
              280
            </span>
          </button>

          {/* RFID & Keamanan Core */}
          <p className="px-3 text-[11px] font-semibold tracking-wider text-amber-400 uppercase mt-5 mb-1 flex items-center justify-between pt-3">
            <span>RFID & Gate Core</span>
            <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-bold">
              UHF 920MHz
            </span>
          </p>
          <button onClick={() => switchTab('rfid-tag')} className={navClass('rfid-tag')}>
            <span>🏷️</span>
            <span>Tag & Encoding</span>
          </button>
          <button onClick={() => switchTab('rfid-opname')} className={navClass('rfid-opname')}>
            <span>📡</span>
            <span>Opname Handheld</span>
            <span className="ml-auto bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
              Auto
            </span>
          </button>
          <button onClick={() => switchTab('rfid-gate')} className={navClass('rfid-gate')}>
            <span>🚨</span>
            <span>Gate & Alarm Live</span>
            <span className="ml-auto bg-rose-500/20 text-rose-400 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
              Relay
            </span>
          </button>
          <button onClick={() => switchTab('ledger')} className={navClass('ledger')}>
            <span>📜</span>
            <span>Ledger Pergerakan</span>
          </button>

          {/* Sistem & Analitik */}
          <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase mt-5 mb-1 pt-3">
            Sistem & Analitik
          </p>
          <button onClick={() => switchTab('laporan')} className={navClass('laporan')}>
            <span>📈</span>
            <span>Laporan & RBAC Audit</span>
          </button>
          <button onClick={() => switchTab('pengaturan')} className={navClass('pengaturan')}>
            <span>⚙️</span>
            <span>Pengaturan</span>
          </button>
          <button onClick={() => switchTab('flyer')} className={navClass('flyer')}>
            <span>🖼️</span>
            <span>Flyer Promosi</span>
          </button>
        </nav>

        {/* Sidebar Footer User Profile */}
        <div className="p-4 bg-slate-950/40 border-t border-slate-800 flex items-center space-x-3">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
            alt="User"
            className="w-10 h-10 rounded-xl object-cover border border-slate-700"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{currentUser.full_name}</p>
            <p className="text-xs text-blue-400 truncate">{currentUser.role}</p>
          </div>
          <button
            onClick={() =>
              showNotification(
                `Sesi ${currentUser.full_name} aktif (Role: ${currentUser.role})`,
                'info'
              )
            }
            className="text-emerald-400 hover:text-white p-1 rounded-lg"
            title="RBAC Terverifikasi"
          >
            🛡️
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT AREA ================= */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100">
        {/* Top Header (Persis Template Awal digiwms.html) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-20 shrink-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-slate-600 hover:text-slate-900 focus:outline-none text-xl"
            >
              ☰
            </button>
            <div className="relative max-w-md w-64 sm:w-80">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                🔍
              </span>
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => handleGlobalSearch(e.target.value)}
                placeholder="Cari barang, SKU, EPC RFID, atau lokasi..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => switchTab('rfid-gate')}
              className="hidden sm:flex items-center space-x-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <span>🚨</span>
              <span>Monitor Gate</span>
            </button>
            <button
              onClick={() => setShowQuickAddModal(true)}
              className="hidden sm:flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-md shadow-blue-600/20 transition-all"
            >
              <span>➕</span>
              <span>Tambah Barang</span>
            </button>
            <button
              onClick={() => switchTab('flyer')}
              className="hidden lg:flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition-all"
            >
              <span>🏷️</span>
              <span>Promo Rp149rb</span>
            </button>
            <button
              onClick={() =>
                showNotification(
                  `Sistem RFID Gate & EMQX Broker: ${
                    mqttConnected ? 'Terhubung Real-Time (WS 8083)' : 'Mode Simulasi Aktif'
                  }`,
                  'info'
                )
              }
              className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              <span>🔔</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            </button>
            <button
              onClick={() =>
                showNotification(
                  'Sistem terhubung ke server Backend DIGI WMS (Port 5000)',
                  'success'
                )
              }
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              title="Status Server & EMQX"
            >
              <span className={mqttConnected ? 'text-emerald-500' : 'text-blue-500'}>☁️</span>
            </button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {renderMainContent()}
        </div>
      </main>

      {/* ================= MODAL TAMBAH BARANG CEPAT DARI HEADER ================= */}
      {showQuickAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-900">Tambah Barang / SKU Baru</h3>
              <button
                onClick={() => setShowQuickAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleQuickAddItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Nama Barang
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Mechanical Keyboard RGB"
                  value={quickItem.name}
                  onChange={(e) => setQuickItem({ ...quickItem, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    placeholder="SKU-9921"
                    value={quickItem.sku}
                    onChange={(e) => setQuickItem({ ...quickItem, sku: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Kategori
                  </label>
                  <select
                    value={quickItem.category}
                    onChange={(e) => setQuickItem({ ...quickItem, category: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                  >
                    <option value="Aksesoris Komputer">Aksesoris Komputer</option>
                    <option value="Periferal Gaming">Periferal Gaming</option>
                    <option value="Kabel & Konektor">Kabel & Konektor</option>
                    <option value="Elektronik">Elektronik</option>
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
                    value={quickItem.price_idr}
                    onChange={(e) =>
                      setQuickItem({ ...quickItem, price_idr: Number(e.target.value) })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Batas Minimum Stok
                  </label>
                  <input
                    type="number"
                    required
                    value={quickItem.min_stock}
                    onChange={(e) =>
                      setQuickItem({ ...quickItem, min_stock: Number(e.target.value) })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-medium"
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

      {/* ================= TOAST NOTIFICATION (PERSIS TEMPLATE AWAL digiwms.html) ================= */}
      <div
        className={`fixed bottom-6 right-6 z-50 transform transition-all duration-300 max-w-sm ${
          toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3 border border-slate-800">
          <span>
            {toast.type === 'error' ? '🚨' : toast.type === 'info' ? 'ℹ️' : '✅'}
          </span>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      </div>
    </div>
  );
}
