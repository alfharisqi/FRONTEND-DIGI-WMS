import React, { useState, useEffect, useMemo } from 'react';
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
  ShoppingCart,
  RotateCcw,
  PanelLeft,
  Menu,
  Search,
  Plus,
  Bell,
  Activity,
  X,
  RefreshCw,
  Boxes,
} from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import { createMqttSubscription } from './config/mqttClient';
import { API_BASE_URL } from './config/api';
import { tokenStorageKey, userStorageKey } from './config/authSession';
import DashboardOverviewPage from './modules/orang4-dashboard/DashboardOverviewPage';
import LoginPage from './modules/orang4-dashboard/LoginPage';
import InboundTaggingPage from './modules/orang1-inbound/InboundTaggingPage';
import { inboundRequest, newSku } from './modules/orang1-inbound/api';
import PickingPackingPage from './modules/orang1-picking/PickingPackingPage';
import InventoryLedgerPage from './modules/orang2-inventory/InventoryLedgerPage';
import StockByRackPage from './modules/orang2-inventory/StockByRackPage';
import StockOpnamePage from './modules/orang3-opname/StockOpnamePage';
import PosPage from './modules/orang3-opname/PosPage';
import ReturnPage from './modules/orang3-opname/ReturnPage';
import GateSecurityPage from './modules/orang4-dashboard/GateSecurityPage';
import MasterBoxPage from './modules/orang4-dashboard/MasterBoxPage';
import GuidebookButton from './components/GuidebookButton';
import { startInteractiveGuidebook } from './lib/guidebook';
import { AppSidebar } from './components/layout/AppSidebar';
import { ThemeSwitch } from './components/layout/ThemeSwitch';
import { ProfileDropdown } from './components/layout/ProfileDropdown';
import { CommandMenu } from './components/layout/CommandMenu';
import { ConfigDrawer } from './components/layout/ConfigDrawer';
import { TopNav } from './components/layout/TopNav';
import { useLayout } from './context/LayoutProvider';
import { cn } from './lib/utils';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Input, Label, Separator } from './components/ui/input';

