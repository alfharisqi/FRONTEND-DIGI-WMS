import React, { useState, useEffect } from 'react';
import { Ban, CheckCircle2, Printer, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function GateSecurityPage({
  switchTab,
  lastEvent,
  mqttConnected,
  currentUser,
  showNotification,
}) {
  // State Utama
  const [gatePasses, setGatePasses] = useState([]);
  const [gateEvents, setGateEvents] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL'); // ALL, ACTIVE, USED, EXPIRED
  const [searchQuery, setSearchQuery] = useState('');

  // State Scanner & Verifikasi Cepat
  const [inputCode, setInputCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [confirmingExit, setConfirmingExit] = useState(false);

  // State Modal Cetak Gate Pass
  const [selectedPassForPrint, setSelectedPassForPrint] = useState(null);

  // State Modal Terbitkan Gate Pass Manual
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    reference_resi: '',
    reference_type: 'OUTBOUND_SHIPMENT',
    customer_or_destination: '',
    courier: 'JNE Express',
    epc_list: '',
    valid_hours: 24,
  });

  // State Alarm Darurat (Breach)
  const [simulatingBreach, setSimulatingBreach] = useState(false);

  // State Modal Pembatalan Gate Pass (REVOKED)
  const [passToCancel, setPassToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // State EPC Siap Lewat Gerbang (Dari Meja Packing & Meja Kasir POS)
  const [readyEpcs, setReadyEpcs] = useState([]);
  const [inStockEpcs, setInStockEpcs] = useState([]);
  const [scanningEpc, setScanningEpc] = useState(false);

  // 1. Fetch Data Gate Passes, Gate Events & Available Tags
  const fetchData = async () => {
    try {
      setLoading(true);
      const [gpRes, geRes, tagsRes, readyRes] = await Promise.all([
        fetch(`${API_BASE_URL}/gate-passes`),
        fetch(`${API_BASE_URL}/gate/events?limit=10`),
        fetch(`${API_BASE_URL}/tags`).catch(() => null),
        fetch(`${API_BASE_URL}/gate/ready-epcs`).catch(() => null),
      ]);
      const gpJson = await gpRes.json();
      const geJson = await geRes.json();
      const tagsJson = tagsRes ? await tagsRes.json().catch(() => ({})) : {};
      const readyJson = readyRes ? await readyRes.json().catch(() => ({})) : {};

      setGatePasses(gpJson.data || []);
      setGateEvents(geJson.data || []);
      setReadyEpcs(Array.isArray(readyJson.data?.ready) ? readyJson.data.ready : []);
      setInStockEpcs(Array.isArray(readyJson.data?.in_stock) ? readyJson.data.in_stock : []);
      const rawTags = Array.isArray(tagsJson.data) ? tagsJson.data : [];
      setAvailableTags(
        rawTags.filter((t) => ['IN_STOCK', 'RESERVED'].includes(String(t.status || '').toUpperCase()))
      );
    } catch (err) {
      console.error('Gagal mengambil data Gate Pass & Security:', err);
      showNotification?.('Gagal memuat data gerbang keamanan dari server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Tangkap event real-time dari MQTT jika ada
  useEffect(() => {
    if (
      lastEvent?.event === 'GATE_PASS_GENERATED' ||
      lastEvent?.event === 'GATE_EXIT_CONFIRMED' ||
      lastEvent?.event === 'GATE_PASS_REVOKED'
    ) {
      fetchData();
    }
    if (lastEvent?.event === 'SECURITY_BREACH_ALARM') {
      showNotification?.(
        `🚨 PERINGATAN DARURAT: Deteksi barang tanpa izin keluar di ${lastEvent.gate_id || 'Gerbang'}!`,
        'error'
      );
      fetchData();
    }
  }, [lastEvent]);

  // 2. Handler Scan Gerbang Cerdas (Mendukung EPC Barang Langsung ATAU Nomor Gate Pass)
  const handleDirectEpcGateScan = async (epcToScan) => {
    const epc = String(epcToScan || inputCode || '').trim();
    if (!epc) {
      showNotification?.('Silakan pilih atau tempel kode EPC RFID barang!', 'warn');
      return;
    }

    setScanningEpc(true);
    setVerifying(true);
    try {
      const res = await fetch(`${API_BASE_URL}/gate/scan-epc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epc,
          gate_id: 'GATE-01',
          antenna_info: 'Antena 1 & 2 (Portal Gerbang RFID)',
          rssi: '-48 dBm',
          operator_name: currentUser?.full_name || 'Sensor Antena Gerbang RFID',
        }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        showNotification?.(json.message, 'success');
        setVerificationResult({
          status: 'ok',
          is_valid: true,
          verification_status: 'AUTHORIZED',
          message: json.message,
          data: json.data?.gate_pass || {
            pass_code: 'OTOMATIS VIA EPC',
            reference_resi: json.data?.reference_doc || '-',
            customer_or_destination: json.data?.product_name || epc,
            courier: 'Sensor Antena Gerbang RFID',
          },
        });
      } else if (res.status === 403 || json.alarm_triggered) {
        showNotification?.(json.message, 'error');
        setVerificationResult({
          status: 'error',
          is_valid: false,
          verification_status: 'ALARM BREACH (BELUM BAYAR / BELUM PACKING)',
          message: json.message,
          data: {
            pass_code: 'TANPA IZIN',
            reference_resi: json.data?.tag_status || 'IN_STOCK',
            customer_or_destination: json.data?.product_name || epc,
            courier: 'GERBANG DIKUNCI & SIRINE AKTIF',
          },
        });
      } else {
        showNotification?.(json.message || 'Gagal memindai EPC di gerbang', 'warn');
        setVerificationResult({
          status: 'warn',
          is_valid: false,
          verification_status: json.gate_action || 'DITOLAK',
          message: json.message,
        });
      }
      await fetchData();
    } catch (err) {
      console.error('Error direct EPC gate scan:', err);
      showNotification?.('Gagal menghubungi sensor gerbang di server', 'error');
    } finally {
      setScanningEpc(false);
      setVerifying(false);
    }
  };

  const handleVerifyPass = async (codeToVerify) => {
    const code = (codeToVerify || inputCode).trim();
    if (!code) {
      showNotification?.('Silakan masukkan kode EPC Barang atau Nomor Gate Pass!', 'warn');
      return;
    }

    const upper = code.toUpperCase();
    const looksLikeGatePassOrDoc =
      upper.startsWith('GP-') ||
      upper.startsWith('POS-') ||
      upper.startsWith('RESI-') ||
      upper.startsWith('ORD-');

    if (!looksLikeGatePassOrDoc) {
      return handleDirectEpcGateScan(code);
    }

    setVerifying(true);
    setVerificationResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/gate-passes/${encodeURIComponent(code)}/verify`);
      const json = await res.json();
      setVerificationResult(json);

      if (json.is_valid && json.verification_status === 'AUTHORIZED') {
        showNotification?.(json.message || 'Gate Pass SAH & AKTIF!', 'success');
      } else {
        showNotification?.(json.message || 'Pemeriksaan izin keluar: DITOLAK / TIDAK VALID', 'warn');
      }
    } catch (err) {
      console.error('Error verifying gate pass:', err);
      setVerificationResult({
        status: 'error',
        is_valid: false,
        verification_status: 'NETWORK_ERROR',
        message: 'Gagal menghubungi server backend untuk verifikasi.',
      });
      showNotification?.('Koneksi verifikasi gagal ke server!', 'error');
    } finally {
      setVerifying(false);
    }
  };

  // 3. Handler Konfirmasi Scan-Out (Izinkan Barang Keluar)
  const handleConfirmExit = async (passCode) => {
    if (!passCode) return;
    setConfirmingExit(true);

    try {
      const res = await fetch(`${API_BASE_URL}/gate-passes/${encodeURIComponent(passCode)}/scan-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gate_id: 'GATE-01',
          antenna_info: 'Antena Portal Keluar (1 & 2)',
          rssi: '-52 dBm',
          operator_name: currentUser?.full_name || 'Petugas Keamanan Satpam',
        }),
      });

      const json = await res.json();
      if (res.ok) {
        showNotification?.(json.message || 'Barang resmi diizinkan melintasi gerbang!', 'success');
        // Refresh verifikasi hasil scan
        setVerificationResult({
          status: 'warn',
          is_valid: false,
          verification_status: 'ALREADY_USED',
          message: `BARANG TELAH RESMI KELUAR! Status Gate Pass ${passCode} kini diubah menjadi: USED.`,
          data: json.data,
        });
        fetchData();
      } else {
        showNotification?.(json.message || 'Gagal konfirmasi keluar gerbang', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification?.('Terjadi kesalahan saat memproses scan out', 'error');
    } finally {
      setConfirmingExit(false);
    }
  };

  // 3B. Handler Pembatalan Gate Pass (Status ACTIVE -> REVOKED)
  const handleCancelGatePass = async (e) => {
    e.preventDefault();
    if (!passToCancel?.pass_code) return;
    setCancelling(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/gate-passes/${encodeURIComponent(passToCancel.pass_code)}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: cancelReason.trim() || 'Dibatalkan oleh petugas keamanan gerbang',
            cancelled_by: currentUser?.full_name || 'Petugas Keamanan Gerbang',
          }),
        }
      );

      const json = await res.json();
      if (res.ok) {
        showNotification?.(
          json.message || `Gate Pass ${passToCancel.pass_code} berhasil dibatalkan.`,
          'warn'
        );
        if (verificationResult?.data?.pass_code === passToCancel.pass_code) {
          setVerificationResult({
            status: 'warn',
            is_valid: false,
            verification_status: 'REVOKED',
            message: `PERINGATAN: Gate Pass ${passToCancel.pass_code} telah dibatalkan (REVOKED)! Izin keluar ditolak.`,
            data: json.data,
          });
        }
        setPassToCancel(null);
        setCancelReason('');
        fetchData();
      } else {
        showNotification?.(json.message || 'Gagal membatalkan Gate Pass', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification?.('Terjadi kesalahan jaringan saat membatalkan Gate Pass', 'error');
    } finally {
      setCancelling(false);
    }
  };

  // 4. Handler Terbitkan Gate Pass Manual (Modal Generator)
  const handleGenerateGatePass = async (e) => {
    e.preventDefault();
    if (!generateForm.reference_resi) {
      showNotification?.('Nomor Resi / Dokumen wajib diisi!', 'warn');
      return;
    }

    setGenerating(true);
    try {
      const epcArray = generateForm.epc_list
        ? [...new Set(generateForm.epc_list.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean))]
        : [];

      const res = await fetch(`${API_BASE_URL}/gate-passes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_resi: generateForm.reference_resi,
          reference_type: generateForm.reference_type,
          customer_or_destination: generateForm.customer_or_destination,
          courier: generateForm.courier,
          epc_list: epcArray,
          valid_hours: Number(generateForm.valid_hours) || 24,
          authorized_by: currentUser?.id || null,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        showNotification?.(json.message || 'Gate Pass resmi berhasil diterbitkan!', 'success');
        setShowGenerateModal(false);
        setGenerateForm({
          reference_resi: '',
          reference_type: 'OUTBOUND_SHIPMENT',
          customer_or_destination: '',
          courier: 'JNE Express',
          epc_list: '',
          valid_hours: 24,
        });
        fetchData();
        // Langsung masukkan ke scanner untuk kemudahan demo
        if (json.data?.pass_code) {
          setInputCode(json.data.pass_code);
          handleVerifyPass(json.data.pass_code);
        }
      } else {
        showNotification?.(json.message || 'Gagal menerbitkan Gate Pass', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification?.('Terjadi kesalahan jaringan saat menerbitkan Gate Pass', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // 5. Handler Uji Simulasi Alarm Breach (Anti-Theft)
  const handleTriggerAlarmBreach = async () => {
    if (!window.confirm('Simulasikan deteksi barang tanpa izin keluar (Anti-Theft Breach Test)?')) {
      return;
    }
    setSimulatingBreach(true);
    try {
      const randomEpc = `E280-UNAUTH-${Math.floor(1000 + Math.random() * 9000)}`;
      const res = await fetch(`${API_BASE_URL}/gate/alarm-breach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epc: randomEpc,
          item_name: 'Barang Tanpa Pas Jalan Sah (Uji Anti-Theft)',
          gate_id: 'GATE-01',
          antenna_info: 'Antena 1 (Gerbang Keluar)',
          rssi: '-45 dBm',
          notes: 'Deteksi uji anti-pencurian: Tag RFID melintasi gerbang tanpa status AUTHORIZED_OUT',
        }),
      });
      const json = await res.json();
      showNotification?.(json.message || '🚨 SIRENE DARURAT DIAKTIFKAN: Deteksi barang tanpa izin keluar!', 'error');
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSimulatingBreach(false);
    }
  };

  // Filter & Search Gate Passes
  const filteredGatePasses = gatePasses.filter((gp) => {
    const statusUpper = String(gp.status || '').toUpperCase();
    if (activeFilter !== 'ALL' && statusUpper !== activeFilter) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const codeMatch = String(gp.pass_code || '').toLowerCase().includes(q);
      const resiMatch = String(gp.reference_resi || '').toLowerCase().includes(q);
      const destMatch = String(gp.customer_or_destination || '').toLowerCase().includes(q);
      const courierMatch = String(gp.courier || '').toLowerCase().includes(q);
      return codeMatch || resiMatch || destMatch || courierMatch;
    }
    return true;
  });

  // Hitung Metrik Ringkas (100% Real dari Database)
  const totalActive = gatePasses.filter((g) => String(g.status).toUpperCase() === 'ACTIVE').length;
  const totalUsed = gatePasses.filter((g) => String(g.status).toUpperCase() === 'USED').length;
  const totalUnauthorized = gateEvents.filter(
    (e) => String(e.authorization_status).toUpperCase() === 'UNAUTHORIZED'
  ).length;

  return (
    <div className="space-y-6">
      {/* ================= HEADER SECTION ================= */}
      <div
        data-tour="gate-security-header"
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Portal Keamanan Gerbang & Gate Pass
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pemeriksaan otorisasi digital pas jalan (Gate Pass), validasi RFID anti-theft sebelum kendaraan keluar, dan pencatatan audit gerbang.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-600/20 transition inline-flex items-center space-x-1.5"
          >
            <span>➕</span>
            <span>Terbitkan Gate Pass Manual</span>
          </button>
          <button
            onClick={handleTriggerAlarmBreach}
            disabled={simulatingBreach}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-semibold shadow-sm transition inline-flex items-center space-x-1.5"
            title="Simulasikan Barang Tanpa Izin Melintas Portal"
          >
            <span>🚨</span>
            <span>{simulatingBreach ? 'Memproses...' : 'Uji Alarm Breach'}</span>
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            title="Muat Ulang Data"
          >
            🔄
          </button>
        </div>
      </div>

      {/* ================= 3 KPI STATS CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gate Pass Aktif</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-black text-emerald-600">{totalActive}</span>
              <span className="text-xs text-slate-500">Izin Sah Siap Keluar</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-2xl text-emerald-600">
            ✅
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Telah Keluar (Used)</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-black text-slate-700">{totalUsed}</span>
              <span className="text-xs text-slate-500">Tercatat Melintasi Gerbang</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl text-slate-600">
            🚚
          </div>
        </div>

        <div
          className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between ${
            totalUnauthorized > 0
              ? 'bg-rose-50/70 border-rose-200'
              : 'bg-white border-slate-200/80'
          }`}
        >
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Portal Keamanan</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span
                className={`text-base font-bold ${
                  totalUnauthorized > 0 ? 'text-rose-700' : 'text-slate-900'
                }`}
              >
                {totalUnauthorized > 0 ? 'WASPADA BREACH' : 'SIAGA NORMAL'}
              </span>
              <span
                className={`text-xs font-semibold ${
                  totalUnauthorized > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {totalUnauthorized > 0 ? `• ${totalUnauthorized} Insiden` : '• 100% Aman'}
              </span>
            </div>
          </div>
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
              totalUnauthorized > 0 ? 'bg-rose-100 text-rose-600' : 'bg-blue-50 text-blue-600'
            }`}
          >
            {totalUnauthorized > 0 ? '🚨' : '🛡️'}
          </div>
        </div>
      </div>

      {/* ================= CORE VERIFICATION SCANNER ================= */}
      <div
        data-tour="gate-security-scanner"
        className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
      >
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">📡</span>
            <div>
              <h2 className="text-sm font-bold tracking-wide uppercase">Sensor Antena Gerbang RFID Otomatis (Langsung Baca EPC Barang)</h2>
              <p className="text-[11px] text-slate-400">Klik 1x pada EPC barang dari Meja Packing / Meja Kasir di bawah untuk langsung melewati gerbang keluar!</p>
            </div>
          </div>
          <span className="text-xs font-mono bg-emerald-950 text-emerald-400 px-3 py-1 rounded-lg border border-emerald-700">
            MODE: AUTO EPC GATE READER
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* PANEL 1-KLIK: BARANG DARI MEJA PACKING & MEJA KASIR YANG SIAP LEWAT GERBANG */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Kolom Kiri: Barang SAH dari Meja Packing & Meja Kasir */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🟢</span>
                  <div>
                    <h3 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wide">
                      Barang Siap Keluar (Dari Packing & Kasir POS)
                    </h3>
                    <p className="text-[11px] text-emerald-700">
                      Status: <code className="font-bold">AUTHORIZED_OUT</code> — Klik untuk lewat gerbang (Lampu Hijau)
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white">
                  {readyEpcs.length} Unit
                </span>
              </div>

              {readyEpcs.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/80 border border-emerald-100 text-center text-xs text-slate-500">
                  Belum ada barang di meja Packing / Kasir yang menunggu keluar gerbang.
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    (Selesaikan Packing atau Checkout Kasir POS terlebih dahulu)
                  </span>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {readyEpcs.map((item) => (
                    <div
                      key={item.epc}
                      className="p-3 rounded-xl bg-white border border-emerald-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs text-slate-900">{item.epc}</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {item.source_channel === 'MEJA_KASIR_POS'
                              ? '🛒 Meja Kasir POS'
                              : item.source_channel === 'MEJA_PACKING'
                              ? '📦 Meja Packing'
                              : '🚚 Pengiriman'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate">
                          {item.sku} — {item.product_name}
                          {item.reference_doc ? ` (${item.reference_doc})` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={scanningEpc}
                        onClick={() => {
                          setInputCode(item.epc);
                          handleDirectEpcGateScan(item.epc);
                        }}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition shrink-0 flex items-center justify-center gap-1.5"
                      >
                        <span>🚶‍♂️</span>
                        <span>Lewati Gerbang (Keluar)</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Kolom Kanan: Uji Barang di Rak (Belum Bayar / Belum Packing -> Akan Bunyi Alarm!) */}
            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🚨</span>
                  <div>
                    <h3 className="text-xs font-extrabold text-rose-950 uppercase tracking-wide">
                      Simulasi Barang Rak Lewat Tanpa Izin (Anti-Maling)
                    </h3>
                    <p className="text-[11px] text-rose-700">
                      Status: <code className="font-bold">IN_STOCK / RESERVED</code> — Jika lewat gerbang, Sirine Alarm menyala!
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white">
                  {inStockEpcs.length} Unit
                </span>
              </div>

              {inStockEpcs.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/80 border border-rose-100 text-center text-xs text-slate-500">
                  Tidak ada stok di rak untuk diuji.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {inStockEpcs.slice(0, 5).map((item) => (
                    <div
                      key={item.epc}
                      className="p-3 rounded-xl bg-white border border-rose-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-slate-900">{item.epc}</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {item.tag_status} (Rak {item.rack_code || '-'})
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate">
                          {item.sku} — {item.product_name}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={scanningEpc}
                        onClick={() => {
                          setInputCode(item.epc);
                          handleDirectEpcGateScan(item.epc);
                        }}
                        className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition shrink-0 flex items-center justify-center gap-1.5"
                      >
                        <span>🚨</span>
                        <span>Uji Bawa Lewat Gerbang</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Input Scanner Manual */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPass()}
                placeholder="Tempel Kode EPC Barang langsung (cth: E28011602000000000000002) atau Kode Gate Pass..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium tracking-wide shadow-inner"
              />
              <span className="absolute left-3.5 top-3.5 text-base text-slate-400">🏷️</span>
            </div>
            <button
              onClick={() => handleVerifyPass()}
              disabled={verifying}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-600/30 transition flex items-center justify-center space-x-2 shrink-0"
            >
              {verifying ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Memindai...</span>
                </>
              ) : (
                <>
                  <span>📡</span>
                  <span>Scan EPC / Gate Pass di Gerbang</span>
                </>
              )}
            </button>
          </div>

          {/* HASIL VERIFIKASI VISUAL (INTERAKTIF) */}
          {verificationResult ? (
            <div
              className={`p-6 rounded-2xl border-2 transition-all ${
                verificationResult.is_valid && verificationResult.verification_status === 'AUTHORIZED'
                  ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950'
                  : verificationResult.verification_status === 'ALREADY_USED'
                  ? 'bg-amber-50 border-amber-400 text-amber-950'
                  : 'bg-rose-50 border-rose-500 text-rose-950'
              }`}
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-black/10 pb-4">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${
                      verificationResult.is_valid && verificationResult.verification_status === 'AUTHORIZED'
                        ? 'bg-emerald-600 text-white'
                        : verificationResult.verification_status === 'ALREADY_USED'
                        ? 'bg-amber-500 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {verificationResult.is_valid && verificationResult.verification_status === 'AUTHORIZED'
                      ? '✓'
                      : verificationResult.verification_status === 'ALREADY_USED'
                      ? '⚠️'
                      : '✕'}
                  </div>
                  <div>
                    <span
                      className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        verificationResult.is_valid && verificationResult.verification_status === 'AUTHORIZED'
                          ? 'bg-emerald-200/80 text-emerald-900'
                          : verificationResult.verification_status === 'ALREADY_USED'
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-rose-200 text-rose-900'
                      }`}
                    >
                      {verificationResult.verification_status}
                    </span>
                    <h3 className="text-base font-extrabold mt-1">
                      {verificationResult.message}
                    </h3>
                  </div>
                </div>

                {/* Tombol Konfirmasi Keluar / Batalkan (Jika Status Valid & Aktif) */}
                {verificationResult.is_valid && verificationResult.verification_status === 'AUTHORIZED' && (
                  <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2 shrink-0">
                    <button
                      onClick={() => handleConfirmExit(verificationResult.data?.pass_code)}
                      disabled={confirmingExit}
                      className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center space-x-2 shrink-0 animate-pulse"
                    >
                      <span>🚀</span>
                      <span>{confirmingExit ? 'Menyimpan Konfirmasi...' : 'IZINKAN KELUAR & BUKA GERBANG'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setPassToCancel(verificationResult.data);
                        setCancelReason('');
                      }}
                      className="w-full sm:w-auto px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center space-x-1.5 shrink-0"
                      title="Batalkan / Cabut Izin Gate Pass ini"
                    >
                      <span>🚫</span>
                      <span>Batalkan Izin</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Rincian Pas Jalan */}
              {verificationResult.data && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="bg-white/80 p-3 rounded-xl border border-black/5">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Nomor Gate Pass</span>
                    <p className="font-mono font-bold text-sm text-slate-900 mt-0.5">
                      {verificationResult.data.pass_code}
                    </p>
                  </div>
                  <div className="bg-white/80 p-3 rounded-xl border border-black/5">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Dokumen Resi / Invoice</span>
                    <p className="font-mono font-bold text-sm text-slate-900 mt-0.5">
                      {verificationResult.data.reference_resi || '-'}
                    </p>
                  </div>
                  <div className="bg-white/80 p-3 rounded-xl border border-black/5">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Tujuan / Pelanggan</span>
                    <p className="font-semibold text-slate-900 mt-0.5 truncate">
                      {verificationResult.data.customer_or_destination || 'Walk-In Customer'}
                    </p>
                  </div>
                  <div className="bg-white/80 p-3 rounded-xl border border-black/5">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Kurir / Metode</span>
                    <p className="font-semibold text-slate-900 mt-0.5 truncate">
                      {verificationResult.data.courier || 'Kurir Ekspedisi'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
              <span className="text-3xl">📡</span>
              <p className="text-xs font-medium text-slate-600">
                Menunggu input scan kode Gate Pass.
              </p>
              <p className="text-[11px] text-slate-400 max-w-md">
                Klik salah satu tombol <strong>"Verifikasi"</strong> di tabel bawah atau gunakan kode contoh seperti{' '}
                <button
                  onClick={() => {
                    const sample = gatePasses[0]?.pass_code;
                    if (sample) {
                      setInputCode(sample);
                      handleVerifyPass(sample);
                    }
                  }}
                  className="text-blue-600 font-mono font-bold underline"
                >
                  {gatePasses[0]?.pass_code || 'GP-Contoh'}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ================= TABEL RIWAYAT GATE PASS (TanStack DataTable) ================= */}
      <div data-tour="gate-security-list" className="space-y-3">
        {loading ? (
          <div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
            Memuat daftar pas jalan...
          </div>
        ) : (
          <DataTable
            data={gatePasses}
            columns={[
              {
                accessorKey: 'pass_code',
                header: 'No. Gate Pass',
                cell: ({ row }) => (
                  <span className="font-mono font-semibold text-foreground">
                    {row.original.pass_code}
                  </span>
                ),
              },
              {
                accessorKey: 'reference_resi',
                header: 'Dokumen Acuan',
                cell: ({ row }) => (
                  <div>
                    <span className="font-mono">{row.original.reference_resi || '-'}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {row.original.order_type || 'OUTBOUND'}
                    </span>
                  </div>
                ),
              },
              {
                accessorKey: 'customer_or_destination',
                header: 'Tujuan & Kurir',
                cell: ({ row }) => (
                  <div>
                    <span className="font-medium block truncate max-w-xs">
                      {row.original.customer_or_destination || 'Tujuan Terdaftar'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {row.original.courier || 'Kurir Ekspedisi'}
                    </span>
                  </div>
                ),
              },
              {
                id: 'valid_until',
                header: 'Masa Berlaku',
                accessorFn: (row) => (row.valid_until ? new Date(row.valid_until).getTime() : 0),
                cell: ({ row }) => (
                  <span className="font-mono text-muted-foreground whitespace-nowrap">
                    {row.original.valid_until
                      ? new Date(row.original.valid_until).toLocaleString('id-ID')
                      : '-'}
                  </span>
                ),
              },
              {
                id: 'status',
                header: 'Status',
                accessorFn: (row) => {
                  const st = String(row.status || '').toUpperCase();
                  const expired = row.valid_until && new Date(row.valid_until) < new Date();
                  return st === 'ACTIVE' && expired ? 'EXPIRED' : st;
                },
                cell: ({ row }) => {
                  const gp = row.original;
                  const statusUpper = String(gp.status || '').toUpperCase();
                  const isExpired = gp.valid_until && new Date(gp.valid_until) < new Date();
                  const label =
                    statusUpper === 'ACTIVE' && isExpired
                      ? 'EXPIRED'
                      : statusUpper === 'REVOKED'
                      ? 'DIBATALKAN'
                      : statusUpper;
                  const variant =
                    statusUpper === 'ACTIVE'
                      ? isExpired
                        ? 'destructive'
                        : 'success'
                      : statusUpper === 'USED'
                      ? 'secondary'
                      : 'destructive';
                  return <Badge variant={variant}>{label}</Badge>;
                },
              },
              {
                id: 'created_at',
                header: 'Waktu Dibuat',
                accessorFn: (row) => (row.created_at ? new Date(row.created_at).getTime() : 0),
                cell: ({ row }) => (
                  <span className="font-mono text-muted-foreground whitespace-nowrap">
                    {row.original.created_at
                      ? new Date(row.original.created_at).toLocaleString('id-ID')
                      : '-'}
                  </span>
                ),
              },
              {
                id: 'actions',
                header: 'Aksi Operator',
                enableSorting: false,
                enableHiding: false,
                cell: ({ row }) => {
                  const gp = row.original;
                  const statusUpper = String(gp.status || '').toUpperCase();
                  return (
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => {
                          setInputCode(gp.pass_code);
                          handleVerifyPass(gp.pass_code);
                          window.scrollTo({ top: 180, behavior: 'smooth' });
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Verifikasi
                      </Button>
                      {statusUpper === 'ACTIVE' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => {
                            setPassToCancel(gp);
                            setCancelReason('');
                          }}
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Batal
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => setSelectedPassForPrint(gp)}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Cetak
                      </Button>
                    </div>
                  );
                },
              },
            ]}
            searchPlaceholder="Cari pas, resi, tujuan, kurir..."
            dateField="created_at"
            initialSorting={[{ id: 'created_at', desc: true }]}
            filters={[
              {
                key: 'status',
                label: 'Status',
                getValue: (gp) => {
                  const st = String(gp.status || '').toUpperCase();
                  const expired = gp.valid_until && new Date(gp.valid_until) < new Date();
                  return st === 'ACTIVE' && expired ? 'EXPIRED' : st;
                },
                options: [
                  { value: 'ACTIVE', label: 'Aktif' },
                  { value: 'USED', label: 'Digunakan' },
                  { value: 'EXPIRED', label: 'Kadaluwarsa' },
                  { value: 'REVOKED', label: 'Dibatalkan' },
                ],
              },
            ]}
            emptyMessage="Tidak ada Gate Pass yang cocok dengan filter."
          />
        )}
      </div>

      {/* ================= LIVE GATE EVENTS FEED ================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg">📡</span>
            <h3 className="text-sm font-bold text-slate-900 tracking-wide uppercase">
              Log Lintasan Pembaca Portal Gerbang RFID (Live Feed)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Menampilkan 10 lintasan terakhir</span>
        </div>

        <div className="space-y-2.5">
          {gateEvents.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">Belum ada riwayat lintasan di gerbang.</p>
          ) : (
            gateEvents.map((evt) => {
              const isBreach = evt.authorization_status === 'UNAUTHORIZED';
              return (
                <div
                  key={evt.id}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                    isBreach
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-base">{isBreach ? '🚨' : '🟢'}</span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold">{evt.epc || 'ALL_ITEMS'}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            isBreach ? 'bg-rose-200 text-rose-900' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {evt.authorization_status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {evt.item_name || 'Muatan Barang'} • {evt.action_taken}
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-slate-400 font-mono shrink-0">
                    <span>{evt.event_time ? new Date(evt.event_time).toLocaleTimeString('id-ID') : '-'}</span>
                    <span className="block text-[10px] text-slate-500">{evt.antenna_info || 'Antena 1 & 2'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================= MODAL CETAK GATE PASS (OFFICIAL) ================= */}
      {selectedPassForPrint && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span>🛡️</span>
                <span className="font-extrabold text-sm tracking-wide">DIGI WMS OFFICIAL GATE PASS</span>
              </div>
              <button
                onClick={() => setSelectedPassForPrint(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Document Body (Printable Paper Look) */}
            <div className="p-6 bg-slate-50/50 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-black text-lg text-slate-900">SURAT IZIN KELUAR GERBANG</h4>
                    <span className="text-[11px] text-blue-600 font-bold uppercase tracking-wider">
                      Warehouse Outbound Authorization Pass
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${
                      selectedPassForPrint.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {selectedPassForPrint.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Nomor Pas Jalan</span>
                    <p className="font-mono font-black text-base text-slate-900 mt-0.5">
                      {selectedPassForPrint.pass_code}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Dokumen Resi / Invoice</span>
                    <p className="font-mono font-bold text-sm text-slate-800 mt-0.5">
                      {selectedPassForPrint.reference_resi || '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tujuan / Penerima</span>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {selectedPassForPrint.customer_or_destination || 'Pelanggan'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Kurir / Ekspedisi</span>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {selectedPassForPrint.courier || 'Kurir Outbound'}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-100 rounded-xl text-center space-y-1">
                  <span className="font-mono text-sm tracking-widest font-black text-slate-800 block">
                    ||||| | |||| |||||| |||| | |||||||| ||||
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    *{selectedPassForPrint.pass_code}*
                  </span>
                </div>

                <div className="text-[10px] text-slate-400 text-center border-t border-slate-100 pt-3">
                  Wajib ditunjukkan kepada petugas satpam gerbang sebelum armada logistik meninggalkan area gudang.
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end space-x-3">
              <button
                onClick={() => setSelectedPassForPrint(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-blue-600/30 transition flex items-center space-x-1.5"
              >
                <span>🖨️</span>
                <span>Cetak / Cetak PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL GENERATE GATE PASS MANUAL ================= */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span>➕</span>
                <span className="font-extrabold text-sm tracking-wide">Terbitkan Gate Pass Baru</span>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateGatePass} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Resi / Dokumen Referensi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="cth: JX-9920-1182 atau INV-POS-9001"
                  value={generateForm.reference_resi}
                  onChange={(e) => setGenerateForm({ ...generateForm, reference_resi: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipe Transaksi</label>
                  <select
                    value={generateForm.reference_type}
                    onChange={(e) => setGenerateForm({ ...generateForm, reference_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none"
                  >
                    <option value="OUTBOUND_SHIPMENT">Pengiriman Ekspedisi</option>
                    <option value="POS_SALE">Penjualan Kasir (POS)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kurir / Armada</label>
                  <input
                    type="text"
                    placeholder="cth: SiCepat, JNE"
                    value={generateForm.courier}
                    onChange={(e) => setGenerateForm({ ...generateForm, courier: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tujuan / Nama Pelanggan</label>
                <input
                  type="text"
                  placeholder="cth: Surabaya Hub / Toko Elektronik"
                  value={generateForm.customer_or_destination}
                  onChange={(e) => setGenerateForm({ ...generateForm, customer_or_destination: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Pilih Tag RFID Massal ({availableTags.length} tersedia)
                  </label>
                  {availableTags.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setGenerateForm({
                            ...generateForm,
                            epc_list: availableTags.map((t) => t.epc).join(', '),
                          })
                        }
                        className="text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setGenerateForm({ ...generateForm, epc_list: '' })}
                        className="text-[11px] font-semibold text-slate-500 hover:underline"
                      >
                        Bersihkan
                      </button>
                    </div>
                  )}
                </div>

                {availableTags.length > 0 && (
                  <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1 mb-2">
                    {availableTags.map((t) => {
                      const currentEpcs = generateForm.epc_list
                        .split(/[\n,]+/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const checked = currentEpcs.includes(t.epc);
                      return (
                        <label
                          key={t.id || t.epc}
                          className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg hover:bg-white cursor-pointer text-[11px]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = checked
                                  ? currentEpcs.filter((e) => e !== t.epc)
                                  : [...currentEpcs, t.epc];
                                setGenerateForm({ ...generateForm, epc_list: next.join(', ') });
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-mono font-semibold text-slate-800 truncate">
                              {t.epc}
                            </span>
                            {t.sku && <span className="text-slate-400 truncate">({t.sku})</span>}
                          </div>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 shrink-0">
                            {t.status}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                <textarea
                  rows={2}
                  placeholder="Atau paste banyak EPC (pisahkan koma atau baris baru)..."
                  value={generateForm.epc_list}
                  onChange={(e) => setGenerateForm({ ...generateForm, epc_list: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Masa Berlaku (Jam)</label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={generateForm.valid_hours}
                  onChange={(e) => setGenerateForm({ ...generateForm, valid_hours: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-blue-600/30 transition"
                >
                  {generating ? 'Menerbitkan...' : 'Terbitkan Pas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL KONFIRMASI PEMBATALAN GATE PASS ================= */}
      {passToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-rose-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-rose-600 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span>🚫</span>
                <span className="font-extrabold text-sm tracking-wide">Batalkan Gate Pass (Revoke)</span>
              </div>
              <button
                onClick={() => setPassToCancel(null)}
                className="text-rose-100 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCancelGatePass} className="p-6 space-y-4">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                <p className="font-bold">
                  Anda akan mencabut izin keluar untuk Gate Pass:{' '}
                  <span className="font-mono text-rose-700">{passToCancel.pass_code}</span>
                </p>
                <p className="text-[11px] text-rose-700">
                  Status akan diubah menjadi <strong>REVOKED (Dibatalkan)</strong>. Setelah dibatalkan, pas jalan ini tidak dapat digunakan lagi untuk keluar gerbang.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Pembatalan (Opsional)
                </label>
                <textarea
                  rows="3"
                  placeholder="cth: Pengiriman dibatalkan, kesalahan nomor resi, atau muatan tidak sesuai..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPassToCancel(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-rose-600/30 transition"
                >
                  {cancelling ? 'Membatalkan...' : 'Ya, Batalkan Gate Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
