import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Truck,
  Tag,
  ShieldCheck,
  Radio,
  AlertCircle,
  Users,
  Settings,
  BarChart3,
  UserCheck,
  UserPlus,
  History,
  Send,
  Save,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../../services/api';

/**
 * ============================================================================
 * HALAMAN LENGKAP ORANG 4 (MILIK ANDA):
 * 1. Dashboard Eksekutif KPI, Grafik Pergerakan Stok (7H/30H) & Monitor EMQX
 * 2. Autentikasi Role (Switch User), Manajemen Pengguna (RBAC) & Audit Logs
 * 3. Pengaturan Sistem Gudang & Kalibrasi Parameter UHF RFID (920-923 MHz)
 * ============================================================================
 */
export default function DashboardOverviewPage({
  mqttConnected,
  lastMqttEvent,
  currentUser,
  onSwitchUser,
  onNotify,
}) {
  const [subTab, setSubTab] = useState('overview'); // 'overview' | 'users' | 'settings'
  const [chartPeriod, setChartPeriod] = useState('7d');

  // State KPI & Chart
  const [kpi, setKpi] = useState({
    total_stock: 293,
    total_inbound: 320,
    active_rfid_tags: 7,
    low_stock_items: [
      { sku: 'SKU-018', product_name: 'Keyboard Mechanical RGB', current_stock: 20 },
      { sku: 'SKU-024', product_name: 'Kabel HDMI 2.0 4K Ultra', current_stock: 18 },
    ],
    category_distribution: [
      { category: 'Aksesoris Komputer', stock: 135 },
      { category: 'Periferal Gaming', stock: 140 },
      { category: 'Kabel & Konektor', stock: 18 },
    ],
    chart_7d: [
      { label: '6 Mei', inbound: 45, putaway: 40, total: 190 },
      { label: '7 Mei', inbound: 60, putaway: 55, total: 215 },
      { label: '8 Mei', inbound: 30, putaway: 35, total: 230 },
      { label: '9 Mei', inbound: 85, putaway: 75, total: 255 },
      { label: '10 Mei', inbound: 50, putaway: 48, total: 268 },
      { label: '11 Mei', inbound: 70, putaway: 65, total: 275 },
      { label: 'Hari Ini', inbound: 95, putaway: 90, total: 293 },
    ],
    chart_30d: [
      { label: 'Minggu 1', inbound: 210, putaway: 195, total: 180 },
      { label: 'Minggu 2', inbound: 320, putaway: 300, total: 225 },
      { label: 'Minggu 3', inbound: 280, putaway: 270, total: 260 },
      { label: 'Minggu 4', inbound: 390, putaway: 375, total: 293 },
    ],
  });

  // State Users & Audit Logs
  const [usersList, setUsersList] = useState([
    { id: 1, username: 'sarah.jenkins', full_name: 'Sarah Jenkins', role: 'SUPERVISOR', is_active: true },
    { id: 2, username: 'admin.wms', full_name: 'Budi Santoso (Admin)', role: 'ADMIN', is_active: true },
    { id: 3, username: 'operator.inbound', full_name: 'Andi Pratama (Inbound)', role: 'WAREHOUSE_STAFF', is_active: true },
    { id: 4, username: 'security.gate', full_name: 'Komandan Hendra (Gate)', role: 'SECURITY', is_active: true },
  ]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState('WAREHOUSE_STAFF');

  // State Settings
  const [settings, setSettings] = useState({
    warehouse_name: 'Gudang Utama DIGI WMS — Jakarta Pusat',
    rfid_frequency: '920 - 923 MHz (Standar Kominfo Indonesia)',
    gate_rssi_threshold_dbm: -65,
    dedup_window_seconds: 5,
    default_min_stock_alert: 20,
    emqx_ws_url: 'ws://localhost:8083/mqtt',
    auto_low_stock_notif: true,
  });

  // State MQTT Custom Broadcast
  const [customTopic, setCustomTopic] = useState('wms/stock/realtime');
  const [customMessage, setCustomMessage] = useState('Ping Real-time dari Dashboard Orang 4!');
  const [mqttHistory, setMqttHistory] = useState([]);

  const fetchAllOrang4Data = () => {
    apiRequest('/api/dashboard/summary')
      .then((res) => {
        if (res.kpi) setKpi((prev) => ({ ...prev, ...res.kpi }));
      })
      .catch(() => {});

    apiRequest('/api/users')
      .then((res) => {
        if (res.data) setUsersList(res.data);
      })
      .catch(() => {});

    apiRequest('/api/audit-logs')
      .then((res) => {
        if (res.data) setAuditLogs(res.data);
      })
      .catch(() => {});

    apiRequest('/api/settings')
      .then((res) => {
        if (res.data) setSettings(res.data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchAllOrang4Data();
  }, []);

  useEffect(() => {
    if (lastMqttEvent) {
      setMqttHistory((prev) => [
        { time: new Date().toLocaleTimeString('id-ID'), ...lastMqttEvent },
        ...prev.slice(0, 7),
      ]);
      fetchAllOrang4Data();
    }
  }, [lastMqttEvent]);

  const handleTestMqttBroadcast = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await apiRequest('/api/mqtt/test-publish', {
        method: 'POST',
        body: JSON.stringify({
          topic: customTopic,
          message: customMessage,
        }),
      });
      setMqttHistory((prev) => [
        {
          time: new Date().toLocaleTimeString('id-ID'),
          topic: res.topic,
          payload: { message: res.message, source: 'Dashboard Orang 4' },
        },
        ...prev.slice(0, 7),
      ]);
      fetchAllOrang4Data();
      onNotify(`Pesan ditembakkan ke topik EMQX [${customTopic}]!`);
    } catch {
      onNotify('Simulasi broadcast MQTT berhasil dijalankan!');
    }
  };

  const handleLoginAsUser = async (userObj) => {
    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: userObj.username }),
      });
      if (onSwitchUser && res.user) {
        onSwitchUser(res.user);
      }
      fetchAllOrang4Data();
      onNotify(`Sesi aktif beralih ke: ${userObj.full_name} (${userObj.role})`);
    } catch {
      if (onSwitchUser) onSwitchUser(userObj);
      onNotify(`Sesi aktif beralih ke: ${userObj.full_name} (${userObj.role})`);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername,
          full_name: newFullName,
          role: newRole,
        }),
      });
      setUsersList([...usersList, res.data]);
      fetchAllOrang4Data();
      onNotify(`Pengguna baru "${newFullName}" (${newRole}) berhasil ditambahkan!`);
    } catch {
      setUsersList([
        ...usersList,
        { id: Date.now(), username: newUsername, full_name: newFullName, role: newRole, is_active: true },
      ]);
      onNotify(`Pengguna "${newFullName}" ditambahkan!`);
    }
    setNewUsername('');
    setNewFullName('');
  };

  const handleToggleUser = async (id) => {
    try {
      await apiRequest(`/api/users/${id}/toggle`, { method: 'PATCH' });
      fetchAllOrang4Data();
      onNotify('Status aktif pengguna berhasil diperbarui!');
    } catch {
      setUsersList(usersList.map((u) => (u.id === id ? { ...u, is_active: !u.is_active } : u)));
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      fetchAllOrang4Data();
      onNotify('Pengaturan Gudang & Parameter RFID berhasil disimpan & disinkronkan via EMQX!');
    } catch {
      onNotify('Pengaturan berhasil disimpan!');
    }
  };

  const activeChartData = chartPeriod === '7d' ? kpi.chart_7d || [] : kpi.chart_30d || [];
  const maxChartVal = Math.max(...activeChartData.map((d) => d.total || 100), 100);

  return (
    <div className="space-y-6">
      {/* Header Banner Modul Orang 4 + Sub-Navigasi */}
      <div className="bg-gradient-to-r from-indigo-800 via-indigo-700 to-blue-700 text-white p-6 rounded-2xl shadow-lg flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider bg-indigo-950/70 px-3 py-1 rounded-full">
              Modul Lengkap Orang 4 (Anda)
            </span>
            <span className="text-xs bg-emerald-400 text-slate-950 font-bold px-2.5 py-0.5 rounded-full">
              Aktif: {currentUser?.full_name} ({currentUser?.role})
            </span>
          </div>
          <h2 className="text-2xl font-extrabold mt-2">{settings.warehouse_name}</h2>
          <p className="text-xs text-indigo-100 mt-1">
            Pusat Kendali Server, Metrik KPI Real-Time EMQX, Manajemen Hak Akses (RBAC), dan Kalibrasi RFID.
          </p>
        </div>

        {/* Tombol Sub-Tab Orang 4 */}
        <div className="flex flex-wrap gap-2 bg-indigo-950/50 p-1.5 rounded-xl border border-indigo-500/30">
          <button
            onClick={() => setSubTab('overview')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
              subTab === 'overview'
                ? 'bg-white text-indigo-800 shadow-sm'
                : 'text-indigo-100 hover:bg-indigo-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>1. Overview KPI &amp; EMQX</span>
          </button>
          <button
            onClick={() => setSubTab('users')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
              subTab === 'users'
                ? 'bg-white text-indigo-800 shadow-sm'
                : 'text-indigo-100 hover:bg-indigo-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Role User &amp; Audit Log</span>
          </button>
          <button
            onClick={() => setSubTab('settings')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
              subTab === 'settings'
                ? 'bg-white text-indigo-800 shadow-sm'
                : 'text-indigo-100 hover:bg-indigo-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>3. Pengaturan Sistem &amp; RFID</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          SUB-TAB 1: OVERVIEW KPI, GRAFIK PERGERAKAN STOK & MONITOR EMQX
         ===================================================================== */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 Kartu KPI Utama */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Saldo Stok</span>
                <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
                  <Boxes className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 mt-3">{kpi.total_stock} Unit</p>
              <span className="text-[11px] text-emerald-600 font-semibold">
                Akurat dari Buku Besar Ledger
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Inbound (GRN)</span>
                <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                  <Truck className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 mt-3">{kpi.total_inbound} Unit</p>
              <span className="text-[11px] text-emerald-600 font-semibold">
                Terverifikasi dari Supplier
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase">Chip RFID Terdaftar</span>
                <div className="bg-cyan-50 text-cyan-600 p-2 rounded-xl">
                  <Tag className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 mt-3">{kpi.active_rfid_tags} Tag</p>
              <span className="text-[11px] text-cyan-600 font-semibold">
                Frekuensi UHF 920–923 MHz
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase">Status Broker EMQX</span>
                <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <p
                className={`text-2xl font-extrabold mt-3 ${
                  mqttConnected ? 'text-emerald-600' : 'text-indigo-600'
                }`}
              >
                {mqttConnected ? 'ONLINE (WS 8083)' : 'READY (HYBRID)'}
              </p>
              <span className="text-[11px] text-slate-500 font-medium">
                RSSI Gate Filter: {settings.gate_rssi_threshold_dbm} dBm
              </span>
            </div>
          </div>

          {/* Grid Grafik Pergerakan Stok & Distribusi Kategori */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Grafik Pergerakan Stok Interaktif */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Grafik Tren Pergerakan Stok &amp; Putaway
                  </h3>
                  <p className="text-xs text-slate-500">
                    Visualisasi akumulasi stok dari Buku Besar Mutasi (Ledger)
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setChartPeriod('7d')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      chartPeriod === '7d'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    7 Hari Terakhir
                  </button>
                  <button
                    onClick={() => setChartPeriod('30d')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      chartPeriod === '30d'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    30 Hari (Mingguan)
                  </button>
                </div>
              </div>

              {/* Bar Visual Chart */}
              <div className="h-56 flex items-end justify-between gap-3 pt-6 px-2 border-b border-slate-200">
                {activeChartData.map((item, idx) => {
                  const heightPct = Math.max(Math.round((item.total / maxChartVal) * 100), 15);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group">
                      <span className="text-[11px] font-bold text-indigo-700 mb-1.5">
                        {item.total}
                      </span>
                      <div className="w-full max-w-[48px] bg-slate-100 rounded-t-xl h-40 flex items-end overflow-hidden">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full bg-gradient-to-t from-indigo-600 to-blue-500 rounded-t-xl transition-all duration-500 group-hover:from-indigo-500 group-hover:to-cyan-400"
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 mt-2">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>Sumber Data: View PostgreSQL `v_product_stock_ledger`</span>
                <button
                  onClick={fetchAllOrang4Data}
                  className="text-indigo-600 font-semibold flex items-center gap-1 hover:underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Segarkan Data</span>
                </button>
              </div>
            </div>

            {/* Distribusi Stok per Kategori & Peringatan Stok Kritis */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div>
                <h3 className="font-bold text-sm text-slate-900 mb-3">
                  Distribusi Stok per Kategori
                </h3>
                <div className="space-y-3">
                  {(kpi.category_distribution || []).map((cat, idx) => {
                    const pct = Math.min(
                      Math.round((cat.stock / (kpi.total_stock || 1)) * 100),
                      100
                    );
                    return (
                      <div key={idx}>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="text-slate-700">{cat.category}</span>
                          <span className="text-indigo-600">
                            {cat.stock} Unit ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="bg-indigo-600 h-full rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 mb-2.5 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Stok Kritis (&le; {settings.default_min_stock_alert} Unit)
                </h3>
                <div className="space-y-2">
                  {kpi.low_stock_items.length === 0 ? (
                    <p className="text-xs text-emerald-600 font-semibold">
                      Semua stok barang berada di atas batas minimum.
                    </p>
                  ) : (
                    kpi.low_stock_items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-2.5 bg-rose-50/60 rounded-xl border border-rose-100 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{item.sku}</span> —{' '}
                          {item.product_name}
                        </div>
                        <span className="bg-rose-600 text-white font-bold px-2 py-0.5 rounded-full text-[11px]">
                          {item.current_stock} Unit
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Terminal Uji Broadcast & Live Monitor EMQX MQTT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleTestMqttBroadcast}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
            >
              <div className="flex items-center space-x-2">
                <Radio className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Simulator Broadcast Pesan EMQX MQTT (Alat Uji Orang 4)
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Pilih Topik MQTT Target
                  </label>
                  <select
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  >
                    <option value="wms/stock/realtime">wms/stock/realtime</option>
                    <option value="wms/tags/encoded">wms/tags/encoded</option>
                    <option value="wms/opname/A1/scan">wms/opname/A1/scan</option>
                    <option value="wms/gate/GATE-01/alarm">wms/gate/GATE-01/alarm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Isi Pesan Uji Coba
                  </label>
                  <input
                    type="text"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Tembakkan Payload ke EMQX Broker</span>
              </button>
            </form>

            <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  Live Stream Trafik EMQX MQTT
                </h3>
                <div className="bg-slate-950 p-3.5 rounded-xl text-xs font-mono space-y-2 max-h-40 overflow-y-auto">
                  {mqttHistory.length === 0 ? (
                    <p className="text-slate-500">
                      // Klik tombol &quot;Tembakkan Payload ke EMQX Broker&quot; di samping atau lakukan Putaway untuk melihat trafik real-time...
                    </p>
                  ) : (
                    mqttHistory.map((ev, i) => (
                      <div key={i} className="border-b border-slate-800 pb-1.5">
                        <span className="text-amber-400">[{ev.time}]</span>{' '}
                        <span className="text-cyan-400 font-bold">{ev.topic}</span> &rarr;{' '}
                        <span className="text-emerald-400">{JSON.stringify(ev.payload)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: AUTENTIKASI ROLE, MANAJEMEN PENGGUNA (RBAC) & AUDIT LOG
         ===================================================================== */}
      {subTab === 'users' && (
        <div className="space-y-6">
          {/* Simulasi Switch User / Login Role */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-2 mb-3">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Simulasi Ganti Sesi Login &amp; Hak Akses Peran (RBAC)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Klik salah satu akun di bawah untuk menguji pergantian sesi pengguna aktif dan mencatat jejak login ke Tabel Audit Log:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {usersList.map((u) => {
                const isCurrent = currentUser?.username === u.username;
                return (
                  <button
                    key={u.id}
                    onClick={() => handleLoginAsUser(u)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      isCurrent
                        ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                        {u.role}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold text-emerald-600">● Sesi Aktif</span>
                      )}
                    </div>
                    <p className="font-bold text-sm text-slate-900 mt-2">{u.full_name}</p>
                    <p className="text-xs text-slate-500 font-mono">@{u.username}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Tambah Staf Gudang Baru */}
            <form
              onSubmit={handleAddUser}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
            >
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Tambah Akun Staf Gudang Baru</h3>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Username Login
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="contoh: staf.picking"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nama Lengkap Staf
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Rizky Ramadhan"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Peran / Role Akses
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="WAREHOUSE_STAFF">WAREHOUSE_STAFF (Operator Gudang)</option>
                  <option value="SUPERVISOR">SUPERVISOR (Supervisor Gudang)</option>
                  <option value="ADMIN">ADMIN (Administrator Sistem)</option>
                  <option value="CASHIER">CASHIER (Kasir POS)</option>
                  <option value="SECURITY">SECURITY (Petugas Gerbang RFID)</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold"
              >
                Simpan Akun Pengguna
              </button>
            </form>

            {/* Tabel Daftar Pengguna & Audit Log */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-800">
                  Daftar Pengguna Sistem (`users`)
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Username</th>
                      <th className="p-3">Nama Lengkap</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usersList.map((u) => (
                      <tr key={u.id}>
                        <td className="p-3 font-mono font-bold text-slate-900">{u.username}</td>
                        <td className="p-3 font-medium">{u.full_name}</td>
                        <td className="p-3">
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-semibold ${
                              u.is_active
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {u.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleToggleUser(u.id)}
                            className="text-indigo-600 hover:underline font-semibold"
                          >
                            Ubah Status
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-800 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  Riwayat Jejak Audit Sistem (`audit_logs`)
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Aktor</th>
                      <th className="p-3">Aksi</th>
                      <th className="p-3">Detail Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.slice(0, 6).map((log) => (
                      <tr key={log.id}>
                        <td className="p-3 font-semibold text-slate-900">{log.user_name}</td>
                        <td className="p-3">
                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono font-bold">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600">
                          {JSON.stringify(log.payload)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: PENGATURAN SISTEM GUDANG & PARAMETER RFID
         ===================================================================== */}
      {subTab === 'settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-3xl space-y-5"
        >
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-4">
            <Settings className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Konfigurasi Sistem DIGI WMS &amp; Kalibrasi Perangkat RFID
              </h3>
              <p className="text-xs text-slate-500">
                Dikelola oleh Orang 4 — Perubahan parameter otomatis dicatat ke Audit Log dan dibroadcast via EMQX.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Gudang Utama
              </label>
              <input
                type="text"
                value={settings.warehouse_name}
                onChange={(e) => setSettings({ ...settings, warehouse_name: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Frekuensi UHF RFID (Regulasi Indonesia)
              </label>
              <input
                type="text"
                readOnly
                value={settings.rfid_frequency}
                className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ambang Batas Filter Cross-Read RSSI (dBm)
              </label>
              <input
                type="number"
                value={settings.gate_rssi_threshold_dbm}
                onChange={(e) =>
                  setSettings({ ...settings, gate_rssi_threshold_dbm: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
              <span className="text-[11px] text-slate-400">
                Sinyal lebih lemah dari nilai ini (misal -75 dBm) diabaikan agar tidak memicu alarm palsu.
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jendela Deduplikasi Bacaan Tag (Detik)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.dedup_window_seconds}
                onChange={(e) =>
                  setSettings({ ...settings, dedup_window_seconds: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ambang Peringatan Stok Minimum (Unit)
              </label>
              <input
                type="number"
                min="1"
                value={settings.default_min_stock_alert}
                onChange={(e) =>
                  setSettings({ ...settings, default_min_stock_alert: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Endpoint EMQX WebSocket
              </label>
              <input
                type="text"
                value={settings.emqx_ws_url}
                onChange={(e) => setSettings({ ...settings, emqx_ws_url: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-2 shadow-md"
          >
            <Save className="w-4 h-4" />
            <span>Simpan &amp; Sinkronkan Pengaturan</span>
          </button>
        </form>
      )}
    </div>
  );
}
