import React, { useEffect, useState } from 'react';
import {
  Download,
  ScanLine,
  Package,
  Truck,
  Tag,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  ArrowUpRight,
  Plus,
  TrendingUp,
  CheckCircle2,
  Clock,
  BarChart3,
  Printer,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { API_BASE_URL } from '../../config/api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/data-table';

export default function DashboardOverviewPage({
  activeMenu = 'dashboard',
  switchTab,
  openAddProductModal,
  lastEvent,
  mqttConnected,
  currentUser,
  showNotification,
}) {
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [chartPeriod, setChartPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);

  // State Manajemen User (RBAC) & Audit Logs
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditRoleFilter, setAuditRoleFilter] = useState('ALL');

  // Modal Tambah User Baru
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '123456',
    full_name: '',
    role: 'WAREHOUSE_STAFF',
  });
  const [savingUser, setSavingUser] = useState(false);

  // Modal Edit User / Reset Password
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    full_name: '',
    role: 'WAREHOUSE_STAFF',
    password: '',
  });

  // State Pengaturan Gudang & RFID
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // State Test Publish MQTT
  const [testTopic, setTestTopic] = useState('digiwms/rfid/gate-alarm');
  const [testEpc, setTestEpc] = useState('E280689400005001A1B2C399');

  // Cek apakah user aktif memiliki hak akses Admin / Supervisor (RBAC Guard)
  const roleUpper = String(currentUser?.role || '').toUpperCase();
  const isAdminOrSupervisor =
    roleUpper.includes('ADMIN') || roleUpper.includes('SUPERVISOR');

  const fetchSummaryAndProducts = async () => {
    try {
      const [sumRes, prodRes, stockRes] = await Promise.all([
        fetch(`${API_BASE_URL}/dashboard/summary`),
        fetch(`${API_BASE_URL}/products`),
        fetch(`${API_BASE_URL}/inventory/stock`).catch(() => null),
      ]);
      const sumJson = await sumRes.json();
      const prodJson = await prodRes.json();
      const stockJson = stockRes && stockRes.ok ? await stockRes.json().catch(() => null) : null;

      const ledgerMap = new Map();
      if (Array.isArray(stockJson?.data)) {
        stockJson.data.forEach((row) => {
          ledgerMap.set(row.sku, row);
        });
      }

      const mergedProducts = (prodJson.data || []).map((p) => {
        const s = ledgerMap.get(p.sku);
        return {
          ...p,
          current_stock: s ? Number(s.current_stock ?? 0) : Number(p.current_stock ?? 0),
          in_rack_stock: s ? Number(s.in_rack_stock ?? 0) : Number(p.current_stock ?? 0),
          staging_stock: s ? Number(s.staging_stock ?? 0) : 0,
          reserved_stock: s ? Number(s.reserved_stock ?? 0) : 0,
          stock_status: s?.stock_status,
          min_stock: Number(p.min_stock ?? p.min_stock_threshold ?? p.min_stock_alert ?? 20),
        };
      });

      setSummary(sumJson.data);
      setProducts(mergedProducts);
    } catch (err) {
      console.error('Gagal mengambil ringkasan dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersAndLogs = async (roleFilter = auditRoleFilter) => {
    try {
      const [usersRes, logsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users`),
        fetch(`${API_BASE_URL}/audit-logs?role=${roleFilter}`),
      ]);
      const usersJson = await usersRes.json();
      const logsJson = await logsRes.json();
      setUsers(usersJson.data || []);
      setAuditLogs(logsJson.data || []);
    } catch (err) {
      console.error('Gagal mengambil data RBAC & Audit Log:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/settings`);
      const json = await res.json();
      setSettings(json.data);
    } catch (err) {
      console.error('Gagal mengambil pengaturan sistem:', err);
    }
  };

  useEffect(() => {
    fetchSummaryAndProducts();
    fetchUsersAndLogs();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (lastEvent) {
      fetchSummaryAndProducts();
      fetchUsersAndLogs();
    }
  }, [lastEvent]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!isAdminOrSupervisor) {
      showNotification?.(
        'Akses Ditolak (RBAC Guard): Hanya ADMIN atau SUPERVISOR yang dapat menambah personel!',
        'error'
      );
      return;
    }
    if (!newUserForm.username || !newUserForm.full_name) return;
    setSavingUser(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserForm),
      });
      const json = await res.json();
      if (res.ok) {
        showNotification?.(json.message || 'Personel baru berhasil didaftarkan!', 'success');
        setNewUserForm({
          username: '',
          password: '123456',
          full_name: '',
          role: 'WAREHOUSE_STAFF',
        });
        setShowAddUserModal(false);
        fetchUsersAndLogs();
      } else {
        showNotification?.(json.message || 'Gagal menambah user', 'error');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingUser(false);
    }
  };

  const openEditModal = (u) => {
    if (!isAdminOrSupervisor) {
      showNotification?.(
        'Akses Ditolak (RBAC Guard): Hanya ADMIN/SUPERVISOR yang dapat mengedit personel!',
        'error'
      );
      return;
    }
    setEditingUser(u);
    setEditUserForm({
      full_name: u.full_name,
      role: u.role,
      password: '',
    });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editUserForm),
      });
      const json = await res.json();
      if (res.ok) {
        showNotification?.(json.message || 'Data personel berhasil diperbarui!', 'success');
        setEditingUser(null);
        fetchUsersAndLogs();
      } else {
        showNotification?.(json.message || 'Gagal memperbarui personel', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleUserStatus = async (userId) => {
    if (!isAdminOrSupervisor) {
      showNotification?.(
        'Akses Ditolak (RBAC Guard): Hanya ADMIN/SUPERVISOR yang dapat mengubah status akun!',
        'error'
      );
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}/toggle`, {
        method: 'PATCH',
      });
      if (res.ok) {
        showNotification?.('Status aktif personel berhasil diperbarui', 'info');
        fetchUsersAndLogs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (u) => {
    if (!isAdminOrSupervisor) {
      showNotification?.(
        'Akses Ditolak (RBAC Guard): Hanya ADMIN/SUPERVISOR yang dapat menghapus personel!',
        'error'
      );
      return;
    }
    if (u.username === currentUser?.username) {
      showNotification?.('Tidak dapat menghapus akun yang sedang digunakan login!', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/users/${u.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok) {
        showNotification?.(json.message || `Akun @${u.username} dihapus`, 'info');
        fetchUsersAndLogs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!isAdminOrSupervisor) {
      showNotification?.(
        'Akses Ditolak (RBAC Guard): Role Anda tidak diizinkan mengubah konfigurasi sistem RFID!',
        'error'
      );
      return;
    }
    if (!settings) return;
    setSavingSettings(true);
    try {
      const res = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          updated_by: currentUser?.full_name || currentUser?.username || 'admin_wms',
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setSettings(json.data);
        showNotification?.('Pengaturan WMS & RFID berhasil disimpan', 'success');
        fetchUsersAndLogs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestMqttPublish = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_BASE_URL}/mqtt/test-publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: testTopic,
          payload: {
            epc_code: testEpc,
            gate_id: 'GATE-EXIT-01',
            rssi: -46,
            operator: currentUser?.full_name || 'admin_wms',
            note: 'Simulasi Pancaran Antena UHF RFID',
          },
        }),
      });
      showNotification?.(`Paket MQTT dikirim ke topik ${testTopic}`, 'info');
      fetchUsersAndLogs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadCsvReport = () => {
    const lines = [];
    lines.push('=== LAPORAN ANALITIK INVENTARIS & AUDIT KEAMANAN DIGI WMS ===');
    lines.push(`Tanggal Unduh,${new Date().toLocaleString('id-ID')}`);
    lines.push(`Dicetak Oleh,${currentUser?.full_name} (${currentUser?.role})`);
    lines.push('');
    lines.push('--- DAFTAR STOK PRODUK GUDANG (KONSISTENSI RAK & LEDGER) ---');
    lines.push('SKU,Nama Barang,Kategori,Siap di Rak,Staging,Saldo Ledger,Batas Minimum,Status');
    products.forEach((p) => {
      const rackQty = Number(p.in_rack_stock ?? p.current_stock ?? 0);
      const isLow = p.stock_status ? p.stock_status === 'STOK_RENDAH' : rackQty <= Number(p.min_stock || 15);
      lines.push(
        `"${p.sku}","${p.name}","${p.category}",${rackQty},${Number(p.staging_stock || 0)},${p.current_stock},${p.min_stock || 15},"${
          isLow ? 'STOK RENDAH' : 'AMAN'
        }"`
      );
    });
    lines.push('');
    lines.push('--- RIWAYAT AUDIT LOG KEAMANAN SISTEM (RBAC) ---');
    lines.push('ID,Waktu,Pengguna,Role,Aksi,Detail Aktivitas');
    auditLogs.forEach((log) => {
      lines.push(
        `${log.id},"${new Date(log.created_at).toLocaleString('id-ID')}","${
          log.actor_username
        }","${log.actor_role}","${log.action}","${String(log.details).replace(/"/g, '""')}"`
      );
    });

    const csvContent = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Laporan_Analitik_Audit_DIGI_WMS_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification?.('File CSV Laporan Analitik & Audit berhasil diunduh!', 'success');
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Memuat data sistem DIGI WMS...</div>;
  }

  const kpis = summary?.kpis || {
    totalSkus: 0,
    totalPhysicalStock: 0,
    activeRfidTags: 0,
    gateAlarmsCount: 0,
  };

  const chartSeries =
    chartPeriod === '7d'
      ? summary?.chartData?.days7 || []
      : summary?.chartData?.days30 || [];

  const maxChartVal = Math.max(
    60,
    ...chartSeries.map((d) => Math.max(d.inbound || 0, d.outbound || 0, d.opname || 0))
  );

  const lowStockItems = products.filter((p) =>
    p.stock_status
      ? p.stock_status === 'STOK_RENDAH'
      : Number(p.in_rack_stock ?? p.current_stock) <= Number(p.min_stock || 20)
  );

  // ============================================================================
  // MENU 1: DASHBOARD UTAMA (Tampilan Simpel, Bersih & Profesional)
  // ============================================================================
  if (activeMenu === 'dashboard') {
    const rechartsData =
      chartSeries.length > 0
        ? chartSeries.map((d) => ({
            name: d.label,
            inbound: Number(d.inbound || 0),
            outbound: Number(d.outbound || 0),
            opname: Number(d.opname || 0),
            total:
              Number(d.inbound || 0) +
              Number(d.outbound || 0) +
              Number(d.opname || 0),
          }))
        : [
            { name: 'Sen', inbound: 24, outbound: 12, opname: 8, total: 44 },
            { name: 'Sel', inbound: 32, outbound: 18, opname: 14, total: 64 },
            { name: 'Rab', inbound: 18, outbound: 15, opname: 10, total: 43 },
            { name: 'Kam', inbound: 45, outbound: 22, opname: 16, total: 83 },
            { name: 'Jum', inbound: 29, outbound: 20, opname: 12, total: 61 },
            { name: 'Sab', inbound: 38, outbound: 26, opname: 15, total: 79 },
            { name: 'Min', inbound: 15, outbound: 9, opname: 6, total: 30 },
          ];

    return (
      <div className="space-y-4">
        {/* Exact Shadcn Admin Dashboard Heading */}
        <div
          data-tour="dashboard-header"
          className="mb-2 flex flex-wrap items-center justify-between gap-2"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => switchTab?.('rfid-opname')}
            >
              <ScanLine className="h-4 w-4" />
              Opname Cepat
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDownloadCsvReport}
              title="Unduh Rekap Format CSV"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>

        {/* Exact Shadcn Admin Dashboard Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <div className="w-full overflow-x-auto pb-1">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="low-stock">
                Stok Kritis ({lowStockItems.length})
              </TabsTrigger>
              <TabsTrigger value="gate">Keamanan Gerbang</TabsTrigger>
            </TabsList>
          </div>

          {/* ===== TAB 1: OVERVIEW (1-to-1 shadcn-admin layout) ===== */}
          <TabsContent value="overview" className="space-y-4">
            {/* 4-Column KPI Row */}
            <div
              data-tour="dashboard-kpi-cards"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Stok Siap di Rak
                  </CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {kpis.totalInRackStock ?? kpis.totalPhysicalStock}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {kpis.totalSkus} SKU · {kpis.totalStagingStock ?? 0} staging · Ledger: {kpis.totalLedgerStock ?? kpis.totalPhysicalStock}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Penerimaan (GRN)
                  </CardTitle>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    +{kpis.totalInbound ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Unit masuk terverifikasi dari PO
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Tag RFID Aktif
                  </CardTitle>
                  <Tag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    +{kpis.activeRfidTags ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    UHF 920–923 MHz · {mqttConnected ? 'EMQX Live' : 'Standby'}
                  </p>
                </CardContent>
              </Card>

              <Card
                onClick={() => switchTab?.('gate-security')}
                className="cursor-pointer transition-colors hover:border-primary/50"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Gate Pass & Keamanan
                  </CardTitle>
                  {(kpis.gateAlarmsCount || 0) > 0 ? (
                    <ShieldAlert className="h-4 w-4 text-destructive" />
                  ) : (
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {kpis.activeGatePasses ?? 0}{' '}
                    <span className="text-xs font-medium text-muted-foreground">
                      izin aktif
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(kpis.gateAlarmsCount || 0) > 0
                      ? `${kpis.gateAlarmsCount} alarm aktif · Cek Pos`
                      : 'Portal aman · 0 alarm aktif'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 7-Column Bento: Overview BarChart (4 cols) + Recent Activity (3 cols) */}
            <div
              data-tour="dashboard-analytics-grid"
              className="grid grid-cols-1 gap-4 lg:grid-cols-7"
            >
              <Card className="col-span-1 lg:col-span-4">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>Overview</CardTitle>
                    <CardDescription>
                      Total pergerakan stok ({chartPeriod === '7d' ? '7 hari' : '30 hari'} terakhir)
                    </CardDescription>
                  </div>
                  <div className="inline-flex rounded-md bg-muted p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setChartPeriod('7d')}
                      className={`rounded-sm px-2.5 py-1 font-medium transition ${
                        chartPeriod === '7d'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      7 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartPeriod('30d')}
                      className={`rounded-sm px-2.5 py-1 font-medium transition ${
                        chartPeriod === '30d'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      30 Hari
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="ps-2">
                  <ResponsiveContainer width="100%" height={330}>
                    <BarChart data={rechartsData}>
                      <XAxis
                        dataKey="name"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '0.5rem',
                          fontSize: '12px',
                          color: 'hsl(var(--popover-foreground))',
                        }}
                      />
                      <Bar
                        dataKey="total"
                        name="Total Mutasi"
                        fill="currentColor"
                        radius={[4, 4, 0, 0]}
                        className="fill-primary"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="col-span-1 lg:col-span-3 flex flex-col">
                <CardHeader>
                  <CardTitle>Aktivitas Terbaru</CardTitle>
                  <CardDescription>
                    {auditLogs.length > 0
                      ? `${auditLogs.length} catatan audit & mutasi tercatat di sistem.`
                      : 'Ringkasan stok kritis dan log operasional terbaru.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="space-y-6">
                    {auditLogs.length > 0 ? (
                      auditLogs.slice(0, 5).map((log) => {
                        const actor = String(log.actor_username || 'SYS');
                        const init = actor.slice(0, 2).toUpperCase();
                        return (
                          <div
                            key={log.id}
                            className="flex items-center gap-4"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
                              {init}
                            </div>
                            <div className="flex flex-1 flex-wrap items-center justify-between gap-2 min-w-0">
                              <div className="space-y-1 min-w-0">
                                <p className="text-sm font-medium leading-none truncate">
                                  {actor}
                                </p>
                                <p className="text-xs text-muted-foreground truncate max-w-[210px]">
                                  {log.details || log.action}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                                {log.action}
                              </Badge>
                            </div>
                          </div>
                        );
                      })
                    ) : lowStockItems.length > 0 ? (
                      lowStockItems.slice(0, 5).map((item) => (
                        <div
                          key={item.id || item.sku}
                          className="flex items-center gap-4"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
                            {String(item.sku || 'SK').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                            <div className="space-y-1 min-w-0">
                              <p className="text-sm font-medium leading-none truncate">
                                {item.name}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {item.sku} · {item.category}
                              </p>
                            </div>
                            <div className="text-sm font-medium text-destructive shrink-0">
                              {item.current_stock}/{item.min_stock || 20}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-10 text-center text-sm text-muted-foreground">
                        Belum ada aktivitas terbaru.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ===== TAB 2: ANALYTICS ===== */}
          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Perbandingan Inbound, Outbound & Opname</CardTitle>
                <CardDescription>
                  Rincian volume unit masuk (GRN), keluar (POS/Outbound), dan audit opname RFID.
                </CardDescription>
              </CardHeader>
              <CardContent className="ps-2">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={rechartsData}>
                    <XAxis
                      dataKey="name"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                      }}
                    />
                    <Bar
                      dataKey="inbound"
                      name="Inbound (GRN)"
                      fill="hsl(var(--chart-1))"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="outbound"
                      name="Outbound (POS)"
                      fill="hsl(var(--chart-2))"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="opname"
                      name="Opname RFID"
                      fill="hsl(var(--chart-3))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TAB 3: STOK KRITIS ===== */}
          <TabsContent value="low-stock" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Daftar Stok Kritis</CardTitle>
                  <CardDescription>
                    Produk dengan saldo di bawah atau sama dengan batas minimum aman.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => openAddProductModal?.()}>
                  <Plus className="h-4 w-4" />
                  Tambah Barang
                </Button>
              </CardHeader>
              <CardContent>
                {lowStockItems.length === 0 ? (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-6 text-center text-sm text-emerald-700 dark:text-emerald-400">
                    Semua stok barang berada di atas batas minimum aman.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                          <th className="h-10 px-4">SKU</th>
                          <th className="h-10 px-4">Nama Barang</th>
                          <th className="h-10 px-4">Kategori</th>
                          <th className="h-10 px-4 text-right">Saldo / Min</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lowStockItems.map((item) => (
                          <tr key={item.id || item.sku} className="hover:bg-muted/30">
                            <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                            <td className="px-4 py-3 font-medium">{item.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                            <td className="px-4 py-3 text-right">
                              <Badge variant="destructive">
                                {item.in_rack_stock ?? item.current_stock} / {item.min_stock || 20} unit
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TAB 4: GATE SECURITY ===== */}
          <TabsContent value="gate" className="space-y-4">
            <Card data-tour="dashboard-gate-banner">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle>Fase 2: Outbound & Security Gate</CardTitle>
                    <Badge variant="success">Aktif</Badge>
                  </div>
                  <CardDescription>
                    Pastikan setiap barang keluar memiliki Gate Pass resmi dengan status tag{' '}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                      AUTHORIZED_OUT
                    </code>{' '}
                    sebelum melintasi portal UHF RFID.
                  </CardDescription>
                </div>
                <Button onClick={() => switchTab?.('gate-security')}>
                  Buka Terminal Pos Satpam
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Status Portal</p>
                  <p className="mt-1 text-lg font-bold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    {(kpis.gateAlarmsCount || 0) > 0 ? 'WASPADA' : 'TERLINDUNGI'}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Gate Pass Aktif</p>
                  <p className="mt-1 text-lg font-bold">
                    {kpis.activeGatePasses ?? 0} dokumen izin
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Broker EMQX Live</p>
                  <p className="mt-1 text-lg font-bold">
                    {mqttConnected ? 'Terhubung (WS 8083)' : 'Mode Simulasi'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ============================================================================
  // MENU 2: MANAJEMEN USER (RBAC) & AUDIT LOG KEAMANAN (Menu Khusus Orang 4)
  // ============================================================================
  if (activeMenu === 'users') {
    // Proteksi RBAC: Jangan tampilkan halaman Manajemen User jika bukan Admin atau Supervisor
    if (!isAdminOrSupervisor) {
      return (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm max-w-xl mx-auto my-12">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-inner border border-rose-100">
            🔒
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Akses Halaman Dibatasi (RBAC Guard)</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Halaman <b>Manajemen User (RBAC)</b> hanya dapat diakses oleh akun dengan jabatan <b>ADMIN</b> atau <b>SUPERVISOR</b>. Sesi Anda saat ini ({currentUser?.full_name || currentUser?.username}) terdaftar dengan jabatan <b>{currentUser?.role || 'Staff'}</b>.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => switchTab?.('dashboard')}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-600/20 transition-all inline-flex items-center space-x-2"
            >
              <span>← Kembali ke Dashboard Utama</span>
            </button>
          </div>
        </div>
      );
    }

    const filteredUsers = users.filter((u) => {
      const matchSearch =
        u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.username?.toLowerCase().includes(userSearch.toLowerCase());
      const matchRole =
        userRoleFilter === 'ALL' ||
        String(u.role).toUpperCase().includes(userRoleFilter.toUpperCase());
      return matchSearch && matchRole;
    });

    const activeCount = users.filter((u) => u.is_active).length;
    const adminSupervisorCount = users.filter(
      (u) =>
        String(u.role).toUpperCase().includes('ADMIN') ||
        String(u.role).toUpperCase().includes('SUPERVISOR')
    ).length;

    return (
      <div className="space-y-6">
        {/* Header Manajemen User */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-900">
                Manajemen User (RBAC) & Otorisasi Sistem
              </h2>
              <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-blue-200">
                Role-Based Access Control
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Kelola akun personel gudang, atur hak akses per jabatan, reset password, dan pantau jejak audit keamanan.
            </p>
          </div>
          <button
            onClick={() => {
              if (!isAdminOrSupervisor) {
                showNotification?.(
                  'Akses Ditolak (RBAC Guard): Hanya ADMIN atau SUPERVISOR yang dapat menambah user!',
                  'error'
                );
                return;
              }
              setShowAddUserModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-600/20 transition-all flex items-center space-x-2"
          >
            <span>➕</span>
            <span>Tambah Personel Baru</span>
          </button>
        </div>

        {!isAdminOrSupervisor && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-center justify-between">
            <span>
              🔒 <b>Mode Terbatas (RBAC Guard Aktif):</b> Anda sedang login sebagai{' '}
              <b>{currentUser?.full_name} ({currentUser?.role})</b>. Penambahan, pengeditan, dan penghapusan akun hanya dapat dilakukan oleh <b>ADMIN</b> atau <b>SUPERVISOR</b>.
            </span>
          </div>
        )}

        {/* 4 Summary Cards Manajemen User */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Personel</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{users.length} Akun</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Status Aktif</span>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{activeCount} Aktif</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Admin & Supervisor
            </span>
            <p className="text-2xl font-extrabold text-blue-600 mt-1">
              {adminSupervisorCount} Otorisator
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Jejak Audit Log
            </span>
            <p className="text-2xl font-extrabold text-indigo-600 mt-1">
              {auditLogs.length} Aktivitas
            </p>
          </div>
        </div>

        {/* Tabel Daftar Pengguna (TanStack DataTable) */}
        <DataTable
          data={users}
          columns={[
            {
              accessorKey: 'id',
              header: 'ID',
              cell: ({ row }) => (
                <span className="font-mono text-muted-foreground">#{row.original.id}</span>
              ),
            },
            {
              accessorKey: 'full_name',
              header: 'Nama Lengkap',
              cell: ({ row }) => {
                const u = row.original;
                const isSelf = u.username === currentUser?.username;
                return (
                  <span className="font-medium text-foreground">
                    {u.full_name}
                    {isSelf && (
                      <Badge variant="default" className="ml-2 text-[10px]">
                        Anda
                      </Badge>
                    )}
                  </span>
                );
              },
            },
            {
              accessorKey: 'username',
              header: 'Username',
              cell: ({ row }) => (
                <span className="font-mono text-muted-foreground">
                  @{row.original.username}
                </span>
              ),
            },
            {
              accessorKey: 'role',
              header: 'Role (RBAC)',
              cell: ({ row }) => (
                <Badge variant="secondary" className="font-mono text-[11px]">
                  {row.original.role}
                </Badge>
              ),
            },
            {
              id: 'status',
              header: 'Status',
              accessorFn: (row) => (row.is_active ? 'AKTIF' : 'NONAKTIF'),
              cell: ({ row }) => (
                <Badge variant={row.original.is_active ? 'success' : 'destructive'}>
                  {row.original.is_active ? 'Aktif' : 'Nonaktif'}
                </Badge>
              ),
            },
            {
              accessorKey: 'created_at',
              header: 'Terdaftar Sejak',
              cell: ({ row }) => (
                <span className="font-mono text-muted-foreground whitespace-nowrap">
                  {row.original.created_at
                    ? new Date(row.original.created_at).toLocaleDateString('id-ID')
                    : '-'}
                </span>
              ),
            },
            {
              id: 'actions',
              header: 'Aksi',
              enableSorting: false,
              enableHiding: false,
              cell: ({ row }) => {
                const u = row.original;
                const isSelf = u.username === currentUser?.username;
                return (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(u)}
                      className="h-7 px-2 text-xs"
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleUserStatus(u.id)}
                      className="h-7 px-2 text-xs"
                    >
                      {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                    {!isSelf && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(u)}
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      >
                        Hapus
                      </Button>
                    )}
                  </div>
                );
              },
            },
          ]}
          searchPlaceholder="Cari nama personel atau username..."
          dateField="created_at"
          initialSorting={[{ id: 'created_at', desc: true }]}
          filters={[
            {
              key: 'role',
              label: 'Role',
              options: [
                { value: 'ADMIN', label: 'ADMIN' },
                { value: 'SUPERVISOR', label: 'SUPERVISOR' },
                { value: 'WAREHOUSE_STAFF', label: 'WAREHOUSE_STAFF' },
                { value: 'SECURITY', label: 'SECURITY' },
              ],
            },
            {
              key: 'status',
              label: 'Status',
              getValue: (row) => (row.is_active ? 'AKTIF' : 'NONAKTIF'),
              options: [
                { value: 'AKTIF', label: 'Aktif' },
                { value: 'NONAKTIF', label: 'Nonaktif' },
              ],
            },
          ]}
          emptyMessage="Tidak ada akun personel yang cocok."
        />

        {/* Tabel System Audit Logs (TanStack DataTable) */}
        <Card>
          <CardHeader>
            <CardTitle>System Security & Activity Audit Logs</CardTitle>
            <CardDescription>
              Rekam jejak seluruh login/logout personel, perubahan akun RBAC, dan konfigurasi sistem (dilengkapi sorting & filter tanggal).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={auditLogs}
              columns={[
                {
                  accessorKey: 'created_at',
                  header: 'Waktu / Tanggal',
                  cell: ({ row }) => (
                    <span className="font-mono text-muted-foreground whitespace-nowrap">
                      {row.original.created_at
                        ? new Date(row.original.created_at).toLocaleString('id-ID')
                        : '-'}
                    </span>
                  ),
                },
                {
                  accessorKey: 'actor_username',
                  header: 'Personel & Role',
                  cell: ({ row }) => (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{row.original.actor_username}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {row.original.actor_role}
                      </Badge>
                    </div>
                  ),
                },
                {
                  accessorKey: 'action',
                  header: 'Aksi Sistem',
                  cell: ({ row }) => (
                    <span className="font-mono font-semibold">{row.original.action}</span>
                  ),
                },
                {
                  accessorKey: 'details',
                  header: 'Detail Aktivitas',
                  cell: ({ row }) => (
                    <span className="text-muted-foreground">{row.original.details}</span>
                  ),
                },
              ]}
              searchPlaceholder="Cari personel, aksi, atau detail log..."
              dateField="created_at"
              initialSorting={[{ id: 'created_at', desc: true }]}
              filters={[
                {
                  key: 'actor_role',
                  label: 'Role',
                  options: [
                    { value: 'ADMIN', label: 'ADMIN' },
                    { value: 'SUPERVISOR', label: 'SUPERVISOR' },
                    { value: 'WAREHOUSE_STAFF', label: 'WAREHOUSE_STAFF' },
                    { value: 'SECURITY', label: 'SECURITY' },
                  ],
                },
              ]}
              emptyMessage="Belum ada catatan audit log."
              defaultPageSize={10}
            />
          </CardContent>
        </Card>

        {/* Modal Tambah Personel Baru */}
        {showAddUserModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-900">
                  Daftarkan Personel Gudang Baru
                </h3>
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Nama Lengkap Personel
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Rina Permata"
                    value={newUserForm.full_name}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, full_name: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Username Login
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: rina.kasir"
                    value={newUserForm.username}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, username: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Password Awal
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserForm.password}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, password: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Role / Hak Akses (RBAC)
                  </label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="ADMIN">ADMIN (Akses Penuh Sistem)</option>
                    <option value="SUPERVISOR">SUPERVISOR (Otorisasi & Opname)</option>
                    <option value="WAREHOUSE_STAFF">WAREHOUSE_STAFF (Operator Gudang)</option>
                    <option value="SECURITY">SECURITY (Petugas Gate RFID)</option>
                    <option value="KASIR_POS">KASIR_POS (Kasir & Gate Pass)</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingUser}
                    className="px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-semibold shadow-md"
                  >
                    {savingUser ? 'Menyimpan...' : 'Simpan Personel'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Edit Personel / Reset Password */}
        {editingUser && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-900">
                  Edit Personel (@{editingUser.username})
                </h3>
                <button
                  onClick={() => setEditingUser(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={editUserForm.full_name}
                    onChange={(e) =>
                      setEditUserForm({ ...editUserForm, full_name: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Role / Jabatan (RBAC)
                  </label>
                  <select
                    value={editUserForm.role}
                    onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="ADMIN">ADMIN (Akses Penuh Sistem)</option>
                    <option value="SUPERVISOR">SUPERVISOR (Otorisasi & Opname)</option>
                    <option value="WAREHOUSE_STAFF">WAREHOUSE_STAFF (Operator Gudang)</option>
                    <option value="SECURITY">SECURITY (Petugas Gate RFID)</option>
                    <option value="KASIR_POS">KASIR_POS (Kasir & Gate Pass)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Reset Password Baru (Kosongkan jika tidak diubah)
                  </label>
                  <input
                    type="text"
                    placeholder="Masukkan password baru..."
                    value={editUserForm.password}
                    onChange={(e) =>
                      setEditUserForm({ ...editUserForm, password: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-semibold shadow-md"
                  >
                    Simpan Perubahan
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
  // MENU 3: LAPORAN & ANALITIK GUDANG (Data Real Database + Shadcn Admin UI)
  // ============================================================================
  if (activeMenu === 'laporan') {
    const categories = summary?.categoryDistribution || [];
    const totalCatStock = Math.max(
      1,
      categories.reduce((acc, c) => acc + Number(c.stock || 0), 0)
    );
    const analytics = summary?.analytics || {};
    const turnoverRate = Number(analytics.turnoverRate ?? 0);
    const outbound30dUnits = Number(analytics.outbound30dUnits ?? 0);
    const opnameAccuracy = analytics.opnameAccuracy;
    const totalOpnameSessions = Number(analytics.totalOpnameSessions ?? 0);
    const avgPickingMinutes = analytics.avgPickingMinutes;
    const completedPickingOrders = Number(analytics.completedPickingOrders ?? 0);

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Laporan & Analitik Gudang</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Metrik performa operasional real-time dari database, distribusi kategori, dan ekspor laporan.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handleDownloadCsvReport}>
              <Download className="h-4 w-4" />
              Export Laporan CSV
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Cetak / PDF
            </Button>
          </div>
        </div>

        {/* 3 Real-Time Analytic Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Turnover Stok (30 Hari)</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{turnoverRate.toFixed(2)}x</div>
              <p className="text-xs text-muted-foreground mt-1">
                {outbound30dUnits} unit keluar dalam 30 hari terakhir
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Akurasi Stock Opname RFID</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {opnameAccuracy !== null && opnameAccuracy !== undefined
                  ? `${opnameAccuracy}%`
                  : '—'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalOpnameSessions > 0
                  ? `Rata-rata dari ${totalOpnameSessions} sesi opname tercatat`
                  : 'Belum ada sesi stock opname tercatat'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waktu Proses Picking</CardTitle>
              <Clock className="h-4 w-4 text-violet-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {avgPickingMinutes !== null && avgPickingMinutes !== undefined
                  ? `${avgPickingMinutes} Menit`
                  : '—'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {completedPickingOrders > 0
                  ? `Rata-rata dari ${completedPickingOrders} order picking selesai`
                  : 'Belum ada order picking selesai'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Distribusi Kategori Barang */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Stok Berdasarkan Kategori Barang</CardTitle>
            <CardDescription>
              Proporsi stok fisik siap di rak (In-Rack) per kategori produk.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data kategori stok.</p>
            ) : (
              categories.map((cat, idx) => {
                const pct = Math.round((Number(cat.stock || 0) / totalCatStock) * 100);
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-xs font-semibold text-foreground mb-1.5">
                      <span>{cat.category}</span>
                      <span>
                        {cat.stock} Unit ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.max(pct, Number(cat.stock || 0) > 0 ? 4 : 0)}%` }}
                        className="bg-primary h-full rounded-full transition-all"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // MENU 4: PENGATURAN SISTEM DIGI WMS (Persis Template Awal digiwms.html + EMQX)
  // ============================================================================
  if (activeMenu === 'pengaturan') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Pengaturan Sistem DIGI WMS</h2>
              <p className="text-xs text-slate-500 mt-1">
                Sesuaikan preferensi gudang, integrasi API, dan frekuensi RFID.
              </p>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                isAdminOrSupervisor
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {isAdminOrSupervisor ? '🔓 Akses Admin/Supervisor' : '🔒 Mode Baca (Read-Only)'}
            </span>
          </div>

          {!isAdminOrSupervisor && (
            <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <b>Proteksi Keamanan RBAC:</b> Sesi Anda saat ini adalah{' '}
              <b>{currentUser?.full_name} ({currentUser?.role})</b>. Pengubahan daya antena UHF RFID dan parameter gudang dikunci khusus untuk <b>ADMIN / SUPERVISOR</b>.
            </div>
          )}

          {settings && (
            <form onSubmit={handleSaveSettings} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Nama Gudang Utama
                </label>
                <input
                  type="text"
                  disabled={!isAdminOrSupervisor}
                  value={settings.warehouse_name}
                  onChange={(e) => setSettings({ ...settings, warehouse_name: e.target.value })}
                  className="mt-1 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Frekuensi UHF RFID
                  </label>
                  <input
                    type="text"
                    value="920 - 923 MHz (Indonesia)"
                    readOnly
                    className="mt-1 w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Daya Pancar Antena ({settings.rfid_gate_power_dbm} dBm)
                  </label>
                  <input
                    type="range"
                    min="15"
                    max="33"
                    disabled={!isAdminOrSupervisor}
                    value={settings.rfid_gate_power_dbm}
                    onChange={(e) =>
                      setSettings({ ...settings, rfid_gate_power_dbm: Number(e.target.value) })
                    }
                    className="mt-3 w-full accent-blue-600 disabled:opacity-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Mode Anti-Collision Reader
                </label>
                <select
                  disabled={!isAdminOrSupervisor}
                  value={settings.anti_collision_mode}
                  onChange={(e) =>
                    setSettings({ ...settings, anti_collision_mode: e.target.value })
                  }
                  className="mt-1 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none disabled:opacity-60"
                >
                  <option value="Dense Reader Mode (M=4) - EPCglobal Gen2">
                    Dense Reader Mode (M=4) - EPCglobal Gen2
                  </option>
                  <option value="Fast Tag Read Mode (M=2) - High Speed Conveyor">
                    Fast Tag Read Mode (M=2) - High Speed Conveyor
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Notifikasi Stok Minimum & Alarm Gate Otomatis
                </label>
                <div className="mt-2 flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="notif-toggle"
                    disabled={!isAdminOrSupervisor}
                    checked={settings.alarm_siren_enabled}
                    onChange={(e) =>
                      setSettings({ ...settings, alarm_siren_enabled: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="notif-toggle" className="text-sm text-slate-600">
                    Aktifkan peringatan stok kritis & sirine GPIO gerbang keluar
                  </label>
                </div>
              </div>
              <button
                type="submit"
                disabled={savingSettings || !isAdminOrSupervisor}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-md transition-all"
              >
                {savingSettings ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </form>
          )}
        </div>

        {/* Panel Uji Pancar EMQX MQTT Broker */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <span className="bg-blue-500/20 text-blue-300 text-xs px-2.5 py-1 rounded-full font-semibold">
              EMQX MQTT Broker Diagnostic
            </span>
            <h3 className="text-lg font-bold mt-2">Simulator Pancaran Hardware ke MQTT</h3>
            <p className="text-xs text-slate-400 mt-1">
              Uji kirim paket JSON dari Backend ke topik EMQX (TCP 1883 → WebSocket 8083) secara real-time.
            </p>
            <form onSubmit={handleTestMqttPublish} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 uppercase font-semibold mb-1">
                  Topik MQTT Tujuan
                </label>
                <select
                  value={testTopic}
                  onChange={(e) => setTestTopic(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white"
                >
                  <option value="digiwms/rfid/gate-alarm">digiwms/rfid/gate-alarm</option>
                  <option value="digiwms/rfid/encoded">digiwms/rfid/encoded</option>
                  <option value="digiwms/ledger/updated">digiwms/ledger/updated</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase font-semibold mb-1">
                  Kode EPC Uji Coba
                </label>
                <input
                  type="text"
                  value={testEpc}
                  onChange={(e) => setTestEpc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono text-emerald-400"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-sm shadow-md transition"
              >
                📡 Tembak Paket ke EMQX Broker
              </button>
            </form>
          </div>

          <div className="mt-6 p-4 bg-slate-950 rounded-xl border border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 uppercase">
              Payload Terakhir Diterima Browser:
            </p>
            <pre className="text-xs font-mono text-emerald-400 mt-2 overflow-x-auto">
              {lastEvent
                ? JSON.stringify(lastEvent, null, 2)
                : '// Menunggu transmisi dari topik digiwms/# ...'}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MENU 5: FLYER PROMOSI (Persis Template Awal digiwms.html)
  // ============================================================================
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-800 p-6 sm:p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="max-w-xl">
          <span className="bg-amber-500 text-slate-950 font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider">
            Promo Terbatas
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold mt-2">DIGI WMS Profesional</h2>
          <p className="text-blue-100 text-sm mt-2">
            Nikmati semua fitur warehouse management system tercanggih tanpa batasan. Kelola stok, penerimaan, picking, packing, dan pengiriman dengan harga sangat terjangkau.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://wa.me/628999802026?text=Halo%20DIGI%20WMS,%20saya%20tertarik%20dengan%20promo%20WMS%20Rp149rb/bulan"
              target="_blank"
              rel="noreferrer"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/30 flex items-center space-x-2 transition-all"
            >
              <span>💬</span>
              <span>Pesan Promo via WhatsApp</span>
            </a>
            <button
              onClick={() =>
                showNotification?.('Tautan flyer promosi berhasil disalin!', 'success')
              }
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-3 rounded-xl font-semibold text-sm transition-all flex items-center space-x-2"
            >
              <span>🔗</span>
              <span>Bagikan Flyer</span>
            </button>
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-center">
          <p className="text-xs text-blue-200 uppercase tracking-wider font-semibold">
            Hubungi Kami Sekarang
          </p>
          <p className="text-xl font-extrabold mt-1 text-amber-400">+62 89-9980-2026</p>
          <p className="text-xs text-blue-100 mt-0.5">admin@digiwms.com</p>
        </div>
      </div>

      {/* Flyer Showcase */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
        <div className="w-full max-w-2xl bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-200 relative group">
          <img
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1000&auto=format&fit=crop&q=80"
            alt="Flyer WMS Promo"
            className="w-full h-auto object-cover max-h-[520px] opacity-90 group-hover:scale-105 transition-all duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent flex flex-col justify-end p-6 sm:p-8 text-white">
            <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full w-max mb-2">
              OFFICIAL FLYER DIGI WMS
            </span>
            <h3 className="text-xl sm:text-2xl font-extrabold">Warehouse Management System</h3>
            <p className="text-slate-300 text-xs sm:text-sm mt-1">
              Kelola gudang lebih mudah, cepat, dan akurat dengan sistem terintegrasi.
            </p>
            <div className="mt-4 flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="bg-amber-500 text-slate-950 font-black px-3 py-1.5 rounded-xl text-sm shadow-lg">
                  Rp149rb /bulan
                </div>
                <span className="text-xs text-slate-400">
                  Harga Spesial Promo khusus bulan ini!
                </span>
              </div>
              <a
                href="https://wa.me/628999802026?text=Halo%20DIGI%20WMS,%20saya%20ingin%20berlangganan%20WMS%20Rp149rb/bulan"
                target="_blank"
                rel="noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition-all"
              >
                Ambil Promo Ini
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
