import { driver } from 'driver.js';

export const GUIDEBOOK_STORAGE_KEY = 'digiwms_guidebook_seen_v1';

// Simpan referensi instance Driver aktif agar dapat di-destroy sebelum memulai tur baru
let activeDriverInstance = null;

/**
 * Mengecek apakah pengguna sudah pernah membuka / menyelesaikan panduan interaktif
 */
export function hasSeenGuidebook() {
  try {
    return localStorage.getItem(GUIDEBOOK_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Menandai bahwa pengguna telah melihat / menyelesaikan panduan di localStorage
 */
export function markGuidebookAsSeen() {
  try {
    localStorage.setItem(GUIDEBOOK_STORAGE_KEY, 'true');
  } catch {
    // Ignore storage restriction
  }
}

/**
 * Memastikan elemen target benar-benar ada di DOM dan terlihat di viewport
 * (mencegah error di layar mobile atau saat sidebar sedang tersembunyi)
 */
export function isElementVisible(selector) {
  if (typeof document === 'undefined' || !selector) return false;
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }
  return rect.width > 0 && rect.height > 0;
}

/**
 * Daftar langkah tur kontekstual berdasarkan tab / modul yang sedang aktif di DIGI WMS
 */
function getContextualStepsForTab(activeTab = 'dashboard') {
  const globalHeaderSteps = [
    {
      element: '[data-tour="sidebar-nav"]',
      popover: {
        title: '🧭 Navigasi Modul DIGI WMS',
        description:
          'Gunakan panel sidebar ini untuk berpindah antar 4 modul utama: Operasional Gudang (Inbound & Rak), RFID & Gate Core (Encoding, Opname Handheld, Gate Alarm, Ledger), serta Sistem & Analitik.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="global-search"]',
      popover: {
        title: '🔍 Pencarian Global Instan',
        description:
          'Ketik nama barang, kode SKU, kode EPC chip RFID, atau nomor rak di sini untuk langsung mencari inventaris dari halaman mana pun.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="header-quick-actions"]',
      popover: {
        title: '⚡ Aksi Cepat & Monitor Gate',
        description:
          'Tombol pintas untuk langsung memantau Portal Gate RFID Live, menambahkan master barang/SKU baru, dan memeriksa diagnostik kesehatan Server, Supabase, serta Broker EMQX.',
        side: 'bottom',
        align: 'end',
      },
    },
  ];

  const tabSpecificStepsMap = {
    dashboard: [
      {
        element: '[data-tour="dashboard-header"]',
        popover: {
          title: '📊 Ringkasan Eksekutif & Status Cloud',
          description:
            'Menampilkan status koneksi live ke Supabase PostgreSQL & EMQX MQTT, dilengkapi tombol Ekspor Laporan CSV dan pintasan Opname Cepat.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="dashboard-kpi-cards"]',
        popover: {
          title: '📈 5 Kartu Indikator KPI Utama',
          description:
            'Pantau Total Stok Fisik (terverifikasi Ledger), Penerimaan GRN, Jumlah Tag RFID UHF Aktif, Status Keamanan Gerbang, serta jumlah Gate Pass yang siap diverifikasi.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '[data-tour="dashboard-gate-banner"]',
        popover: {
          title: '🛡️ Portal Terminal Pos Satpam (Fase 2)',
          description:
            'Klik tombol di panel ini untuk membuka Terminal Pos Satpam guna menerbitkan dan memverifikasi izin keluar barang (Gate Pass AUTHORIZED_OUT).',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '[data-tour="dashboard-analytics-grid"]',
        popover: {
          title: '📉 Grafik Pergerakan & Peringatan Stok Kritis',
          description:
            'Analisis tren barang masuk (Inbound), keluar (Outbound), dan audit Opname 7/30 hari terakhir, sekaligus daftar SKU yang stoknya berada di bawah batas aman.',
          side: 'top',
          align: 'center',
        },
      },
    ],

    penerimaan: [
      {
        element: '[data-tour="inbound-header"]',
        popover: {
          title: '🚚 Manajemen Penerimaan Barang (Inbound & GRN)',
          description:
            'Modul Orang 1: Gunakan tombol "+ Catat Penerimaan Baru" saat barang tiba dari supplier untuk menerbitkan dokumen GRN dan mencatat saldo awal ke Buku Besar.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="inbound-table"]',
        popover: {
          title: '📋 Daftar Surat Jalan & Status Tagging RFID',
          description:
            'Pantau riwayat PO supplier, jumlah fisik unit yang diterima, status encoding chip RFID, serta lakukan verifikasi penerimaan langsung ke rak gudang.',
          side: 'top',
          align: 'center',
        },
      },
    ],

    stok: [
      {
        element: '[data-tour="inbound-header"]',
        popover: {
          title: '📦 Master Data Barang & Saldo Stok SKU',
          description:
            'Kelola katalog SKU gudang, kategori produk, harga satuan, serta batas minimum stok kritis (Low Stock Alert).',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="inbound-table"]',
        popover: {
          title: '📊 Tabel Inventaris SKU Terintegrasi Ledger',
          description:
            'Angka stok di tabel ini dihitung secara akurat dari agregasi mutasi Buku Besar (Immutable Stock Ledger) dan dilengkapi indikator status Aman / Stok Rendah.',
          side: 'top',
          align: 'center',
        },
      },
    ],

    'rfid-tag': [
      {
        element: '[data-tour="inbound-header"]',
        popover: {
          title: '🏷️ Registrasi & Encoding Chip RFID UHF',
          description:
            'Hubungkan Desktop USB RFID Encoder di meja Inbound untuk menulis kode EPC 96-bit standar Gen2 (920–923 MHz) dan menautkannya ke SKU barang.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="inbound-table"]',
        popover: {
          title: '📡 Pemantauan Siklus Hidup Tag RFID',
          description:
            'Lacak setiap chip RFID berdasarkan kode EPC, tipe tag (Label Biasa, On-Metal, Hard Tag), kekuatan sinyal RSSI terakhir, dan statusnya (ENCODED → IN_STOCK → AUTHORIZED_OUT).',
          side: 'top',
          align: 'center',
        },
      },
    ],

    penyimpanan: [
      {
        element: '[data-tour="inventory-header"]',
        popover: {
          title: '📍 Peta & Kapasitas Zona Rak Gudang',
          description:
            'Modul Orang 2: Pantau tingkat keterisian (okupansi) seluruh zona rak penyimpanan gudang (A1–D2) secara visual.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="inventory-main-section"]',
        popover: {
          title: '📥 Putaway & Transfer Tag Antar-Rak',
          description:
            'Pindahkan barang bertag RFID dari Zona Transit Inbound menuju rak penyimpanan utama. Setiap perpindahan otomatis tercatat di Immutable Stock Ledger.',
          side: 'top',
          align: 'center',
        },
      },
    ],

    'stok-rak': [
      {
        element: '[data-tour="stock-rack-header"]',
        popover: {
          title: '📊 Inventaris Stok per Lokasi Rak',
          description:
            'Pantau distribusi barang berstatus IN_STOCK pada masing-masing rak secara real-time dengan indikator koneksi EMQX MQTT.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="stock-rack-summary"]',
        popover: {
          title: '📦 Ringkasan Unit, SKU, & Rak Terisi',
          description:
            'Menampilkan total kuantitas unit fisik di rak, jumlah variasi SKU yang tersimpan, serta jumlah titik rak aktif.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '[data-tour="stock-rack-table"]',
        popover: {
          title: '🔎 Filter & Rincian Stok per Rak',
          description:
            'Saring tampilan berdasarkan kode rak tertentu atau cari nama barang/SKU untuk menemukan posisi rak barang dengan cepat.',
          side: 'top',
          align: 'center',
        },
      },
    ],

    picking: [
      {
        element: '[data-tour="inventory-header"]',
        popover: {
          title: '📋 Manajemen Picking & Packing Pesanan',
          description:
            'Kelola antrean pengambilan barang pesanan dari rak (Picking) hingga pengemasan di meja Packing sebelum diterbitkan Gate Pass.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="inventory-main-section"]',
        popover: {
          title: '🛒 Papan Alur Picking → Packing → Siap Kirim',
          description:
            'Validasi kesesuaian tag RFID barang yang diambil dari rak agar tidak terjadi salah kirim barang.',
          side: 'top',
          align: 'center',
        },
      },
    ],

    pengiriman: [
      {
        element: '[data-tour="inventory-header"]',
        popover: {
          title: '🚀 Pengiriman (Outbound) & Penerbitan Gate Pass',
          description:
            'Catat pengiriman ekspedisi (JNE, SiCepat, dll.) dan terbitkan kode Gate Pass resmi agar paket diizinkan melewati gerbang RFID tanpa memicu sirine.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="inventory-main-section"]',
        popover: {
          title: '🎫 Daftar Resi & Status Gate Pass',
          description:
            'Pantau nomor resi, tujuan pengiriman, kode Gate Pass (GP-xxxx-OK), serta status perjalanan paket.',
          side: 'top',
          align: 'center',
        },
      },
    ],

    ledger: [
      {
        element: '[data-tour="inventory-header"]',
        popover: {
          title: '📜 Buku Besar Pergerakan Stok (Immutable Stock Ledger)',
          description:
            'Setiap mutasi masuk, pindah rak, penjualan, dan koreksi opname dicatat secara Append-Only (tidak dapat dihapus/diedit) layaknya mutasi rekening bank.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="inventory-main-section"]',
        popover: {
          title: '🔒 Jejak Audit Transaksi Stok',
          description:
            'Telusuri kode transaksi (TX-xxxx), waktu, jenis mutasi, lokasi asal & tujuan, perubahan kuantitas (+/-), serta nama operator yang bertugas.',
          side: 'top',
          align: 'center',
        },
      },
    ],

    'rfid-opname': [
      {
        element: '[data-tour="opname-gate-header"]',
        popover: {
          title: '📡 Audit Stock Opname Handheld RFID',
          description:
            'Modul Orang 3: Pilih zona rak target dan jalankan pemindaian nirkabel massal menggunakan Handheld Scanner (Chainway C72) untuk menghitung ratusan barang dalam hitungan detik.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="opname-gate-main"]',
        popover: {
          title: '⚖️ Rekonsiliasi Selisih Fisik vs Buku Besar',
          description:
            'Sistem otomatis mendeteksi barang Cocok (Match), Hilang (Missing), atau Salah Rak (Misplaced). Supervisor dapat menekan "Setujui Penyesuaian ke Ledger" untuk membukukan koreksi stok.',
          side: 'top',
          align: 'center',
        },
      },
    ],

    'rfid-gate': [
      {
        element: '[data-tour="opname-gate-header"]',
        popover: {
          title: '🚨 Portal Keamanan Gerbang RFID & Sirine Live',
          description:
            'Uji coba 3 skenario pembacaan antena gerbang keluar: Barang Keluar Resmi (Authorized Out), Barang Tanpa Izin (Alarm Sirine Aktif), serta Filter Cross-Read (-65 dBm).',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="opname-gate-main"]',
        popover: {
          title: '🛡️ Indikator Lampu Strobo & Log Lintasan Antena',
          description:
            'Pantau status visual gawang antena, kekuatan sinyal RSSI, dan riwayat insiden barang yang melintasi pintu keluar gudang secara real-time.',
          side: 'top',
          align: 'center',
        },
      },
    ],

    'gate-security': [
      {
        element: '[data-tour="gate-security-header"]',
        popover: {
          title: '🛡️ Terminal Keamanan Gerbang & Gate Pass (MVP 2)',
          description:
            'Pusat kendali petugas keamanan untuk menerbitkan Gate Pass baru, menyimulasikan alarm pelanggaran (breach), dan memantau statistik izin keluar.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="gate-security-scanner"]',
        popover: {
          title: '🔎 Scanner Verifikasi Cepat Gate Pass',
          description:
            'Masukkan atau pindai kode Gate Pass (contoh: GP-8839-OK) atau nomor resi untuk memverifikasi keabsahan izin keluar dan mengonfirmasi Scan-Out.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '[data-tour="gate-security-list"]',
        popover: {
          title: '📑 Daftar Dokumen Gate Pass & Log Gerbang',
          description:
            'Kelola seluruh dokumen Gate Pass (ACTIVE, USED, EXPIRED), cetak surat izin keluar, dan pantau log pembacaan antena portal.',
          side: 'top',
          align: 'center',
        },
      },
    ],
  };

  const specificSteps = tabSpecificStepsMap[activeTab] || [
    {
      element: '[data-tour="main-content-area"]',
      popover: {
        title: '🖥️ Area Kerja Modul Aktif',
        description:
          'Bagian ini menampilkan kontrol, formulir, dan tabel data sesuai menu modul DIGI WMS yang sedang Anda buka.',
        side: 'top',
        align: 'center',
      },
    },
  ];

  const closingSteps = [
    {
      element: '[data-tour="sidebar-user-profile"]',
      popover: {
        title: '👤 Profil Sesi & Hak Akses RBAC',
        description:
          'Menampilkan nama personel dan role akses aktif Anda (ADMIN, SUPERVISOR, OPERATOR, SECURITY) beserta tombol keluar sesi.',
        side: 'right',
        align: 'end',
      },
    },
    {
      element: '[data-tour="guidebook-trigger"]',
      popover: {
        title: '📘 Buka Kembali Panduan Kapan Saja',
        description:
          'Klik tombol "Panduan" ini di setiap halaman untuk menjalankan tur interaktif yang menyesuaikan otomatis dengan menu yang sedang Anda buka!',
        side: 'bottom',
        align: 'end',
      },
    },
  ];

  // Jika di halaman dashboard, tampilkan tur lengkap (Global + Dashboard + Closing)
  // Jika di halaman modul lain, tampilkan tur kontekstual modul tersebut + tombol panduan
  const candidateSteps =
    activeTab === 'dashboard'
      ? [...globalHeaderSteps, ...specificSteps, ...closingSteps]
      : [...specificSteps, ...globalHeaderSteps.slice(1, 3), closingSteps[1]];

  // Filter hanya elemen yang benar-benar ada dan terlihat di viewport saat ini
  const visibleSteps = candidateSteps.filter((step) =>
    step.element ? isElementVisible(step.element) : true
  );

  // Fallback aman jika tidak ada elemen spesifik yang terdeteksi
  if (visibleSteps.length === 0) {
    return [
      {
        popover: {
          title: '📦 Selamat Datang di DIGI WMS',
          description:
            'Sistem Manajemen Gudang RFID UHF, Immutable Stock Ledger, Handheld Opname, dan Gate Security siap digunakan.',
        },
      },
    ];
  }

  return visibleSteps;
}

/**
 * Memulai Interactive Guidebook / Product Tour menggunakan Driver.js
 * @param {string} activeTab - ID tab/halaman yang sedang aktif
 * @param {() => void} [onComplete] - Callback saat tur selesai atau ditutup
 */
export function startInteractiveGuidebook(activeTab = 'dashboard', onComplete) {
  // Pastikan instance sebelumnya di-destroy terlebih dahulu
  if (activeDriverInstance) {
    try {
      activeDriverInstance.destroy();
    } catch {
      // Ignore destroy error
    }
    activeDriverInstance = null;
  }

  const steps = getContextualStepsForTab(activeTab);

  activeDriverInstance = driver({
    popoverClass: 'app-guidebook-popover',
    showProgress: true,
    animate: true,
    smoothScroll: true,
    allowClose: true,
    allowKeyboardControl: true,
    skipMissingElement: true,
    stagePadding: 8,
    stageRadius: 14,
    overlayColor: 'rgba(15, 23, 42, 0.65)',
    nextBtnText: 'Lanjut →',
    prevBtnText: '← Kembali',
    doneBtnText: 'Selesai ✓',
    progressText: 'Langkah {{current}} dari {{total}}',
    steps,
    onDestroyed: () => {
      markGuidebookAsSeen();
      if (typeof onComplete === 'function') {
        onComplete();
      }
      activeDriverInstance = null;
    },
  });

  activeDriverInstance.drive();
  return activeDriverInstance;
}
