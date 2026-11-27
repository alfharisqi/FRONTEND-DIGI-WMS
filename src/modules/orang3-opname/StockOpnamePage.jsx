import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, Radio, Siren } from 'lucide-react';
import { API_BASE_URL, apiRequest } from '../../services/api';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function StockOpnamePage({
  activeMenu = 'rfid-opname',
  lastEvent,
  showNotification,
}) {
  const [products, setProducts] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [opnameZones, setOpnameZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  const [discrepancyRows, setDiscrepancyRows] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [sessionCode, setSessionCode] = useState(null);
  const [auditResult, setAuditResult] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedApprovalSession, setSelectedApprovalSession] = useState(null);

  const [gateStatus, setGateStatus] = useState('AMAN'); // 'AMAN' | 'ALARM' | 'CROSSREAD'
  const [gateIncidents, setGateIncidents] = useState([]);

  const fetchRealGateEvents = async () => {
    try {
      const json = await apiRequest('/api/gate/events?limit=20');
      const events = Array.isArray(json.data) ? json.data : [];
      if (events.length > 0) {
        setGateIncidents(
          events.map((evt) => ({
            eventTime: evt.event_time || null,
            time: evt.event_time
              ? new Date(evt.event_time).toLocaleString('id-ID')
              : '-',
            epc: evt.epc || '-',
            name: evt.item_name || `Gate Pass ${evt.pass_code || '-'}`,
            antenna: evt.antenna_info || 'Antena 1 & 2 (Keluar)',
            rssi: evt.rssi || '-52 dBm',
            status:
              evt.authorization_status === 'UNAUTHORIZED'
                ? 'ILLEGAL / UNPAID'
                : 'Authorized Out',
            action: evt.action_taken || 'Lolos Verifikasi',
          }))
        );
      }
    } catch (err) {
      console.error('Error loading real gate events:', err);
    }
  };

  const audioCtxRef = useRef(null);

  
const fetchProducts = async () => {
  try {
    const json = await apiRequest('/products');
    const prods = json.data || [];
    setProducts(prods);
  } catch (err) {
    console.error('Error loading Opname products:', err);
    showNotification?.(err.message, 'error');
  }
};

const fetchSessions = async () => {
  try {
    const json = await apiRequest('/stocktake/sessions');

    const sessionData = Array.isArray(json.data)
      ? json.data
      : [];

    setSessions(sessionData);

    console.log('Daftar sesi Stock Opname:', sessionData);
  } catch (err) {
    console.error('Error loading Stock Opname sessions:', err);
    showNotification?.(err.message, 'error');
  }
};

const fetchOpnameZones = async () => {
  setZonesLoading(true);
  try {
    const json = await apiRequest('/stocktake/zones');
    const locations = Array.isArray(json.data) ? json.data : [];
    const zonesByCode = new Map();

    locations.forEach((location) => {
      const code = String(location.zone_code || '').trim();
      if (!code) return;

      const totalExpected = Number(location.total_expected || 0);
      const label = location.zone_name || location.zone_description || '';
      if (!zonesByCode.has(code)) zonesByCode.set(code, { label, totalExpected });
    });

    const zones = Array.from(zonesByCode, ([code, details]) => ({ code, ...details }));
    setOpnameZones(zones);
    setSelectedZone((current) =>
      zones.some((zone) => zone.code === current) ? current : (zones[0]?.code || '')
    );
  } catch (err) {
    console.error('Error loading Stock Opname zones:', err);
    setOpnameZones([]);
    setSelectedZone('');
    showNotification?.(`Gagal memuat zona opname: ${err.message}`, 'error');
  } finally {
    setZonesLoading(false);
  }
};

const buildDiscrepancyTable = (auditData) => {
  if (!auditData) return;

  const systemStocks = auditData.system_stock || [];
  const scannedStocks = auditData.scanned_stock || [];
  const discrepancies = auditData.discrepancies || [];

  const scannedMap = new Map(
    scannedStocks.map((item) => [
      item.product_id,
      item.scanned_stock,
    ])
  );

  // 1. Membuat baris stok normal dan Missing
  const rows = systemStocks.map((item) => {
    const systemStock = Number(item.system_stock || 0);
    const scannedStock = Number(
      scannedMap.get(item.product_id) || 0
    );

    const diff = scannedStock - systemStock;

    return {
  product_id: item.product_id,
  sku: item.sku,
  name: item.product_name,
      location: `Zona ${auditData.zone_code}`,
      systemStock,
      scannedStock,
      diff,
      diagnosis:
  diff === 0
    ? 'Cocok 100% (Matched)'
    : diff < 0
    ? 'Selisih Kurang / Missing'
    : 'Surplus / Perlu Pemeriksaan',
      status: diff === 0 ? 'MATCH' : diff < 0 ? 'MISSING' : 'SURPLUS',
      approved: diff === 0,
    };
  });

  // 2. Menambahkan barang yang terbaca di zona yang salah
  
const misplacedRows = discrepancies
  .filter((item) => item.type === 'MISPLACED')
  .map((item) => ({
    product_id: item.product_id,
    sku: item.sku || '-',
    name: item.product_name || 'Produk tidak diketahui',
    location: `Aktual: Zona ${item.actual_zone || '-'}`,
    systemStock: 0,
    scannedStock: 1,
    diff: 1,
    diagnosis: `Salah Zona (MISPLACED) - Terbaca di Zona ${item.actual_zone || '-'}`,
    approved: false,
    status: 'MISPLACED',
    type: 'MISPLACED',
    epc: item.epc,
  }));


  // 3. Menggabungkan semua baris
  setDiscrepancyRows([...rows, ...misplacedRows]);
};

// Memilih sesi Stock Opname dari riwayat
const handleSelectApprovalSession = (session) => {
  if (!session) return;

  setSelectedApprovalSession(session);

  const snapshot = session.audit_snapshot;

  if (!snapshot) {
    showNotification?.(
      'Data audit sesi tidak ditemukan.',
      'error'
    );
    return;
  }

  // Menampilkan hasil audit berdasarkan sesi yang dipilih
  buildDiscrepancyTable({
    ...snapshot,
    discrepancies: session.discrepancies || [],
  });

  console.log('Sesi yang dipilih untuk persetujuan:', session);
};
  useEffect(() => {
  fetchProducts();
  fetchOpnameZones();
}, [lastEvent]);

useEffect(() => {
  if (activeMenu === 'rfid-opname') {
    fetchSessions();
  } else if (activeMenu === 'rfid-gate') {
    fetchRealGateEvents();
  }
}, [activeMenu, lastEvent]);

  // Web Audio Siren Sound Effect
  const playSirenBeep = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(680, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(980, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Ignore audio block
    }
  };


const submitScanResults = async (epcs, activeSessionId = sessionId) => {
  try {
    const result = await apiRequest('/stocktake/scan-submit', {
      method: 'POST',
      body: JSON.stringify({
        session_id: activeSessionId,
        scanned_epcs: epcs,
      }),
    });

    console.log('Hasil rekonsiliasi RFID:', result);

    showNotification?.(
      'Hasil scan berhasil dikirim ke backend!',
      'success'
    );

    console.log('Data audit dari backend:', result.data);
    return result.data;
  } catch (err) {
    console.error('Gagal mengirim hasil scan:', err);

    showNotification?.(
      err.message || 'Gagal mengirim hasil scan',
      'error'
    );

    throw err;
  }
};


const runHandheldOpnameSimulation = async () => {
  try {
    const catalog = await apiRequest(
      `/stocktake/zones/${encodeURIComponent(selectedZone)}/epcs`
    );
    const zoneEpcs = Array.isArray(catalog.data?.epcs) ? catalog.data.epcs : [];
    const zoneProducts = Array.isArray(catalog.data?.products) ? catalog.data.products : [];
    if (zoneEpcs.length === 0) {
      throw new Error(`Tidak ada EPC aktif di zona ${selectedZone}.`);
    }

    // Read every EPC for one SKU to demonstrate Match, leave other SKUs
    // unread to demonstrate Missing, and add one other-zone EPC for Misplaced.
    const misplacedSample = catalog.data?.misplaced_sample;
    const matchProduct = zoneProducts.find(
      (product) => product.product_id !== misplacedSample?.product_id
    ) || zoneProducts[0];
    const matchEpcs = Array.isArray(matchProduct?.epcs) && matchProduct.epcs.length > 0
      ? matchProduct.epcs
      : zoneEpcs.slice(0, 1);
    const simulatedEpcs = misplacedSample?.epc
      ? [...matchEpcs, misplacedSample.epc]
      : matchEpcs;

    // Membuat sesi Stock Opname di backend
    const session = await apiRequest('/stocktake/sessions', {
      method: 'POST',
      body: JSON.stringify({
        zone_code: selectedZone,
        scanner_device: 'WEB-SIMULATION',
      }),
    });

    console.log('Sesi Stock Opname berhasil dibuat:', session);
    setSessionId(session.data.id);
    setSessionCode(session.data.session_code);
    const activeSessionId = session.data.id;

    // Menjalankan simulasi tampilan pemindaian
    setScanning(true);
    setScanProgress(0);
    setScannedCount(0);

    let step = 0;

    const interval = setInterval(() => {
      step += 1;
      setScannedCount(step);
      setScanProgress(Math.round((step / simulatedEpcs.length) * 100));

      if (step >= simulatedEpcs.length) {
        clearInterval(interval);

        
setTimeout(async () => {
  setScanning(false);

  try {
    const result = await submitScanResults(
      simulatedEpcs,
      activeSessionId
    );

    console.log('Detail hasil audit:', result);
   setAuditResult(result);

buildDiscrepancyTable(result);
    await fetchSessions();

    showNotification?.(
      misplacedSample?.epc
        ? `Demo Zona ${selectedZone} selesai: EPC zona ${misplacedSample.zone_code} disimulasikan sebagai Salah Zona.`
        : `Simulasi EPC Zona ${selectedZone} selesai direkonsiliasi backend.`,
      'success'
    );
  } catch (err) {
    console.error('Rekonsiliasi gagal:', err);
  }
}, 400);

      }
    }, 300);

  } catch (err) {
    console.error('Gagal membuat sesi Stock Opname:', err);

    showNotification?.(
      err.message || 'Gagal membuat sesi Stock Opname',
      'error'
    );
  }
};

  
const handleApproveAdjustment = async () => {
  if (!selectedApprovalSession?.session_code) {
  showNotification?.(
    'Pilih sesi Stock Opname terlebih dahulu.',
    'error'
  );
  return;
}

if (selectedApprovalSession.status !== 'COMPLETED_PENDING_APPROVAL') {
  showNotification?.(
    'Sesi ini tidak sedang menunggu persetujuan.',
    'error'
  );
  return;
}

  try {
    const result = await apiRequest('/stocktake/approve', {
      method: 'POST',
      body: JSON.stringify({
        session_code: selectedApprovalSession.session_code,
      }),
    });

    showNotification?.(
  result.total_adjustments === 0
    ? 'Stock Opname berhasil disetujui. Tidak ada penyesuaian jumlah stok.'
    : result.message || 'Persetujuan stock opname berhasil.',
  'success'
);

    console.log('Hasil persetujuan Stock Opname:', result);

    await fetchProducts();
    await fetchSessions();
    setSelectedApprovalSession(null);
    setDiscrepancyRows([]);
  } catch (err) {
    console.error('Gagal menyetujui Stock Opname:', err);

    showNotification?.(
      err.message || 'Gagal memproses persetujuan Stock Opname.',
      'error'
    );
  }
};

  const testGateSimulation = async (mode) => {
    const nowIso = new Date().toISOString();
    const nowStr = new Date().toLocaleTimeString('id-ID');
    if (mode === 'authorized') {
      setGateStatus('AMAN');
      setGateIncidents((prev) => [
        {
          eventTime: nowIso,
          time: `Hari ini ${nowStr}`,
          epc: 'E280-1160-2000-042E',
          name: 'Gaming Headset 7.1 (Gate Pass Valid)',
          antenna: 'Antena 1 & 2 (Keluar)',
          rssi: '-51 dBm',
          status: 'Authorized Out',
          action: 'Lolos Verifikasi',
        },
        ...prev,
      ]);
      showNotification?.('Gate Pass SAH: Lampu Hijau menyala, barang diizinkan keluar.', 'success');
    } else if (mode === 'unauthorized') {
      setGateStatus('ALARM');
      playSirenBeep();
      const illegalEpc = 'E280-6894-0000-991A';
      setGateIncidents((prev) => [
        {
          eventTime: nowIso,
          time: `Hari ini ${nowStr}`,
          epc: illegalEpc,
          name: 'Mouse Wireless Logi (TANPA SURAT JALAN)',
          antenna: 'Antena 1 (Pintu Utama)',
          rssi: '-44 dBm',
          status: 'ILLEGAL / UNPAID',
          action: 'SIRINE & RELAY AKTIF',
        },
        ...prev,
      ]);
      // Publish ke EMQX via Backend
      fetch(`${API_BASE_URL}/mqtt/test-publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'digiwms/rfid/gate-alarm',
          payload: {
            epc_code: illegalEpc,
            gate_id: 'GATE-EXIT-01',
            rssi: -44,
            alert: 'UNAUTHORIZED_EXIT',
          },
        }),
      }).catch(() => {});
      showNotification?.(
        'PERINGATAN! Barang keluar tanpa izin terdeteksi di Gerbang RFID!',
        'error'
      );
    } else {
      setGateStatus('CROSSREAD');
      setGateIncidents((prev) => [
        {
          eventTime: nowIso,
          time: `Hari ini ${nowStr}`,
          epc: 'E280-1160-2000-012A',
          name: 'Barang di Rak Dekat Pintu (Sinyal Lemah)',
          antenna: 'Antena 2 (Dalam)',
          rssi: '-76 dBm',
          status: 'Cross-Read Filtered',
          action: 'Diabaikan (< -65 dBm)',
        },
        ...prev,
      ]);
      showNotification?.(
        'Sinyal lemah (-76 dBm) dari rak dekat pintu berhasil diredam oleh algoritma RSSI.',
        'info'
      );
    }
  };

  // ============================================================================
  // MENU 1: SIMULASI OPNAME HANDHELD (Persis Template Awal digiwms.html)
  // ============================================================================
  if (activeMenu === 'rfid-opname') {
    return (
      <div className="space-y-6">
        <div
          data-tour="opname-gate-header"
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card text-card-foreground p-6 rounded-2xl border border-border shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">
                  Opname Handheld RFID
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Mode demo memakai EPC contoh dan progres animasi. Untuk audit fisik, scan tag dari aplikasi handheld.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              disabled={zonesLoading || opnameZones.length === 0 || scanning}
              className="px-3.5 py-2.5 bg-muted/50 border border-border rounded-xl text-sm font-medium focus:outline-none"
            >
              {zonesLoading && <option value="">Memuat zona...</option>}
              {!zonesLoading && opnameZones.length === 0 && (
                <option value="">Zona tidak tersedia</option>
              )}
              {opnameZones.map((zone) => (
                <option key={zone.code} value={zone.code}>
                  Zona {zone.code} · {zone.totalExpected} item{zone.label ? ` · ${zone.label}` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={runHandheldOpnameSimulation}
              disabled={scanning || zonesLoading || !selectedZone}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-2"
            >
              <span>📡</span>
              <span>{scanning ? 'Menjalankan demo...' : 'Jalankan Simulasi Demo'}</span>
            </button>
          </div>
        </div>

        {/* Handheld Reader Live Status Widget */}
        {(scanning || scanProgress > 0) && (
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center space-x-4">
                <div className="relative w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  {scanning && (
                    <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400 radar-sweep"></div>
                  )}
                  <span className="text-2xl">🔫</span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">
                    {scanning
                      ? 'Memindai Gelombang Radio UHF...'
                      : `Pemindaian Zona ${selectedZone} Selesai`}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Mode perangkat:{' '}
                    <span className="text-emerald-400 font-mono">
                      Simulasi EPC (tanpa pembaca fisik)
                    </span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center w-full md:w-auto">
                <div className="bg-slate-800 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">EPC contoh terkirim</span>
                  <span className="text-2xl font-bold text-emerald-400">{scannedCount}</span>
                </div>
                <div className="bg-slate-800 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Target zona</span>
                  <span className="text-2xl font-bold text-white">
                    {opnameZones.find((zone) => zone.code === selectedZone)?.totalExpected ?? 0}
                    <span className="text-xs text-slate-400"> item</span>
                  </span>
                </div>
                <div className="bg-slate-800 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block">Mode</span>
                  <span className="text-2xl font-bold text-blue-400">DEMO</span>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Kemajuan Pemindaian Zona {selectedZone}</span>
                <span>{scanProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${scanProgress}%` }}
                  className="bg-emerald-500 h-full transition-all duration-300"
                ></div>
              </div>
            </div>
          </div>
        )}