export default function App() {
  const { variant, collapsible } = useLayout();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
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

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(userStorageKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const roleUpper = String(currentUser?.role || '').toUpperCase();
  const isAdminOrSupervisor =
    roleUpper.includes('ADMIN') || roleUpper.includes('SUPERVISOR');

  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const defaultCategories = [
    'Aksesoris Komputer',
    'Periferal Gaming',
    'Kabel & Konektor',
    'Elektronik',
  ];
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickCategories, setQuickCategories] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('digiwms_custom_categories') || '[]');
      return [...new Set([...defaultCategories, ...(Array.isArray(saved) ? saved : [])])];
    } catch {
      return defaultCategories;
    }
  });
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [quickItem, setQuickItem] = useState({
    sku: '',
    name: '',
    category: 'Aksesoris Komputer',
    price_idr: 350000,
    min_stock: 20,
  });

  const handleAddQuickCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const updated = [...new Set([...quickCategories, trimmed])];
    setQuickCategories(updated);
    try {
      localStorage.setItem('digiwms_custom_categories', JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
    setQuickItem((prev) => ({ ...prev, category: trimmed }));
    setNewCategoryName('');
    setShowNewCategoryInput(false);
  };

  const showNotification = (message, type = 'success') => {
    if (type === 'error') {
      sonnerToast.error(message);
    } else if (type === 'info') {
      sonnerToast.info(message);
    } else {
      sonnerToast.success(message);
    }
  };

  useEffect(() => {
    const sub = createMqttSubscription(
      (event) => setLastEvent(event),
      (status) => setMqttConnected(status)
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
      setLastEvent({
        topic: 'digiwms/product/created',
        payload: data,
        receivedAt: new Date().toLocaleTimeString('id-ID'),
      });
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const navGroups = useMemo(() => {
    const systemItems = [
      ...(isAdminOrSupervisor
        ? [{ id: 'users', label: 'Manajemen User', icon: Users }]
        : []),
      { id: 'laporan', label: 'Laporan & Analitik', icon: BarChart3 },
      { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
      { id: 'flyer', label: 'Flyer Promosi', icon: ImageIcon },
    ];

    return [
      {
        title: 'Menu Utama',
        items: [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'penerimaan', label: 'Penerimaan', icon: Truck },
          { id: 'stok', label: 'Stok Barang', icon: Package },
          { id: 'penyimpanan', label: 'Penyimpanan Rak', icon: MapPin },
          { id: 'stok-rak', label: 'Stok per Rak', icon: Layers },
          { id: 'picking', label: 'Picking & Packing', icon: ClipboardList },
          { id: 'pengiriman', label: 'Pengiriman', icon: Send },
        ],
      },
      {
        title: 'POS & RFID Gerbang',
        items: [
          { id: 'pos', label: 'Kasir POS', icon: ShoppingCart },
          { id: 'retur', label: 'Retur POS', icon: RotateCcw },
          { id: 'rfid-tag', label: 'Tag & Encoding', icon: Tag },
          { id: 'master-box', label: 'Master Box (Karton)', icon: Boxes },
          { id: 'rfid-opname', label: 'Opname Handheld', icon: Radio },
          { id: 'rfid-gate', label: 'Gate & Alarm Live', icon: Siren },
          { id: 'gate-security', label: 'Keamanan & Pass', icon: ShieldCheck },
          { id: 'ledger', label: 'Ledger Pergerakan', icon: FileText },
        ],
      },
      {
        title: 'Sistem',
        items: systemItems,
      },
    ];
  }, [isAdminOrSupervisor]);

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

  const renderMainContent = () => {
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
      return (
        <PickingPackingPage
          searchQuery={globalSearch}
          showNotification={showNotification}
        />
      );
    }

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

    if (['rfid-opname', 'rfid-gate'].includes(activeTab)) {
      return (
        <StockOpnamePage
          activeMenu={activeTab}
          lastEvent={lastEvent}
          showNotification={showNotification}
        />
      );
    }

    if (activeTab === 'pos') {
      return <PosPage />;
    }

    if (activeTab === 'retur') {
      return <ReturnPage showNotification={showNotification} />;
    }

    if (activeTab === 'master-box') {
      return (
        <MasterBoxPage
          lastEvent={lastEvent}
          showNotification={showNotification}
        />
      );
    }

    return null;
  };

  const topNavLinks = [
    { id: 'dashboard', label: 'Overview', matchTabs: ['dashboard'] },
    {
      id: 'stok',
      label: 'Inventaris',
      matchTabs: ['penerimaan', 'stok', 'penyimpanan', 'stok-rak', 'picking', 'pengiriman'],
    },
    {
      id: 'pos',
      label: 'POS & RFID',
      matchTabs: ['pos', 'retur', 'rfid-tag', 'rfid-opname'],
    },
    {
      id: 'gate-security',
      label: 'Keamanan',
      matchTabs: ['rfid-gate', 'gate-security', 'ledger'],
    },
    {
      id: 'pengaturan',
      label: 'Pengaturan',
      matchTabs: ['users', 'laporan', 'pengaturan', 'flyer'],
    },
  ];

  return (
    <div
      className={cn(
        'flex h-screen w-full font-sans text-foreground antialiased overflow-hidden',
        variant === 'inset' ? 'bg-muted/40 dark:bg-sidebar' : 'bg-background'
      )}
    >
      {/* ================= SHADCN ADMIN SIDEBAR ================= */}
      <AppSidebar
        navGroups={navGroups}
        activeTab={activeTab}
        onSelectTab={switchTab}
        sidebarOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        sidebarCollapsed={sidebarCollapsed}
        variant={variant}
        collapsible={collapsible}
        currentUser={currentUser}
        onOpenGuidebook={() => {
          setSidebarOpen(false);
          setTimeout(() => startInteractiveGuidebook(activeTab), 150);
        }}
        onOpenHealth={openHealthCheckModal}
        onLogout={handleLogout}
      />

      {/* ================= SHADCN ADMIN SIDEBAR INSET CONTENT ================= */}
      <div
        className={cn(
          'flex flex-1 flex-col min-w-0 overflow-hidden bg-background transition-all',
          variant === 'inset' &&
            'md:m-2 md:ml-0 md:rounded-xl md:border md:shadow-sm'
        )}
      >
        {/* Sticky Shadcn Admin Header (SidebarTrigger + TopNav + Search + ThemeSwitch + ConfigDrawer + Profile) */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Menu Button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden h-8 w-8"
              title="Buka Menu"
            >
              <Menu className="h-4 w-4" />
            </Button>

            {/* Desktop Sidebar Trigger */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleSidebarCollapse}
              className="hidden md:inline-flex h-8 w-8"
              title={sidebarCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-6" />

            {/* Exact Shadcn Admin TopNav */}
            <TopNav
              links={topNavLinks}
              activeTab={activeTab}
              onSelectTab={switchTab}
            />
          </div>

          <div
            data-tour="header-quick-actions"
            className="flex items-center gap-1.5 sm:gap-2 shrink-0"
          >
            {/* Exact Shadcn Admin Search Pill (⌘K) */}
            <div data-tour="global-search" className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCommandOpen(true)}
                className="relative h-8 w-36 justify-start rounded-md bg-muted/25 text-sm font-normal text-muted-foreground shadow-none hover:bg-accent sm:w-44 md:w-52 lg:w-60 pr-12"
              >
                <Search className="h-3.5 w-3.5 mr-2 shrink-0" />
                <span className="truncate text-xs">Search...</span>
                <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
                  <span>⌘</span>K
                </kbd>
              </Button>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => setShowQuickAddModal(true)}
              className="hidden xl:inline-flex h-8 text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah SKU</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => switchTab('rfid-gate')}
              className="relative rounded-full"
              title="Monitor Gate & Alarm Live"
            >
              <Siren className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
            </Button>

            <ThemeSwitch />

            <ConfigDrawer />

            <ProfileDropdown
              currentUser={currentUser}
              onNavigate={switchTab}
              onOpenHealth={openHealthCheckModal}
              onOpenGuidebook={() => startInteractiveGuidebook(activeTab)}
              onLogout={handleLogout}
            />
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main
          data-tour="main-content-area"
          className="shadcn-module-scope flex-1 overflow-y-auto px-4 py-6 sm:px-6 custom-scrollbar"
        >
          <div className="mx-auto w-full max-w-7xl">{renderMainContent()}</div>
        </main>
      </div>

      {/* ================= SHADCN COMMAND MENU (⌘K) ================= */}
      <CommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        navGroups={navGroups}
        onSelectTab={switchTab}
      />

      {/* ================= DIALOG DIAGNOSTIK KESEHATAN SERVER & EMQX ================= */}
      {showHealthModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-in fade-in-0"
          onClick={() => setShowHealthModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border bg-card text-card-foreground p-6 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <Badge variant="success" className="mb-1.5">
                  Infrastructure Monitor — Orang 4
                </Badge>
                <h3 className="text-lg font-semibold tracking-tight">
                  Status Kesehatan Server, DB & EMQX
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Diagnostik real-time koneksi backend API, PostgreSQL, dan broker MQTT.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowHealthModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {loadingHealth || !healthData ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Memeriksa koneksi ke Backend API (Port 5000)...
              </div>
            ) : (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
                  <span className="text-muted-foreground">
                    Status Backend API (Port 5000)
                  </span>
                  <Badge
                    variant={
                      healthData.status === 'OFFLINE' ? 'destructive' : 'success'
                    }
                  >
                    {healthData.status} · Uptime {healthData.uptime_seconds || 0}s
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
                  <span className="text-muted-foreground">
                    Engine Database & Ledger
                  </span>
                  <span className="font-mono font-medium">
                    {healthData.database_mode || '-'}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
                  <span className="text-muted-foreground">
                    Broker EMQX MQTT (1883 / 8083)
                  </span>
                  <span className="font-mono font-medium">
                    {healthData.emqx_mqtt || '-'}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
                  <span className="text-muted-foreground">
                    Spektrum Frekuensi UHF RFID
                  </span>
                  <span className="font-mono font-medium">
                    {healthData.rfid_freq || '-'}
                  </span>
                </div>

                {healthData.stats && (
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    <div className="rounded-lg border bg-background p-2.5 text-center">
                      <span className="text-[10px] text-muted-foreground block">
                        Akun RBAC
                      </span>
                      <span className="text-base font-bold">
                        {healthData.stats.total_users}
                      </span>
                    </div>
                    <div className="rounded-lg border bg-background p-2.5 text-center">
                      <span className="text-[10px] text-muted-foreground block">
                        Master SKU
                      </span>
                      <span className="text-base font-bold">
                        {healthData.stats.total_skus}
                      </span>
                    </div>
                    <div className="rounded-lg border bg-background p-2.5 text-center">
                      <span className="text-[10px] text-muted-foreground block">
                        Tag RFID
                      </span>
                      <span className="text-base font-bold">
                        {healthData.stats.total_tags}
                      </span>
                    </div>
                    <div className="rounded-lg border bg-background p-2.5 text-center">
                      <span className="text-[10px] text-muted-foreground block">
                        Audit Logs
                      </span>
                      <span className="text-base font-bold">
                        {healthData.stats.total_audit_logs}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between border-t pt-4">
              <Button
                type="button"
                size="sm"
                onClick={fetchServerHealth}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh Diagnostik
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowHealthModal(false)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DIALOG TAMBAH BARANG CEPAT ================= */}
      {showQuickAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-in fade-in-0"
          onClick={() => setShowQuickAddModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border bg-card text-card-foreground p-6 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">
                  Tambah Barang / SKU Baru
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tambahkan master produk baru langsung ke katalog DIGI WMS.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowQuickAddModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleQuickAddItem} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nama Barang</Label>
                <Input
                  required
                  placeholder="Contoh: Mechanical Keyboard RGB"
                  value={quickItem.name}
                  onChange={(e) =>
                    setQuickItem({ ...quickItem, name: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>SKU / Kode Barang</Label>
                  <div className="flex gap-2">
                    <Input
                      required
                      placeholder="SKU-AKS-9921"
                      value={quickItem.sku}
                      onChange={(e) =>
                        setQuickItem({ ...quickItem, sku: e.target.value.toUpperCase() })
                      }
                      className="font-mono min-w-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setQuickItem((prev) => ({
                          ...prev,
                          sku: newSku(prev.category, prev.name),
                        }))
                      }
                      className="h-9 shrink-0"
                    >
                      Generate
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Kategori</Label>
                    <button
                      type="button"
                      onClick={() => setShowNewCategoryInput((prev) => !prev)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {showNewCategoryInput ? 'Batal' : '+ Tambah Kategori'}
                    </button>
                  </div>
                  {showNewCategoryInput ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Kategori baru..."
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddQuickCategory();
                          }
                        }}
                        className="min-w-0"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddQuickCategory}
                        className="h-9 shrink-0"
                      >
                        Tambah
                      </Button>
                    </div>
                  ) : (
                    <select
                      value={quickItem.category}
                      onChange={(e) =>
                        setQuickItem({ ...quickItem, category: e.target.value })
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {quickCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Harga Satuan (Rp)</Label>
                  <Input
                    type="number"
                    required
                    value={quickItem.price_idr}
                    onChange={(e) =>
                      setQuickItem({
                        ...quickItem,
                        price_idr: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Batas Minimum Stok</Label>
                  <Input
                    type="number"
                    required
                    value={quickItem.min_stock}
                    onChange={(e) =>
                      setQuickItem({
                        ...quickItem,
                        min_stock: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowQuickAddModal(false)}
                >
                  Batal
                </Button>
                <Button type="submit">Simpan Barang</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
