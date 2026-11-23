import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Truck,
  Package,
  MapPin,
  Layers,
  ClipboardList,
  Send,
  Tag,
  Radio,
  Siren,
  FileText,
  ShieldCheck,
  Users,
  BarChart3,
  Settings,
  Image as ImageIcon,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Search,
  Plus,
  Bell,
  Activity,
  LogOut,
  Box,
} from 'lucide-react';
import { createMqttSubscription } from './config/mqttClient';
import { API_BASE_URL } from './config/api';
import { tokenStorageKey, userStorageKey } from './config/authSession';
import DashboardOverviewPage from './modules/orang4-dashboard/DashboardOverviewPage';
import LoginPage from './modules/orang4-dashboard/LoginPage';
import InboundTaggingPage from './modules/orang1-inbound/InboundTaggingPage';
import { inboundRequest } from './modules/orang1-inbound/api';
import PickingPackingPage from './modules/orang1-picking/PickingPackingPage';
import InventoryLedgerPage from './modules/orang2-inventory/InventoryLedgerPage';
import StockByRackPage from './modules/orang2-inventory/StockByRackPage';
import StockOpnamePage from './modules/orang3-opname/StockOpnamePage';
import GateSecurityPage from './modules/orang4-dashboard/GateSecurityPage';
import GuidebookButton from './components/GuidebookButton';
import { startInteractiveGuidebook } from './lib/guidebook';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('digiwms_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mqttConnected, setMqttConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('digiwms_sidebar_collapsed', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // State User Aktif (RBAC Auth — dikelola oleh Orang 4 via Halaman Login Resmi)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(userStorageKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Guard Hak Akses RBAC: Khusus ADMIN & SUPERVISOR
  const roleUpper = String(currentUser?.role || '').toUpperCase();
  const isAdminOrSupervisor =
    roleUpper.includes('ADMIN') || roleUpper.includes('SUPERVISOR');

  // Modal Health Check Diagnostik Server & Infrastruktur (Orang 4)
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

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

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser?.username,
          full_name: currentUser?.full_name,
          role: currentUser?.role,
        }),
      });
    } catch {
      // Abaikan jika offline
    }

    localStorage.removeItem(userStorageKey);
    localStorage.removeItem(tokenStorageKey);
    setCurrentUser(null);
  };

  const fetchServerHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      const json = await res.json();
      setHealthData(json);
    } catch {
      setHealthData({
        status: 'OFFLINE',
        service: 'DIGI WMS Backend API (Tidak Terjangkau)',
      });
    } finally {
      setLoadingHealth(false);
    }
  };

  const openHealthCheckModal = () => {
    setShowHealthModal(true);
    fetchServerHealth();
  };

  // Proteksi otomatis: jika tab aktif adalah 'users' tapi user bukan Admin/Supervisor, kembalikan ke dashboard
  useEffect(() => {
    if (activeTab === 'users' && !isAdminOrSupervisor) {
      setActiveTab('dashboard');
    }
  }, [currentUser, activeTab, isAdminOrSupervisor]);

  const switchTab = (tabId) => {
    if (tabId === 'users' && !isAdminOrSupervisor) {
      showNotification(
        'Akses Terbatas: Menu Manajemen User hanya untuk Admin / Supervisor',
        'error'
      );
      return;
    }

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
      const data = await inboundRequest('/products', 'POST', quickItem);
      showNotification('Barang berhasil ditambahkan!', 'success');
      setShowQuickAddModal(false);
      setQuickItem({
        sku: '',
        name: '',
        category: 'Aksesoris Komputer',
        price_idr: 350000,
        min_stock: 20,
      });
      setLastEvent({ topic: 'digiwms/product/created', payload: data, receivedAt: new Date().toLocaleTimeString('id-ID') });
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  // Jika belum login, tampilkan Halaman Login Resmi (Orang 4)
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(loggedUser) => {
          setCurrentUser(loggedUser);
          showNotification(
            `Selamat datang, ${loggedUser.full_name} (${loggedUser.role})`,
            'success'
          );
        }}
      />
    );
  }

  const navClass = (tabId) =>
    `nav-item group flex items-center ${
      sidebarCollapsed ? 'md:justify-center md:px-0 px-3' : 'gap-2.5 px-3'
    } py-2 rounded-lg text-[13px] font-medium transition-colors w-full text-left ${
      activeTab === tabId
        ? 'bg-blue-600 text-white shadow-sm'
        : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
    }`;

  const renderNavItem = (tabId, Icon, label) => (
    <button
      key={tabId}
      type="button"
      onClick={() => switchTab(tabId)}
      className={navClass(tabId)}
      title={sidebarCollapsed ? label : undefined}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
      <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>{label}</span>
    </button>
  );

  const renderSectionLabel = (label) =>
    sidebarCollapsed ? (
      <div className="hidden md:block my-2.5 border-t border-slate-800/80 mx-2" />
    ) : (
      <p className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
        {label}
      </p>
    );

  // Pemetaan Menu Template Awal digiwms.html -> 4 Modul Tim (Tanpa Konflik Git)
  const renderMainContent = () => {
    // 1. Modul Orang 4 (Dashboard, Manajemen User RBAC, Laporan Analitik, Pengaturan, Flyer)
    if (['dashboard', 'users', 'laporan', 'pengaturan', 'flyer'].includes(activeTab)) {
      return (
        <DashboardOverviewPage
          activeMenu={activeTab}
          switchTab={switchTab}
          openAddProductModal={() => setShowQuickAddModal(true)}
          lastEvent={lastEvent}
          mqttConnected={mqttConnected}
          currentUser={currentUser}
          showNotification={showNotification}
        />
      );
    }

    // Modul Orang 4 - Fase 2: Gate Pass Security Engine & Outbound Gate
    if (['gate-security', 'gate-pass'].includes(activeTab)) {
      return (
        <GateSecurityPage
          switchTab={switchTab}
          lastEvent={lastEvent}
          mqttConnected={mqttConnected}
          currentUser={currentUser}
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

    // Inventaris Stok per Rak (Orang 2)
    if (['stok-rak', 'inventaris'].includes(activeTab)) {
      return (
        <StockByRackPage
          lastEvent={lastEvent}
          searchQuery={globalSearch}
          mqttConnected={mqttConnected}
          showNotification={showNotification}
        />
      );
    }

    if (activeTab === 'picking') {
      return <PickingPackingPage searchQuery={globalSearch} showNotification={showNotification} />;
    }

    // 3. Modul Orang 2 (Penyimpanan Rak, Pengiriman Outbound, Ledger Pergerakan)
    if (['penyimpanan', 'pengiriman', 'ledger'].includes(activeTab)) {
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
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-800 antialiased overflow-hidden">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-20 md:hidden"
        />
      )}

      {/* ================= SIDEBAR NAVIGATION (SIMPLE & COLLAPSIBLE) ================= */}
      <aside
        className={`bg-slate-900 text-slate-300 flex flex-col transition-all duration-200 z-30 shrink-0 md:relative fixed inset-y-0 left-0 border-r border-slate-800 ${
          sidebarCollapsed ? 'w-64 md:w-[70px]' : 'w-64 md:w-60'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Logo Brand & Collapse Button */}
        <div
          className={`h-14 flex items-center border-b border-slate-800 shrink-0 ${
            sidebarCollapsed ? 'justify-between md:justify-center px-4 md:px-2' : 'justify-between px-4'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white shrink-0">
              <Box className="w-4 h-4" strokeWidth={2} />
            </div>
            <div className={`min-w-0 ${sidebarCollapsed ? 'md:hidden' : ''}`}>
              <span className="font-bold text-sm text-white tracking-wide block leading-tight">
                DIGI WMS
              </span>
              <span className="block text-[10px] text-slate-400 truncate">
                RFID Warehouse & POS
              </span>
            </div>
          </div>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Minimize Sidebar"
            >
              <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Tutup Menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav
          data-tour="sidebar-nav"
          className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto custom-scrollbar"
        >
          {/* Operasional Utama */}
          {!sidebarCollapsed && (
            <p className="px-3 pb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              Menu Utama
            </p>
          )}

          {renderNavItem('dashboard', LayoutDashboard, 'Dashboard')}
          {renderNavItem('penerimaan', Truck, 'Penerimaan')}
          {renderNavItem('stok', Package, 'Stok Barang')}
          {renderNavItem('penyimpanan', MapPin, 'Penyimpanan Rak')}
          {renderNavItem('stok-rak', Layers, 'Stok per Rak')}
          {renderNavItem('picking', ClipboardList, 'Picking & Packing')}
          {renderNavItem('pengiriman', Send, 'Pengiriman')}

          {/* RFID & Keamanan Core */}
          {renderSectionLabel('RFID & Gerbang')}

          {renderNavItem('rfid-tag', Tag, 'Tag & Encoding')}
          {renderNavItem('rfid-opname', Radio, 'Opname Handheld')}
          {renderNavItem('rfid-gate', Siren, 'Gate & Alarm Live')}
          {renderNavItem('gate-security', ShieldCheck, 'Keamanan & Pass')}
          {renderNavItem('ledger', FileText, 'Ledger Pergerakan')}

          {/* Sistem & Analitik */}
          {renderSectionLabel('Sistem')}

          {isAdminOrSupervisor && renderNavItem('users', Users, 'Manajemen User')}
          {renderNavItem('laporan', BarChart3, 'Laporan & Analitik')}
          {renderNavItem('pengaturan', Settings, 'Pengaturan')}
          {renderNavItem('flyer', ImageIcon, 'Flyer Promosi')}

          <div className="pt-2 mt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                setTimeout(() => startInteractiveGuidebook(activeTab), 150);
              }}
              title={sidebarCollapsed ? 'Panduan Aplikasi' : undefined}
              className={`nav-item flex items-center ${
                sidebarCollapsed ? 'md:justify-center md:px-0 px-3' : 'gap-2.5 px-3'
              } py-2 rounded-lg text-[13px] font-medium transition-colors w-full text-left text-slate-400 hover:bg-slate-800/80 hover:text-white`}
            >
              <BookOpen className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>
                Panduan Aplikasi
              </span>
            </button>
          </div>
        </nav>

        {/* Sidebar Footer User Profile + Logout */}
        <div
          data-tour="sidebar-user-profile"
          className={`p-3 bg-slate-950/40 border-t border-slate-800 flex items-center ${
            sidebarCollapsed ? 'md:flex-col md:gap-2 justify-between gap-2.5' : 'gap-2.5'
          }`}
        >
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
            alt="User"
            title={`${currentUser.full_name} (${currentUser.role})`}
            className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0"
          />
          <div className={`flex-1 min-w-0 ${sidebarCollapsed ? 'md:hidden' : ''}`}>
            <p className="text-xs font-semibold text-white truncate">{currentUser.full_name}</p>
            <p className="text-[10px] text-slate-400 truncate font-mono">{currentUser.role}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition shrink-0"
            title="Keluar (Logout)"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT AREA ================= */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Top Header (Simple & Clean) */}
        <header className="h-14 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 z-20 shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Mobile Drawer Toggle */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" strokeWidth={1.75} />
            </button>

            {/* Desktop Sidebar Maximize/Minimize Toggle */}
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="hidden md:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              title={sidebarCollapsed ? 'Maximize Sidebar' : 'Minimize Sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-[18px] h-[18px]" strokeWidth={1.75} />
              ) : (
                <PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.75} />
              )}
            </button>

            <div data-tour="global-search" className="relative w-52 sm:w-72">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                strokeWidth={1.75}
              />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => handleGlobalSearch(e.target.value)}
                placeholder="Cari SKU, barang, EPC, lokasi..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          <div
            data-tour="header-quick-actions"
            className="flex items-center gap-1.5 sm:gap-2"
          >
            <GuidebookButton activeTab={activeTab} />

            <button
              type="button"
              onClick={() => setShowQuickAddModal(true)}
              className="hidden sm:flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Tambah Barang</span>
            </button>

            <button
              type="button"
              onClick={() => switchTab('rfid-gate')}
              className="relative p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="Monitor Gate & Alarm Live"
            >
              <Siren className="w-[18px] h-[18px]" strokeWidth={1.75} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full" />
            </button>

            <button
              type="button"
              onClick={() =>
                showNotification(
                  `Sistem RFID Gate & EMQX Broker: ${
                    mqttConnected ? 'Terhubung Real-Time (WS 8083)' : 'Mode Simulasi Aktif'
                  }`,
                  'info'
                )
              }
              className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              title="Status Notifikasi & EMQX"
            >
              <Bell className="w-[18px] h-[18px]" strokeWidth={1.75} />
              {mqttConnected && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={openHealthCheckModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition"
              title="Diagnostik Server, Database & EMQX"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
              <span className="hidden sm:inline">Server</span>
            </button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div
          data-tour="main-content-area"
          className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar"
        >
          {renderMainContent()}
        </div>
      </main>

      {/* ================= MODAL DIAGNOSTIK KESEHATAN SERVER & EMQX (ORANG 4) ================= */}
      {showHealthModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Infrastructure Monitor — Orang 4
                </span>
                <h3 className="font-bold text-lg text-white mt-1">
                  Status Kesehatan Server, DB & EMQX
                </h3>
              </div>
              <button
                onClick={() => setShowHealthModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {loadingHealth || !healthData ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                Memeriksa koneksi ke Backend API (Port 5000)...
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 flex justify-between items-center">
                  <span className="text-slate-400">Status Backend API (Port 5000)</span>
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                    {healthData.status} • Uptime {healthData.uptime_seconds || 0}s
                  </span>
                </div>

                <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 flex justify-between items-center">
                  <span className="text-slate-400">Engine Database & Ledger</span>
                  <span className="font-mono font-semibold text-blue-300">
                    {healthData.database_mode}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 flex justify-between items-center">
                  <span className="text-slate-400">Broker EMQX MQTT (1883 / 8083)</span>
                  <span className="font-mono font-semibold text-amber-300">
                    {healthData.emqx_mqtt}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 flex justify-between items-center">
                  <span className="text-slate-400">Spektrum Frekuensi UHF RFID</span>
                  <span className="font-mono text-slate-200">{healthData.rfid_freq}</span>
                </div>

                {healthData.stats && (
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    <div className="bg-slate-950 p-2.5 rounded-xl text-center border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Akun RBAC</span>
                      <span className="text-base font-bold text-white">
                        {healthData.stats.total_users}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-xl text-center border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Master SKU</span>
                      <span className="text-base font-bold text-blue-400">
                        {healthData.stats.total_skus}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-xl text-center border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Tag RFID</span>
                      <span className="text-base font-bold text-cyan-400">
                        {healthData.stats.total_tags}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-xl text-center border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Audit Logs</span>
                      <span className="text-base font-bold text-emerald-400">
                        {healthData.stats.total_audit_logs}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-slate-800 flex justify-between items-center">
              <button
                onClick={fetchServerHealth}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
              >
                🔄 Refresh Diagnostik
              </button>
              <button
                onClick={() => setShowHealthModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

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