{/* Daftar Sesi Stock Opname */}
<div className="bg-card text-card-foreground rounded-2xl border border-border shadow-sm overflow-hidden">
  <div className="p-5 border-b border-border">
    <h3 className="font-bold text-foreground">
      Riwayat Sesi Stock Opname
    </h3>
    <p className="text-xs text-muted-foreground mt-1">
      Pilih sesi yang menunggu persetujuan supervisor.
    </p>
  </div>

  <div className="divide-y divide-border">
    {sessions.filter(
      (session) =>
        session.status === 'COMPLETED_PENDING_APPROVAL'
    ).length === 0 ? (
      <div className="p-5 text-sm text-muted-foreground text-center">
        Tidak ada sesi yang menunggu persetujuan.
      </div>
    ) : (
      sessions
        .filter(
          (session) =>
            session.status === 'COMPLETED_PENDING_APPROVAL'
        )
        .map((session) => (
          <div
            key={session.id}
            className="p-4 flex flex-col sm:flex-row justify-between gap-3"
          >
            <div>
              <p className="font-bold text-sm text-foreground">
                {session.session_code}
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                Zona {session.zone_code} ·{' '}
                {new Date(session.created_at).toLocaleString('id-ID')}
              </p>

              <p className="text-xs text-muted-foreground mt-2">
                Matched: {session.matched_count || 0} ·
                Missing: {session.missing_count || 0} ·
                Salah Zona: {session.misplaced_count || 0}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold">
                Menunggu Persetujuan
              </span>

              <button
                onClick={() => handleSelectApprovalSession(session)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                  selectedApprovalSession?.id === session.id
                    ? 'bg-blue-700 text-white'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                {selectedApprovalSession?.id === session.id
                  ? 'Sesi Dipilih'
                  : 'Lihat Hasil'}
              </button>
            </div>
          </div>
        ))
    )}
  </div>
</div>


        {/* Opname Discrepancy Results Table */}
        <div
          data-tour="opname-gate-main"
          className="bg-card text-card-foreground rounded-2xl border border-border shadow-sm overflow-hidden"
        >
          <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-foreground text-base">
                Hasil Audit Selisih (Discrepancy Analysis)
              </h3>
              <p className="text-xs text-muted-foreground">
                Perbandingan data sistem terhadap hasil pemindaian handheld terakhir.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleApproveAdjustment}
              disabled={!selectedApprovalSession || selectedApprovalSession.status !== 'COMPLETED_PENDING_APPROVAL'}
            >
              <CheckCircle2 className="h-4 w-4" />
              Setujui Penyesuaian ke Ledger
            </Button>
          </div>
          <div className="p-4">
            <DataTable
              data={discrepancyRows}
              columns={[
                {
                  accessorKey: 'name',
                  header: 'SKU / Nama Barang',
                  cell: ({ row }) => (
                    <div>
                      <p className="font-medium text-foreground">{row.original.name}</p>
                      <span className="text-[11px] font-mono text-muted-foreground">{row.original.sku}</span>
                    </div>
                  ),
                },
                { accessorKey: 'location', header: 'Lokasi Sistem' },
                {
                  accessorKey: 'systemStock',
                  header: 'Stok Sistem',
                  cell: ({ row }) => <span className="font-semibold">{row.original.systemStock} Unit</span>,
                },
                {
                  accessorKey: 'scannedStock',
                  header: 'Hasil Scan RFID',
                  cell: ({ row }) => <span className="font-semibold">{row.original.scannedStock} Unit</span>,
                },
                {
                  accessorKey: 'diff',
                  header: 'Selisih',
                  cell: ({ row }) => (
                    <span
                      className={`font-bold ${
                        row.original.diff === 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-destructive'
                      }`}
                    >
                      {row.original.diff > 0 ? `+${row.original.diff}` : row.original.diff}
                    </span>
                  ),
                },
                { accessorKey: 'diagnosis', header: 'Diagnosa Audit' },
                {
                  id: 'auditStatus',
                  header: 'Status',
                  accessorFn: (row) =>
                    row.type === 'MISPLACED'
                      ? 'SALAH_ZONA'
                      : row.diff === 0
                      ? 'MATCHED'
                      : 'REKONSILIASI',
                  cell: ({ row }) => {
                    const r = row.original;
                    return (
                      <Badge
                        variant={
                          r.type === 'MISPLACED'
                            ? 'warning'
                            : r.diff === 0
                            ? 'success'
                            : 'destructive'
                        }
                      >
                        {r.type === 'MISPLACED'
                          ? 'Salah Zona'
                          : r.diff === 0
                          ? 'Matched'
                          : 'Perlu Rekonsiliasi'}
                      </Badge>
                    );
                  },
                },
              ]}
              searchPlaceholder="Cari SKU, barang, atau lokasi..."
              initialSorting={[{ id: 'diff', desc: false }]}
              filters={[
                {
                  key: 'auditStatus',
                  label: 'Status',
                  getValue: (r) =>
                    r.type === 'MISPLACED'
                      ? 'SALAH_ZONA'
                      : r.diff === 0
                      ? 'MATCHED'
                      : 'REKONSILIASI',
                  options: [
                    { value: 'MATCHED', label: 'Matched' },
                    { value: 'REKONSILIASI', label: 'Perlu Rekonsiliasi' },
                    { value: 'SALAH_ZONA', label: 'Salah Zona' },
                  ],
                },
              ]}
              emptyMessage="Belum ada data perbandingan opname."
            />

          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MENU 2: GATE ALARM & KEAMANAN LIVE (Persis Template Awal digiwms.html)
  // ============================================================================
  return (
    <div className="space-y-6">
      <div
        data-tour="opname-gate-header"
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card text-card-foreground p-6 rounded-2xl border border-border shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
            <Siren className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Gate & Alarm Live
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sistem pencegah kehilangan berbasis pembacaan tag pada pintu gerbang gudang (Fixed Reader + Relay GPIO).
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {gateStatus === 'ALARM' && (
            <button
              onClick={() => setGateStatus('AMAN')}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all flex items-center space-x-2"
            >
              <span>🔇</span>
              <span>Matikan Sirine</span>
            </button>
          )}
          <span className="bg-emerald-50 text-emerald-700 text-xs px-3 py-1.5 rounded-xl font-semibold border border-emerald-200 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Reader Gate: Online</span>
          </span>
        </div>
      </div>

      {/* Interactive Gate Strobe Visualization Box */}
      <div
        data-tour="opname-gate-main"
        className={`bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl border-4 transition-all duration-300 relative overflow-hidden ${
          gateStatus === 'ALARM'
            ? 'border-rose-500 animate-strobe-red'
            : 'border-slate-700'
        }`}
      >
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Gate Physical Illustration */}
          <div className="flex items-center space-x-6 sm:space-x-10">
            {/* Antena Kiri */}
            <div className="flex flex-col items-center">
              <div className="w-8 sm:w-10 h-44 bg-gradient-to-b from-slate-600 to-slate-800 rounded-xl border border-slate-500 flex flex-col justify-around items-center py-3 shadow-lg">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                <span className="text-[9px] font-bold text-slate-400 rotate-90">ANT-01</span>
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              </div>
              <span className="text-[10px] text-slate-400 mt-2 font-medium">Antena Luar</span>
            </div>

            {/* Area Tengah Gerbang / Lampu Strobo */}
            <div className="flex flex-col items-center text-center">
              <div
                className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 flex flex-col items-center justify-center shadow-2xl transition-all duration-300 text-4xl ${
                  gateStatus === 'ALARM'
                    ? 'border-rose-500 bg-rose-500/30 animate-bounce'
                    : 'border-emerald-500 bg-emerald-500/20'
                }`}
              >
                {gateStatus === 'ALARM' ? '🚨' : '🛡️'}
              </div>
              <h3
                className={`text-lg font-bold mt-3 tracking-wide ${
                  gateStatus === 'ALARM' ? 'text-rose-300' : 'text-emerald-400'
                }`}
              >
                {gateStatus === 'ALARM'
                  ? 'ALARM SIRINE AKTIF: BARANG ILEGAL!'
                  : 'STATUS: AMAN'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {gateStatus === 'ALARM'
                  ? 'Tag keluar tanpa Gate Pass terdeteksi! Relay GPIO mengunci pintu.'
                  : 'Gerbang siaga. Tidak ada barang ilegal terdeteksi.'}
              </p>
            </div>

            {/* Antena Kanan */}
            <div className="flex flex-col items-center">
              <div className="w-8 sm:w-10 h-44 bg-gradient-to-b from-slate-600 to-slate-800 rounded-xl border border-slate-500 flex flex-col justify-around items-center py-3 shadow-lg">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                <span className="text-[9px] font-bold text-slate-400 rotate-90">ANT-02</span>
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              </div>
              <span className="text-[10px] text-slate-400 mt-2 font-medium">Antena Dalam</span>
            </div>
          </div>

          {/* Interactive Simulation Test Bench */}
          <div className="w-full lg:w-96 bg-slate-950/70 p-5 rounded-2xl border border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              🎮 Uji Coba Lapangan (Simulator)
            </h4>
            <div className="space-y-2.5">
              <button
                onClick={() => testGateSimulation('authorized')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-between transition-all"
              >
                <span>✅ Barang Keluar SAH (Gate Pass)</span>
                <span className="text-[10px] bg-emerald-800 px-2 py-0.5 rounded">Hijau</span>
              </button>

              <button
                onClick={() => testGateSimulation('unauthorized')}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-between shadow-lg shadow-rose-600/30 transition-all"
              >
                <span>⚠️ Barang Keluar ILEGAL (Pencurian)</span>
                <span className="text-[10px] bg-rose-800 px-2 py-0.5 rounded font-bold">
                  ALARM SIRINE
                </span>
              </button>

              <button
                onClick={() => testGateSimulation('crossread')}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-between transition-all"
              >
                <span>🛡️ Filter Cross-Read (Rak Dekat Pintu)</span>
                <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded">RSSI Redam</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Incident & Gate Events Log Table (TanStack DataTable) */}
      <div className="space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <h3 className="font-semibold text-base tracking-tight">
              Log Kejadian Gerbang & Alarm (Incident Log)
            </h3>
            <p className="text-xs text-muted-foreground">
              Riwayat waktu nyata pembacaan antena gerbang dan pemicuan relay.
            </p>
          </div>
          <Badge variant="outline">Otomatis terhubung ke EMQX & CCTV</Badge>
        </div>

        <DataTable
          data={gateIncidents}
          columns={[
            {
              id: 'eventTime',
              header: 'Waktu Event',
              accessorFn: (row) => (row.eventTime ? new Date(row.eventTime).getTime() : 0),
              cell: ({ row }) => (
                <span className="font-mono text-muted-foreground whitespace-nowrap">
                  {row.original.time}
                </span>
              ),
            },
            {
              accessorKey: 'epc',
              header: 'EPC Tag',
              cell: ({ row }) => <span className="font-mono font-semibold">{row.original.epc}</span>,
            },
            {
              accessorKey: 'name',
              header: 'Barang / Deskripsi',
              cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
            },
            { accessorKey: 'antenna', header: 'Antena Gerbang' },
            {
              accessorKey: 'rssi',
              header: 'Sinyal (RSSI)',
              cell: ({ row }) => <span className="font-mono">{row.original.rssi}</span>,
            },
            {
              accessorKey: 'status',
              header: 'Status Otorisasi',
              cell: ({ row }) => {
                const st = String(row.original.status || '');
                return (
                  <Badge
                    variant={
                      st.includes('ILLEGAL')
                        ? 'destructive'
                        : st.includes('Authorized')
                        ? 'success'
                        : 'secondary'
                    }
                  >
                    {st}
                  </Badge>
                );
              },
            },
            {
              accessorKey: 'action',
              header: 'Tindakan Keamanan',
              cell: ({ row }) => <span className="font-medium">{row.original.action}</span>,
            },
          ]}
          searchPlaceholder="Cari EPC, barang, antena..."
          dateField="eventTime"
          initialSorting={[{ id: 'eventTime', desc: true }]}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: [...new Set(gateIncidents.map((i) => i.status).filter(Boolean))].map((v) => ({ value: v, label: v })),
            },
          ]}
          emptyMessage="Belum ada log kejadian gerbang."
        />
      </div>
    </div>
  );
}
