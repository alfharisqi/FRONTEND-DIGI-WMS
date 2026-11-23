import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config/api';

export default function InventoryLedgerPage({
  activeMenu = 'penyimpanan',
  lastEvent,
  searchQuery = '',
  showNotification,
}) {
  const [locations, setLocations] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [localSearch, setLocalSearch] = useState('');
  const [showRackModal, setShowRackModal] = useState(false);
  const [isSavingRack, setIsSavingRack] = useState(false);
  const [rackForm, setRackForm] = useState({
    code: '',
    zone_code: '',
    name: '',
    max_capacity: '',
  });

  // Putaway Form State
  const [epcCode, setEpcCode] = useState('E280689400004001A1B2C301');
  const [targetLoc, setTargetLoc] = useState('');

  // Riwayat pengiriman dimuat dari backend Outbound.
  const [shippingList, setShippingList] = useState([]);
  const [isSavingShipping, setIsSavingShipping] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [shipForm, setShipForm] = useState({
    resi: '',
    courier: 'JNE Express',
    dest: '',
    epcs: '',
    total_amount: '0',
  });

  const fetchInventoryData = async () => {
    try {
      const [locRes, ledRes, shipRes] = await Promise.all([
        fetch(`${API_BASE_URL}/locations`),
        fetch(`${API_BASE_URL}/inventory/ledger`),
        fetch(`${API_BASE_URL}/outbound/shipments`),
      ]);

      if (!locRes.ok) {
        throw new Error(`Gagal mengambil lokasi rak (HTTP ${locRes.status})`);
      }

      const locJson = await locRes.json();
      setLocations(Array.isArray(locJson.data) ? locJson.data : []);

      // Ledger tetap dimuat untuk menu Ledger. Kegagalan endpoint ini
      // tidak boleh menghalangi tampilan denah rak.
      if (ledRes.ok) {
        const ledJson = await ledRes.json();
        setLedger(Array.isArray(ledJson.data) ? ledJson.data : []);
      }

      if (shipRes.ok) {
        const shipJson = await shipRes.json();
        setShippingList(
          (Array.isArray(shipJson.data) ? shipJson.data : []).map((row) => ({
            id: row.id,
            resi: row.invoice_or_resi,
            dest: row.customer_or_destination || '-',
            courier: row.courier || '-',
            date: row.created_at
              ? new Date(row.created_at).toLocaleString('id-ID')
              : '-',
            gatePass: row.gate_pass_number || null,
            gatePassValid: row.gate_pass_valid === true,
            totalItems: Number(row.total_items || 0),
            totalAmount: Number(row.total_amount || 0),
            items: Array.isArray(row.items) ? row.items : [],
            status: row.shipping_status || 'SIAP_KIRIM',
          }))
        );
      }
    } catch (err) {
      console.error('Error loading Inventory & Ledger:', err);
      showNotification?.(err.message || 'Gagal memuat data inventaris.', 'error');
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, [lastEvent]);

  useEffect(() => {
    const firstRack = locations.find((loc) => loc.location_type === 'RACK');
    const selectedRackExists = locations.some(
      (loc) => loc.location_type === 'RACK' && loc.code === targetLoc
    );

    if (firstRack && !selectedRackExists) {
      setTargetLoc(firstRack.code);
    }
  }, [locations, targetLoc]);

  const handlePutaway = async (e) => {
    e.preventDefault();
    if (!epcCode.trim() || !targetLoc) {
      showNotification?.('Masukkan EPC dan pilih rak tujuan.', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/inventory/putaway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epc: epcCode.trim(), location_code: targetLoc }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Gagal memproses Putaway.');
      }

      showNotification?.(
        json.message || `Tag ${epcCode} berhasil ditempatkan di ${targetLoc}`,
        'success'
      );
      await fetchInventoryData();
      setEpcCode('');
    } catch (err) {
      console.error('Putaway error:', err);
      showNotification?.(err.message || 'Terjadi kesalahan saat Putaway.', 'error');
    }
  };

  const handleAddRack = async (e) => {
    e.preventDefault();
    const payload = {
      code: rackForm.code.trim(),
      zone_code: rackForm.zone_code.trim(),
      name: rackForm.name.trim(),
      max_capacity: Number(rackForm.max_capacity),
      location_type: 'RACK',
    };

    if (
      !payload.code ||
      !payload.zone_code ||
      !payload.name ||
      !Number.isInteger(payload.max_capacity) ||
      payload.max_capacity <= 0
    ) {
      showNotification?.(
        'Lengkapi semua data rak. Kapasitas harus berupa bilangan bulat lebih dari 0.',
        'error'
      );
      return;
    }

    setIsSavingRack(true);
    try {
      const res = await fetch(`${API_BASE_URL}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Gagal menambahkan rak.');
      }

      showNotification?.(json.message || 'Rak baru berhasil ditambahkan.', 'success');
      setRackForm({ code: '', zone_code: '', name: '', max_capacity: '' });
      setShowRackModal(false);
      await fetchInventoryData();
    } catch (err) {
      console.error('Add rack error:', err);
      showNotification?.(err.message || 'Terjadi kesalahan saat menambahkan rak.', 'error');
    } finally {
      setIsSavingRack(false);
    }
  };

  // Cetak surat jalan berdasarkan data shipment yang dikembalikan backend.
  // Perubahan hanya pada template dokumen cetak; alur API dan transaksi Outbound tetap.
  const handlePrintShipping = (shipment) => {
    const printWindow = window.open('', '_blank', 'width=980,height=760');
    if (!printWindow) {
      showNotification?.('Popup diblokir browser. Izinkan popup untuk mencetak surat jalan.', 'error');
      return;
    }

    const escapeHtml = (value) => String(value ?? '-').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));

    const formatDate = (value) => {
      if (!value || value === '-') return '-';
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime())
        ? escapeHtml(value)
        : escapeHtml(parsed.toLocaleString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }));
    };

    const items = Array.isArray(shipment.items) ? shipment.items : [];
    const itemRows = items.length
      ? items.map((item, index) => `
          <tr>
            <td class="cell-number">${index + 1}</td>
            <td class="cell-mono">${escapeHtml(item.epc)}</td>
            <td class="cell-mono">${escapeHtml(item.sku)}</td>
            <td>${escapeHtml(item.product_name)}</td>
            <td class="cell-qty">${Number(item.qty || 1)}</td>
          </tr>`).join('')
      : '<tr><td colspan="5" class="empty-row">Rincian barang tidak tersedia pada data riwayat ini.</td></tr>';

    const totalItems = Number(shipment.totalItems || items.reduce(
      (sum, item) => sum + Number(item.qty || 1), 0
    ));
    const gatePassValid = shipment.gatePassValid === true;
    const documentHtml = `<!doctype html>
      <html lang="id">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Surat Jalan - ${escapeHtml(shipment.resi)}</title>
        <style>
          :root {
            color-scheme: light;
            --navy: #142b4a;
            --blue: #1d4ed8;
            --blue-soft: #eff6ff;
            --ink: #172033;
            --muted: #64748b;
            --line: #dbe3ee;
            --surface: #f5f8fc;
            --green: #047857;
            --green-soft: #ecfdf5;
          }

          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          body {
            background: #eef2f7;
            color: var(--ink);
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .page {
            width: 210mm;
            min-height: 297mm;
            margin: 18px auto;
            padding: 17mm 17mm 15mm;
            background: #fff;
            box-shadow: 0 8px 30px rgba(15, 23, 42, .12);
          }

          .topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            padding-bottom: 16px;
            border-bottom: 3px solid var(--navy);
          }
          .brand { display: flex; align-items: center; gap: 11px; }
          .brand-mark {
            display: grid;
            place-items: center;
            width: 42px;
            height: 42px;
            border-radius: 10px;
            background: var(--navy);
            color: #fff;
            font-size: 16px;
            font-weight: 800;
            letter-spacing: -.5px;
          }
          .brand-name {
            color: var(--navy);
            font-size: 19px;
            font-weight: 800;
            letter-spacing: 1.1px;
          }
          .brand-caption {
            margin-top: 1px;
            color: var(--muted);
            font-size: 8px;
            letter-spacing: 1.25px;
            text-transform: uppercase;
          }
          .document-label { text-align: right; }
          .document-label strong {
            display: block;
            color: var(--navy);
            font-size: 17px;
            letter-spacing: .8px;
          }
          .document-label span {
            color: var(--muted);
            font-size: 8px;
            letter-spacing: .8px;
          }

          .title-block { padding: 22px 0 17px; text-align: center; }
          .title-block h1 {
            margin: 0;
            color: var(--navy);
            font-size: 21px;
            letter-spacing: 1.4px;
          }
          .title-block p {
            margin: 5px 0 0;
            color: var(--muted);
            font-size: 9px;
          }

          .section-heading {
            margin: 19px 0 9px;
            color: var(--navy);
            font-size: 10px;
            font-weight: 800;
            letter-spacing: .7px;
            text-transform: uppercase;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 9px 12px;
          }
          .info-card {
            min-height: 55px;
            padding: 9px 11px;
            border: 1px solid var(--line);
            border-radius: 7px;
            background: #fff;
          }
          .info-label {
            display: block;
            margin-bottom: 4px;
            color: var(--muted);
            font-size: 8px;
            font-weight: 700;
            letter-spacing: .6px;
            text-transform: uppercase;
          }
          .info-value {
            color: var(--ink);
            font-size: 11px;
            font-weight: 700;
            overflow-wrap: anywhere;
          }
          .info-value.mono {
            color: var(--blue);
            font-family: Consolas, "Courier New", monospace;
          }

          table.items {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .items th {
            padding: 9px 8px;
            border-top: 1px solid var(--navy);
            border-bottom: 1px solid var(--navy);
            background: var(--surface);
            color: var(--navy);
            font-size: 8px;
            text-align: left;
            text-transform: uppercase;
            letter-spacing: .35px;
          }
          .items td {
            padding: 10px 8px;
            border-bottom: 1px solid var(--line);
            color: var(--ink);
            font-size: 9px;
            overflow-wrap: anywhere;
            vertical-align: top;
          }
          .items th:nth-child(1) { width: 7%; }
          .items th:nth-child(2) { width: 27%; }
          .items th:nth-child(3) { width: 15%; }
          .items th:nth-child(4) { width: 41%; }
          .items th:nth-child(5) { width: 10%; }
          .cell-number, .cell-qty { text-align: center !important; }
          .cell-qty { font-weight: 800; }
          .cell-mono {
            font-family: Consolas, "Courier New", monospace;
            font-size: 8px !important;
          }
          .empty-row { padding: 18px !important; color: var(--muted) !important; text-align: center; }

          .total-row {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 18px;
            padding: 12px 4px;
            border-bottom: 1px solid var(--line);
          }
          .total-label { color: var(--muted); font-size: 9px; font-weight: 700; }
          .total-value { color: var(--navy); font-size: 16px; font-weight: 800; }

          .gate-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-top: 19px;
            padding: 13px 15px;
            border: 1px solid ${gatePassValid ? '#a7f3d0' : '#fcd34d'};
            border-left: 4px solid ${gatePassValid ? '#059669' : '#d97706'};
            border-radius: 7px;
            background: ${gatePassValid ? '#ecfdf5' : '#fffbeb'};
          }
          .gate-title {
            color: var(--navy);
            font-size: 10px;
            font-weight: 800;
            letter-spacing: .7px;
          }
          .gate-number {
            margin-top: 4px;
            color: var(--ink);
            font-family: Consolas, "Courier New", monospace;
            font-size: 10px;
            font-weight: 700;
            overflow-wrap: anywhere;
          }
          .gate-status {
            flex: 0 0 auto;
            padding: 6px 12px;
            border-radius: 20px;
            background: ${gatePassValid ? '#d1fae5' : '#fef3c7'};
            color: ${gatePassValid ? '#047857' : '#92400e'};
            font-size: 9px;
            font-weight: 800;
            letter-spacing: .5px;
          }

          .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 35px;
            margin-top: 43px;
            page-break-inside: avoid;
          }
          .signature { text-align: center; }
          .signature-title {
            color: var(--ink);
            font-size: 9px;
            font-weight: 700;
          }
          .signature-space { height: 66px; }
          .signature-line {
            width: 78%;
            margin: 0 auto;
            border-top: 1px solid #64748b;
          }
          .signature-hint { margin-top: 5px; color: var(--muted); font-size: 8px; }

          .footer {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            margin-top: 26px;
            padding-top: 9px;
            border-top: 1px solid var(--line);
            color: var(--muted);
            font-size: 8px;
          }

          @page { size: A4; margin: 0; }
          @media print {
            html, body { width: 210mm; min-height: 297mm; background: #fff; }
            body { font-size: 11px; }
            .page {
              width: 210mm;
              min-height: 297mm;
              margin: 0;
              padding: 15mm 16mm 13mm;
              box-shadow: none;
            }
            .info-card, .gate-card, .items th {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            tr, .gate-card, .signature-grid { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="topbar">
            <div class="brand">
              <div class="brand-mark">DW</div>
              <div>
                <div class="brand-name">DIGI WMS</div>
                <div class="brand-caption">Warehouse Management System</div>
              </div>
            </div>
            <div class="document-label">
              <strong>SURAT JALAN</strong>
              <span>DOKUMEN PENGIRIMAN BARANG</span>
            </div>
          </header>

          <section class="title-block">
            <h1>SURAT JALAN PENGIRIMAN</h1>
            <p>Dokumen resmi transaksi pengeluaran barang dari gudang</p>
          </section>

          <div class="section-heading">Informasi Pengiriman</div>
          <section class="info-grid">
            <div class="info-card">
              <span class="info-label">Nomor Resi / Referensi</span>
              <div class="info-value mono">${escapeHtml(shipment.resi)}</div>
            </div>
            <div class="info-card">
              <span class="info-label">Tanggal Pengiriman</span>
              <div class="info-value">${formatDate(shipment.date)}</div>
            </div>
            <div class="info-card">
              <span class="info-label">Tujuan / Penerima</span>
              <div class="info-value">${escapeHtml(shipment.dest)}</div>
            </div>
            <div class="info-card">
              <span class="info-label">Ekspedisi / Kurir</span>
              <div class="info-value">${escapeHtml(shipment.courier)}</div>
            </div>
            <div class="info-card">
              <span class="info-label">Status Pengiriman</span>
              <div class="info-value">${escapeHtml(shipment.status)}</div>
            </div>
            <div class="info-card">
              <span class="info-label">Total Unit</span>
              <div class="info-value">${totalItems} unit</div>
            </div>
          </section>

          <div class="section-heading">Rincian Barang</div>
          <table class="items">
            <thead>
              <tr>
                <th>No.</th>
                <th>EPC RFID</th>
                <th>SKU</th>
                <th>Nama Produk</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <div class="total-row">
            <span class="total-label">TOTAL BARANG DIKIRIM</span>
            <span class="total-value">${totalItems} <span style="font-size:9px;font-weight:600">UNIT</span></span>
          </div>

          <section class="gate-card">
            <div>
              <div class="gate-title">GATE PASS / OTORISASI KELUAR</div>
              <div class="gate-number">Nomor: ${escapeHtml(shipment.gatePass || 'Belum tersedia')}</div>
            </div>
            <div class="gate-status">${gatePassValid ? 'VALID' : 'PERLU VERIFIKASI'}</div>
          </section>

          <section class="signature-grid">
            <div class="signature">
              <div class="signature-title">Petugas Gudang</div>
              <div class="signature-space"></div>
              <div class="signature-line"></div>
              <div class="signature-hint">Nama jelas dan tanda tangan</div>
            </div>
            <div class="signature">
              <div class="signature-title">Penerima / Kurir</div>
              <div class="signature-space"></div>
              <div class="signature-line"></div>
              <div class="signature-hint">Nama jelas dan tanda tangan</div>
            </div>
          </section>

          <footer class="footer">
            <span>Dokumen diterbitkan dari transaksi Outbound DIGI WMS.</span>
            <span>Harap simpan sebagai bukti pengiriman.</span>
          </footer>
        </main>
      </body>
      </html>`;

    printWindow.document.open();
    printWindow.document.write(documentHtml);
    printWindow.document.close();
    printWindow.document.title = `Surat Jalan - ${shipment.resi || 'DIGI WMS'}`;

    // Beri waktu browser menyelesaikan layout sebelum membuka dialog cetak.
    // Guard mencegah dialog cetak terbuka dua kali jika onload dan fallback sama-sama terpanggil.
    let printStarted = false;
    const startPrint = () => {
      if (printStarted || printWindow.closed) return;
      printStarted = true;
      printWindow.focus();
      printWindow.print();
    };
    printWindow.onload = startPrint;
    // Fallback untuk browser yang tidak memicu onload pada document.write().
    window.setTimeout(startPrint, 500);
  };

  const handleAddShipping = async (e) => {
    e.preventDefault();

    const epcs = shipForm.epcs
      .split(/[\n,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const totalAmount = Number(shipForm.total_amount);

    if (!shipForm.resi.trim() || !shipForm.dest.trim() || epcs.length === 0) {
      showNotification?.('Nomor resi, tujuan, dan minimal satu EPC wajib diisi.', 'error');
      return;
    }

    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      showNotification?.('Total pembayaran harus berupa angka minimal 0.', 'error');
      return;
    }

    setIsSavingShipping(true);
    try {
      const res = await fetch(`${API_BASE_URL}/outbound/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_or_resi: shipForm.resi.trim(),
          customer_or_destination: shipForm.dest.trim(),
          courier: shipForm.courier,
          epcs,
          total_amount: totalAmount,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Gagal menyimpan pengiriman.');
      }

      showNotification?.(json.message || 'Pengiriman berhasil disimpan.', 'success');
      setShowShippingModal(false);
      setShipForm({
        resi: '',
        courier: 'JNE Express',
        dest: '',
        epcs: '',
        total_amount: '0',
      });
      await fetchInventoryData();
    } catch (err) {
      console.error('Add outbound shipment error:', err);
      showNotification?.(err.message || 'Terjadi kesalahan saat menyimpan pengiriman.', 'error');
    } finally {
      setIsSavingShipping(false);
    }
  };

  const handleExportLedger = () => {
    if (ledger.length === 0) {
      showNotification?.('Tidak ada data ledger untuk diekspor.', 'error');
      return;
    }

    const headers = [
      'Kode Transaksi',
      'Waktu',
      'Jenis Mutasi',
      'SKU',
      'Nama Produk',
      'Lokasi Asal',
      'Lokasi Tujuan',
      'Perubahan Stok',
      'Saldo Berjalan',
      'Operator',
      'Dokumen Referensi',
    ];

    const escapeCSV = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const rows = ledger.map((movement) => [
      movement.tx_code || movement.id,
      movement.created_at ? new Date(movement.created_at).toLocaleString('id-ID') : '',
      movement.movement_type,
      movement.sku,
      movement.product_name,
      movement.from_location,
      movement.to_location,
      movement.qty_change ?? movement.qty,
      movement.running_balance,
      movement.operator_name || movement.performed_by_name,
      movement.reference_doc,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(','))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification?.('Export Stock Ledger berhasil.', 'success');
  };

  const combinedSearch = (localSearch || searchQuery).toLowerCase();

  // ============================================================================
  // MENU 1: PENYIMPANAN (LOCATIONS / RACKS) + PUTAWAY
  // ============================================================================
  if (activeMenu === 'penyimpanan') {
    const rackLocations = locations.filter((loc) => loc.location_type === 'RACK');

    return (
      <div className="space-y-6">
        <div
          data-tour="inventory-header"
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <div>
            <h2 className="text-xl font-bold text-slate-900">Peta & Zona Lokasi Rak Gudang</h2>
            <p className="text-xs text-slate-500 mt-1">
              Denah kapasitas rak penyimpanan dan penempatan Putaway RFID.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-3.5 py-2 rounded-xl border border-blue-200">
              {rackLocations.length} Rak Terdaftar
            </span>
            <button
              type="button"
              onClick={() => setShowRackModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition"
            >
              + Tambah Rak
            </button>
          </div>
        </div>

        <div
          data-tour="inventory-main-section"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          {rackLocations.map((loc) => {
            const capacity = Number(loc.max_capacity || 0);
            const occupied = Number(loc.current_items_count || 0);
            const pct =
              capacity > 0
                ? Math.min(100, Math.round((occupied / capacity) * 100))
                : 0;
            const status = loc.capacity_status || 'Longgar';
            const statusClass =
              status === 'Padat'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : status === 'Optimal'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200';
            const barClass =
              status === 'Padat'
                ? 'bg-rose-500'
                : status === 'Optimal'
                  ? 'bg-emerald-500'
                  : 'bg-blue-600';

            return (
              <div
                key={loc.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-sm text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                    {loc.code}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${statusClass}`}>
                    {status}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 mt-3 text-base">
                  {loc.name}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Zona: {loc.zone_code}
                </p>
                <div className="mt-5">
                  <div className="flex justify-between text-xs text-slate-500 mb-2 gap-2">
                    <span>Kapasitas terisi</span>
                    <span className="font-bold text-slate-800">
                      {occupied} / {capacity} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full transition-all ${barClass}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {rackLocations.length === 0 && (
            <div className="col-span-full bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
              <p className="font-semibold text-slate-700">Belum ada rak penyimpanan.</p>
              <p className="text-sm text-slate-500 mt-1">
                Tambahkan rak baru menggunakan tombol Tambah Rak.
              </p>
            </div>
          )}
        </div>

        {/* Modal Tambah Rak */}
        {showRackModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Tambah Rak Baru</h3>
                  <p className="text-xs text-slate-500 mt-1">Data akan disimpan ke PostgreSQL.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRackModal(false)}
                  className="text-slate-400 hover:text-slate-700 text-xl"
                  aria-label="Tutup modal"
                >
                  Ã—
                </button>
              </div>

              <form onSubmit={handleAddRack} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Kode Rak
                  </label>
                  <input
                    required
                    value={rackForm.code}
                    onChange={(e) => setRackForm({ ...rackForm, code: e.target.value })}
                    placeholder="Contoh: RAK-002"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Kode Zona
                  </label>
                  <input
                    required
                    value={rackForm.zone_code}
                    onChange={(e) => setRackForm({ ...rackForm, zone_code: e.target.value })}
                    placeholder="Contoh: ZONE-A"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Nama Rak
                  </label>
                  <input
                    required
                    value={rackForm.name}
                    onChange={(e) => setRackForm({ ...rackForm, name: e.target.value })}
                    placeholder="Contoh: Rak Penyimpanan B"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Kapasitas Maksimum
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={rackForm.max_capacity}
                    onChange={(e) => setRackForm({ ...rackForm, max_capacity: e.target.value })}
                    placeholder="Contoh: 100"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRackModal(false)}
                    disabled={isSavingRack}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingRack}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60"
                  >
                    {isSavingRack ? 'Menyimpan...' : 'Simpan Rak'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Form Putaway / Pindah Lokasi Rak */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 text-base">
            Putaway & Transfer Tag RFID Antar-Rak
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Pindahkan barang dari Staging Inbound menuju Rak Penyimpanan Utama.
          </p>
          <form onSubmit={handlePutaway} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              required
              value={epcCode}
              onChange={(e) => setEpcCode(e.target.value)}
              placeholder="Kode EPC Tag RFID"
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
            />
            <select
              required
              value={targetLoc}
              onChange={(e) => setTargetLoc(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              <option value="">Pilih rak tujuan</option>
              {rackLocations.map((l) => (
                <option key={l.id || l.code} value={l.code}>
                  {l.code} â€” {l.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={rackLocations.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-2.5 px-4 rounded-xl text-sm shadow-md transition"
            >
              Simpan Putaway Rak
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MENU 2: PICKING & PACKING PESANAN (Persis Template Awal digiwms.html)
  // ============================================================================
  if (activeMenu === 'picking') {
    return (
      <div className="space-y-6">
        <div
          data-tour="inventory-header"
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h2 className="text-xl font-bold text-slate-900">Picking & Packing Pesanan</h2>
            <p className="text-xs text-slate-500 mt-1">
              Daftar pesanan yang siap diambil (picking) dan dikemas (packing) oleh petugas gudang.
            </p>
          </div>
          <button
            onClick={() =>
              showNotification?.('Batch picking baru berhasil dibuat untuk 3 pesanan', 'success')
            }
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-md transition-all flex items-center space-x-2"
          >
            <span>ðŸ“‹</span>
            <span>Buat Batch Picking</span>
          </button>
        </div>

        <div data-tour="inventory-main-section" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
                Menunggu Picking
              </span>
              <span className="text-xs text-slate-400 font-medium">14 Pesanan</span>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between font-semibold text-sm">
                  <span>ORD-8821</span>
                  <span className="text-blue-600">3 Item</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Rak A1-02 (Mouse Wireless, Mousepad)
                </p>
                <button
                  onClick={() =>
                    showNotification?.('Petugas memulai Picking ORD-8821 di Rak A1-02', 'info')
                  }
                  className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 rounded-lg font-medium"
                >
                  Mulai Picking
                </button>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between font-semibold text-sm">
                  <span>ORD-8822</span>
                  <span className="text-blue-600">5 Item</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Rak B2-01 (Keyboard Mechanical)</p>
                <button
                  onClick={() =>
                    showNotification?.('Petugas memulai Picking ORD-8822 di Rak B2-01', 'info')
                  }
                  className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 rounded-lg font-medium"
                >
                  Mulai Picking
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                Proses Packing
              </span>
              <span className="text-xs text-slate-400 font-medium">8 Pesanan</span>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between font-semibold text-sm">
                  <span>ORD-8819</span>
                  <span className="text-blue-600">2 Item</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Packing Station #2 (Bubble Wrap + Box)
                </p>
                <button
                  onClick={() =>
                    showNotification?.(
                      'Pesanan ORD-8819 selesai dikemas & Gate Pass diterbitkan!',
                      'success'
                    )
                  }
                  className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1.5 rounded-lg font-medium"
                >
                  Selesai Packing
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                Siap Kirim & Gate Pass
              </span>
              <span className="text-xs text-slate-400 font-medium">25 Pesanan</span>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between font-semibold text-sm">
                  <span>ORD-8815</span>
                  <span className="text-emerald-600">JNE Express</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Resi: JX-9920-1182 (Gate Pass Active)
                </p>
                <span className="inline-block mt-2 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  Menunggu Kurir Pickup
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MENU 3: PENGIRIMAN (SHIPPING / OUTBOUND)
  // ============================================================================
  if (activeMenu === 'pengiriman') {
    const filteredShip = shippingList.filter(
      (s) =>
        s.resi.toLowerCase().includes(combinedSearch) ||
        s.dest.toLowerCase().includes(combinedSearch) ||
        s.courier.toLowerCase().includes(combinedSearch)
    );

    return (
      <div className="space-y-6">
        <div
          data-tour="inventory-header"
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Manajemen Pengiriman & Gate Pass (Outbound)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Daftar pengiriman barang keluar gudang, otorisasi gerbang keluar, dan pelacakan kurir.
            </p>
          </div>
          <button
            onClick={() => setShowShippingModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-md transition-all flex items-center space-x-2"
          >
            <span>âž•</span>
            <span>Buat Pengiriman Baru</span>
          </button>
        </div>

        <div
          data-tour="inventory-main-section"
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="p-4 border-b border-slate-200">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Cari resi, tujuan, atau kurir..."
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="p-4">No. Resi / Ref</th>
                  <th className="p-4">Tujuan / Pelanggan</th>
                  <th className="p-4">Kurir</th>
                  <th className="p-4">Tanggal Kirim</th>
                  <th className="p-4">Gate Pass</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredShip.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-4 font-mono font-bold text-blue-600">{s.resi}</td>
                    <td className="p-4 font-medium">{s.dest}</td>
                    <td className="p-4">{s.courier}</td>
                    <td className="p-4 text-slate-500">{s.date}</td>
                    <td className="p-4">
                      <span className="bg-emerald-50 text-emerald-700 font-mono text-xs px-2.5 py-1 rounded-lg font-bold">
                        {s.gatePass || 'Belum tersedia'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-lg font-semibold">
                        {s.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => handlePrintShipping(s)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold whitespace-nowrap"
                      >
                        Cetak Surat Jalan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showShippingModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-900">
                  Buat Pengiriman & Gate Pass Baru
                </h3>
                <button
                  onClick={() => setShowShippingModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  âœ•
                </button>
              </div>
              <form onSubmit={handleAddShipping} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      No. Resi / Surat Jalan
                    </label>
                    <input
                      type="text"
                      required
                      value={shipForm.resi}
                      onChange={(e) => setShipForm({ ...shipForm, resi: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Kurir Pengiriman
                    </label>
                    <select
                      value={shipForm.courier}
                      onChange={(e) => setShipForm({ ...shipForm, courier: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    >
                      <option value="JNE Express">JNE Express</option>
                      <option value="SiCepat Ekspres">SiCepat Ekspres</option>
                      <option value="J&T Cargo">J&T Cargo</option>
                      <option value="Internal Armada Gudang">Internal Armada Gudang</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Tujuan / Nama Pelanggan
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="PT Sentosa Computer (Surabaya)"
                    value={shipForm.dest}
                    onChange={(e) => setShipForm({ ...shipForm, dest: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Daftar EPC Barang (pisahkan dengan baris baru atau koma)
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={shipForm.epcs}
                    onChange={(e) => setShipForm({ ...shipForm, epcs: e.target.value })}
                    placeholder="Contoh: QA-EPC-001"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Total Pembayaran
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={shipForm.total_amount}
                    onChange={(e) => setShipForm({ ...shipForm, total_amount: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs text-blue-800">
                    Pengiriman hanya dapat dicatat jika seluruh EPC sudah berstatus AUTHORIZED_OUT. Status Gate Pass ditampilkan jika disediakan oleh backend.
                  </p>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowShippingModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingShipping}
                    className="px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-medium shadow-md disabled:opacity-60"
                  >
                    {isSavingShipping ? 'Menyimpan...' : 'Terbitkan & Simpan'}
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
  // MENU 4: BUKU BESAR PERGERAKAN (LEDGER APPEND-ONLY)
  // ============================================================================
  const filteredLedger = ledger.filter((movement) => {
    const searchable = [
      movement.tx_code,
      movement.sku,
      movement.product_name,
      movement.movement_type,
      movement.reference_doc,
      movement.from_location,
      movement.to_location,
      movement.operator_name,
    ];
    return searchable.some((value) =>
      String(value ?? '').toLowerCase().includes(combinedSearch)
    );
  });

  return (
    <div className="space-y-6">
      <div
        data-tour="inventory-header"
        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900">
              Buku Besar Pergerakan Stok (Stock Ledger)
            </h2>
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-indigo-200">
              Append-Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Seluruh mutasi tercatat permanen tanpa menimpa angka stok; menjamin setiap selisih dapat diaudit.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportLedger}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-md transition-all flex items-center space-x-2"
        >
          <span>ðŸ“¥</span>
          <span>Export Data Ledger</span>
        </button>
      </div>

      <div
        data-tour="inventory-main-section"
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="p-4 border-b border-slate-200 flex justify-between gap-3">
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Cari transaksi, produk, lokasi, operator, atau dokumen..."
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-full sm:w-80 focus:outline-none"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <th className="p-4">Kode Transaksi</th>
                <th className="p-4">Waktu</th>
                <th className="p-4">Jenis Mutasi</th>
                <th className="p-4">Produk</th>
                <th className="p-4">Lokasi Asal</th>
                <th className="p-4">Lokasi Tujuan</th>
                <th className="p-4">Perubahan</th>
                <th className="p-4">Saldo Berjalan</th>
                <th className="p-4">Operator</th>
                <th className="p-4">Dokumen Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLedger.map((movement) => {
                const qtyChange = Number(movement.qty_change ?? movement.qty ?? 0);
                return (
                  <tr key={movement.id || movement.tx_code} className="hover:bg-slate-50">
                    <td className="p-4 font-mono font-bold text-blue-600">
                      {movement.tx_code || movement.id || '-'}
                    </td>
                    <td className="p-4 text-xs text-slate-500 whitespace-nowrap">
                      {movement.created_at
                        ? new Date(movement.created_at).toLocaleString('id-ID')
                        : '-'}
                    </td>
                    <td className="p-4">
                      <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-lg font-bold">
                        {movement.movement_type || '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-mono font-semibold">{movement.sku || '-'}</div>
                      <div className="text-xs text-slate-500">{movement.product_name || '-'}</div>
                    </td>
                    <td className="p-4 text-xs">{movement.from_location || '-'}</td>
                    <td className="p-4 text-xs">{movement.to_location || '-'}</td>
                    <td
                      className={`p-4 font-bold ${
                        qtyChange >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {qtyChange > 0 ? '+' : ''}
                      {qtyChange}
                    </td>
                    <td className="p-4 font-semibold text-slate-800">
                      {movement.running_balance ?? '-'}
                    </td>
                    <td className="p-4 text-xs">
                      {movement.operator_name || movement.performed_by_name || 'Tidak diketahui'}
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-600">
                      {movement.reference_doc || '-'}
                    </td>
                  </tr>
                );
              })}
              {filteredLedger.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    Belum ada data mutasi stok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}