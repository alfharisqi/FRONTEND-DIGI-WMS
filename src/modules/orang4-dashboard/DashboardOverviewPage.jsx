import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config/api';

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
      const [sumRes, prodRes] = await Promise.all([
        fetch(`${API_BASE_URL}/dashboard/summary`),
        fetch(`${API_BASE_URL}/products`),
      ]);
      const sumJson = await sumRes.json();
      const prodJson = await prodRes.json();
      setSummary(sumJson.data);
      setProducts(prodJson.data || []);
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
    lines.push('--- DAFTAR STOK PRODUK GUDANG (IMMUTABLE LEDGER) ---');
    lines.push('SKU,Nama Barang,Kategori,Stok Saat Ini,Batas Minimum,Status');
    products.forEach((p) => {
      const isLow = Number(p.current_stock) <= Number(p.min_stock || 15);
      lines.push(
        `"${p.sku}","${p.name}","${p.category}",${p.current_stock},${p.min_stock || 15},"${
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

  const lowStockItems = products.filter(
    (p) => Number(p.current_stock) <= Number(p.min_stock || 20)
  );

  // ============================================================================
  // MENU 1: DASHBOARD UTAMA (Tampilan Simpel, Bersih & Profesional)
  // ============================================================================
  if (activeMenu === 'dashboard') {
    return (
      <div className="space-y-6">
        {/* Compact Clean Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Ringkasan Gudang
              </h1>
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Supabase Cloud Connected</span>
              </span>
              {mqttConnected && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                  EMQX Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Pemantauan stok inventaris real-time, penerimaan barang, dan status portal gerbang RFID.
            </p>
          </div>
          <div className="flex items-center space-x-2.5 shrink-0">
            <button
              onClick={handleDownloadCsvReport}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-sm transition inline-flex items-center space-x-1.5"
              title="Unduh Rekap Format CSV"
            >
              <span>📥</span>
              <span>Ekspor CSV</span>
            </button>
            <button
              onClick={() => switchTab?.('rfid-opname')}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-600/20 transition inline-flex items-center space-x-1.5"
            >
              <span>🔍</span>
              <span>Opname Cepat</span>
            </button>
          </div>
        </div>

        {/* 4 Clean Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Total Stok Fisik</span>
              <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-bold text-[11px]">
                {kpis.totalSkus} SKU
              </span>
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {kpis.totalPhysicalStock}
              </span>
              <span className="text-xs text-slate-400 font-medium">unit</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 flex items-center space-x-1">
              <span className="text-emerald-500 font-bold">✓</span>
              <span>Saldo terverifikasi dari ledger</span>
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Penerimaan (GRN)</span>
              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[11px]">
                Terverifikasi
              </span>
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {kpis.totalInbound || 320}
              </span>
              <span className="text-xs text-slate-400 font-medium">unit</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 flex items-center space-x-1">
              <span className="text-emerald-500 font-bold">✓</span>
              <span>Dokumen PO masuk selesai</span>
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Tag RFID Terdata</span>
              <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-bold text-[11px]">
                920-923 MHz
              </span>
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {kpis.activeRfidTags}
              </span>
              <span className="text-xs text-slate-400 font-medium">chip</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 flex items-center space-x-1">
              <span className="text-indigo-500 font-bold">✓</span>
              <span>Semua tag ter-encode & aktif</span>
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Keamanan Gerbang</span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[11px]">
                Portal Standby
              </span>
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-emerald-600 tracking-tight">
                TERLINDUNGI
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 flex items-center space-x-1">
              <span className="text-emerald-500 font-bold">✓</span>
              <span>{kpis.gateAlarmsCount || 0} alarm sirine tercatat</span>
            </p>
          </div>
        </div>

        {/* Main Grid: Chart (65%) & Low Stock Alert (35%) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sisi Kiri: Grafik Tren Mutasi Stok Ramping */}
          <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Tren Pergerakan Stok
                </h3>
                <p className="text-xs text-slate-500">
                  Aktivitas masuk, keluar, dan opname ({chartPeriod === '7d' ? '7 Hari' : '30 Hari'} terakhir)
                </p>
              </div>
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  onClick={() => setChartPeriod('7d')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    chartPeriod === '7d'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  7 Hari
                </button>
                <button
                  onClick={() => setChartPeriod('30d')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    chartPeriod === '30d'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  30 Hari
                </button>
              </div>
            </div>

            <div className="h-64 flex items-end gap-3 sm:gap-4 pt-6 pb-2 px-3 border-b border-slate-100 bg-slate-50/40 rounded-xl">
              {chartSeries.map((item, idx) => {
                const inH = Math.round(((item.inbound || 0) / maxChartVal) * 180);
                const outH = Math.round(((item.outbound || 0) / maxChartVal) * 180);
                const opnH = Math.round(((item.opname || 0) / maxChartVal) * 180);
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center group">
                    <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-48">
                      <div
                        style={{ height: `${Math.max(inH, 8)}px` }}
                        title={`Inbound: +${item.inbound}`}
                        className="w-2.5 sm:w-3.5 bg-blue-600 hover:bg-blue-500 rounded-t-sm transition-all"
                      />
                      <div
                        style={{ height: `${Math.max(outH, 8)}px` }}
                        title={`Outbound: -${item.outbound}`}
                        className="w-2.5 sm:w-3.5 bg-rose-500 hover:bg-rose-400 rounded-t-sm transition-all"
                      />
                      <div
                        style={{ height: `${Math.max(opnH, 6)}px` }}
                        title={`Audit Opname: ${item.opname}`}
                        className="w-2.5 sm:w-3.5 bg-emerald-500 hover:bg-emerald-400 rounded-t-sm transition-all"
                      />
                    </div>
                    <span className="mt-2 text-[11px] font-semibold text-slate-500">{item.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 mt-4 text-xs text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span> Inbound (GRN)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Outbound (POS)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Opname RFID
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-400">
                Data real-time: v_product_stock_ledger
              </span>
            </div>
          </div>

          {/* Sisi Kanan: Peringatan Stok Kritis Berbasis Progress Bar */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Stok Kritis</h3>
                  <p className="text-xs text-slate-500">Item mendekati batas minimum aman</p>
                </div>
                <button
                  onClick={() => switchTab?.('stok')}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Lihat Semua →
                </button>
              </div>

              <div className="space-y-3">
                {lowStockItems.length === 0 ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium">
                    Semua stok barang aman di atas batas minimum.
                  </div>
                ) : (
                  lowStockItems.slice(0, 4).map((item) => {
                    const current = Number(item.current_stock);
                    const minStock = Number(item.min_stock || 20);
                    const percentage = Math.min(100, Math.round((current / minStock) * 100));
                    return (
                      <div
                        key={item.id || item.sku}
                        className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 hover:border-slate-200 transition"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-bold text-slate-800 truncate mr-2">{item.name}</p>
                          <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-md shrink-0">
                            {current} / {minStock} unit
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              percentage <= 75 ? 'bg-rose-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">
                          {item.sku} • {item.category}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <button
              onClick={() => openAddProductModal?.()}
              className="mt-4 w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-xl text-xs border border-slate-200 transition-all flex items-center justify-center space-x-2 shadow-sm"
            >
              <span>➕</span>
              <span>Tambah / Masuk Barang Baru</span>
            </button>
          </div>
        </div>
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

        {/* Tabel Daftar Pengguna (CRUD Lengkap) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-3">
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Cari nama personel atau username..."
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
            >
              <option value="ALL">Semua Role / Jabatan</option>
              <option value="ADMIN">ADMIN (Full Access)</option>
              <option value="SUPERVISOR">SUPERVISOR (Approval Opname)</option>
              <option value="WAREHOUSE_STAFF">WAREHOUSE_STAFF (Operator Inbound/Rak)</option>
              <option value="SECURITY">SECURITY / KASIR_POS (Gate & POS)</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="p-4">ID</th>
                  <th className="p-4">Nama Lengkap</th>
                  <th className="p-4">Username Login</th>
                  <th className="p-4">Role / Jabatan (RBAC)</th>
                  <th className="p-4">Status Akun</th>
                  <th className="p-4">Terdaftar Sejak</th>
                  <th className="p-4 text-right">Aksi Manajemen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.map((u) => {
                  const isSelf = u.username === currentUser?.username;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="p-4 font-mono text-xs text-slate-400">#{u.id}</td>
                      <td className="p-4 font-bold text-slate-900">
                        {u.full_name}
                        {isSelf && (
                          <span className="ml-2 text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full">
                            Anda
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-blue-600 font-semibold">@{u.username}</td>
                      <td className="p-4">
                        <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-1 rounded-lg font-bold font-mono">
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold ${
                            u.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {u.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-400">
                        {new Date(u.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(u)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition"
                        >
                          Edit / Password
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus(u.id)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                        >
                          {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold transition"
                          >
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabel System Audit Logs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-slate-900">
                System Security & Activity Audit Logs
              </h3>
              <p className="text-xs text-slate-500">
                Rekam jejak seluruh login/logout personel, perubahan akun RBAC, dan konfigurasi sistem
              </p>
            </div>
            <select
              value={auditRoleFilter}
              onChange={(e) => {
                setAuditRoleFilter(e.target.value);
                fetchUsersAndLogs(e.target.value);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
            >
              <option value="ALL">Semua Role</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPERVISOR">SUPERVISOR</option>
              <option value="WAREHOUSE_STAFF">WAREHOUSE_STAFF</option>
              <option value="SECURITY">SECURITY / KASIR</option>
            </select>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="p-3">Waktu</th>
                  <th className="p-3">Personel & Role</th>
                  <th className="p-3">Aksi Sistem</th>
                  <th className="p-3">Detail Aktivitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleTimeString('id-ID')}
                    </td>
                    <td className="p-3 font-semibold">
                      {log.actor_username}{' '}
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded ml-1">
                        {log.actor_role}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-800">{log.action}</td>
                    <td className="p-3 text-slate-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
  // MENU 3: LAPORAN & ANALITIK GUDANG (Persis Template Awal digiwms.html)
  // ============================================================================
  if (activeMenu === 'laporan') {
    const categories = summary?.categoryDistribution || [];
    const totalCatStock = Math.max(
      1,
      categories.reduce((acc, c) => acc + Number(c.stock || 0), 0)
    );

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Laporan & Analitik Gudang</h2>
            <p className="text-xs text-slate-500 mt-1">
              Unduh laporan stok, turn-over rate, distribusi kategori, dan performa operasional gudang.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadCsvReport}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-md transition-all flex items-center space-x-2"
            >
              <span>📥</span>
              <span>Export Laporan CSV (Excel)</span>
            </button>
            <button
              onClick={() => window.print()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-md transition-all flex items-center space-x-2"
            >
              <span>🖨️</span>
              <span>Cetak / Simpan PDF</span>
            </button>
          </div>
        </div>

        {/* 3 Analytic Cards from digiwms.html */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Turnover Stok Bulanan</h3>
              <span className="text-emerald-500 text-xl">📈</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">4.2x</p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">
              +0.5 lebih cepat dari rata-rata industri
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Akurasi Stok Opname RFID</h3>
              <span className="text-blue-500 text-xl">✅</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">99.4%</p>
            <p className="text-xs text-blue-600 mt-1 font-medium">
              Sangat akurat berdasarkan audit nirkabel
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Waktu Proses Picking</h3>
              <span className="text-purple-500 text-xl">⏱️</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">12 Menit</p>
            <p className="text-xs text-purple-600 mt-1 font-medium">
              Rata-rata per order pesanan keluar
            </p>
          </div>
        </div>

        {/* Distribusi Kategori Barang */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 text-base mb-4">
            Distribusi Stok Berdasarkan Kategori Barang
          </h3>
          <div className="space-y-4">
            {categories.map((cat, idx) => {
              const pct = Math.round((Number(cat.stock || 0) / totalCatStock) * 100);
              return (
                <div key={idx}>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>{cat.category}</span>
                    <span>
                      {cat.stock} Unit ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.max(pct, 5)}%` }}
                      className="bg-blue-600 h-full rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
