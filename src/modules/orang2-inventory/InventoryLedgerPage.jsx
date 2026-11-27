import React, { useEffect, useState } from 'react';
import { Download, FileText, MapPin, Plus, Printer, Send } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { tokenStorageKey } from '../../config/authSession';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const emptyShipment = {
  sourceKey: '', resi: '', courier: 'JNE Express', dest: '', epcs: '', total_amount: '0',
};

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
  const [selectedRackId, setSelectedRackId] = useState(null);
  const [editingRack, setEditingRack] = useState(null);
  const [deleteRackTarget, setDeleteRackTarget] = useState(null);
  const [rackActionBusy, setRackActionBusy] = useState(false);
  const [isSavingRack, setIsSavingRack] = useState(false);
  const [rackForm, setRackForm] = useState({
    code: '',
    zone_code: '',
    name: '',
    max_capacity: '',
  });

  // Putaway Form State (Mendukung satuan & massal/bulk)
  const [epcCode, setEpcCode] = useState('');
  const [targetLoc, setTargetLoc] = useState('');
  const [allTags, setAllTags] = useState([]);
  const [allBoxes, setAllBoxes] = useState([]);
  const [pickingOrders, setPickingOrders] = useState([]);
  const [posOrders, setPosOrders] = useState([]);
  const [selectedPutawayEpcs, setSelectedPutawayEpcs] = useState([]);
  const [isBulkPutaway, setIsBulkPutaway] = useState(false);

  // Riwayat pengiriman dimuat dari backend Outbound.
  const [shippingList, setShippingList] = useState([]);
  const [isSavingShipping, setIsSavingShipping] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [shipForm, setShipForm] = useState(emptyShipment);
  const shippingSources = [
    { key: 'STOK_BEBAS', label: 'Stok Bebas', source: { type: 'STOK_BEBAS' } },
    ...pickingOrders.filter(order => order.status !== 'DIBATALKAN'
      && ['PICKING_ORANG1', 'OUTBOUND_PICKING'].includes(order.source_type) && order.items?.length).map(order => ({
      key: `${order.source_type}:${order.id}`,
      label: `${order.source_type === 'PICKING_ORANG1' ? 'Picking & Packing' : 'Picking Outbound'} · ${order.order_number}`,
      source: { type: order.source_type, order_id: order.id },
      epcs: order.items.map(item => item.epc).filter(Boolean),
      resi: `RESI-${order.order_number}`,
      destination: order.source_type === 'OUTBOUND_PICKING' ? order.destination : '',
    })),
    ...posOrders.filter(sale => sale.epcs?.length).map(sale => ({
      key: `POS:${sale.id}`, label: `Penjualan POS · ${sale.invoice_or_resi}`,
      source: { type: 'POS', sale_id: sale.id }, epcs: sale.epcs,
    })),
  ];
  const shippingSource = shippingSources.find(option => option.key === shipForm.sourceKey);

  const fetchInventoryData = async () => {
    try {
      const token = localStorage.getItem(tokenStorageKey);
      const [locRes, ledRes, shipRes, tagsRes, boxesRes, pickRes, posRes] = await Promise.all([
        fetch(`${API_BASE_URL}/locations`),
        fetch(`${API_BASE_URL}/inventory/ledger`),
        fetch(`${API_BASE_URL}/outbound/shipments`),
        fetch(`${API_BASE_URL}/tags`).catch(() => null),
        fetch(`${API_BASE_URL}/boxes`).catch(() => null),
        fetch(`${API_BASE_URL}/outbound/picking-orders?for_handoff=1`).catch(() => null),
        activeMenu === 'pengiriman' && token
          ? fetch(`${API_BASE_URL}/outbound/pos-orders`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
          : null,
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

      if (tagsRes && tagsRes.ok) {
        const tagsJson = await tagsRes.json().catch(() => ({}));
        setAllTags(Array.isArray(tagsJson.data) ? tagsJson.data : []);
      }

      if (boxesRes && boxesRes.ok) {
        const boxesJson = await boxesRes.json().catch(() => ({}));
        setAllBoxes(Array.isArray(boxesJson.data) ? boxesJson.data : []);
      }

      const pickJson = pickRes?.ok ? await pickRes.json().catch(() => ({})) : {};
      setPickingOrders(Array.isArray(pickJson.data) ? pickJson.data : []);
      const posJson = posRes?.ok ? await posRes.json().catch(() => ({})) : {};
      setPosOrders(Array.isArray(posJson.data) ? posJson.data : []);

      if (shipRes.ok) {
        const shipJson = await shipRes.json();
        setShippingList(
          (Array.isArray(shipJson.data) ? shipJson.data : []).map((row) => ({
            id: row.id,
            resi: row.invoice_or_resi,
            dest: row.customer_or_destination || '-',
            courier: row.courier || '-',
            createdAt: row.created_at || null,
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
  }, [lastEvent, activeMenu]);

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
    const typedEpcs = epcCode
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const epcQueue = [...new Set([...selectedPutawayEpcs, ...typedEpcs])];

    if (epcQueue.length === 0 || !targetLoc) {
      showNotification?.('Pilih minimal satu EPC atau ketik EPC, lalu pilih rak tujuan.', 'error');
      return;
    }

    setIsBulkPutaway(true);
    let okCount = 0;
    let failCount = 0;
    let lastError = '';

    try {
      for (const epc of epcQueue) {
        const res = await fetch(`${API_BASE_URL}/inventory/putaway`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ epc, location_code: targetLoc }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          okCount += 1;
        } else {
          failCount += 1;
          lastError = json.message || `Gagal putaway ${epc}`;
        }
      }

      await fetchInventoryData();
      setSelectedPutawayEpcs([]);
      if (okCount > 0 && failCount === 0) {
        setEpcCode('');
        showNotification?.(
          `${okCount} barang berhasil ditempatkan di ${targetLoc}.`,
          'success'
        );
      } else if (okCount > 0 && failCount > 0) {
        showNotification?.(
          `${okCount} berhasil, ${failCount} gagal (${lastError}).`,
          'warn'
        );
      } else {
        showNotification?.(lastError || 'Gagal memproses Putaway.', 'error');
      }
    } catch (err) {
      console.error('Putaway error:', err);
      showNotification?.(err.message || 'Terjadi kesalahan saat Putaway.', 'error');
    } finally {
      setIsBulkPutaway(false);
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

  const handleUpdateRack = async (e) => {
    e.preventDefault();
    if (!editingRack?.id) return;
    setRackActionBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/locations/${encodeURIComponent(editingRack.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: editingRack.code.trim(),
          zone_code: editingRack.zone_code.trim(),
          name: editingRack.name.trim(),
          max_capacity: Number(editingRack.max_capacity),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Gagal memperbarui rak.');
      showNotification?.(json.message || 'Rak berhasil diperbarui.', 'success');
      setEditingRack(null);
      await fetchInventoryData();
    } catch (err) {
      showNotification?.(err.message || 'Gagal memperbarui rak.', 'error');
    } finally {
      setRackActionBusy(false);
    }
  };

  const handleDeleteRack = async (rack) => {
    if (!rack?.id || rackActionBusy) return;
    setRackActionBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/locations/${encodeURIComponent(rack.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Gagal menghapus rak.');
      showNotification?.(json.message || `Rak ${rack.code} berhasil dihapus.`, 'success');
      setDeleteRackTarget(null);
      setSelectedRackId(null);
      setEditingRack(null);
      await fetchInventoryData();
    } catch (err) {
      showNotification?.(err.message || 'Gagal menghapus rak.', 'error');
    } finally {
      setRackActionBusy(false);
    }
  };

  const handleQuickMoveToRack = async (epcOrBoxEpc, targetRackCode) => {
    if (!epcOrBoxEpc || !targetRackCode || rackActionBusy) return;
    setRackActionBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/putaway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epc: epcOrBoxEpc,
          location_code: targetRackCode,
          reference_doc: 'TRANSFER-ANTAR-RAK',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Gagal memindahkan ke rak tujuan.');
      showNotification?.(json.message || `Berhasil dipindahkan ke rak ${targetRackCode}.`, 'success');
      await fetchInventoryData();
    } catch (err) {
      showNotification?.(err.message || 'Gagal memindahkan barang/box.', 'error');
    } finally {
      setRackActionBusy(false);
    }
  };

  const handleQuickUnpackBox = async (box) => {
    if (!box?.id || rackActionBusy) return;
    setRackActionBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/boxes/${encodeURIComponent(box.id)}/unpack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Gagal memecah Box.');
      showNotification?.(json.message || `Box ${box.box_code} berhasil dipecah!`, 'success');
      await fetchInventoryData();
    } catch (err) {
      showNotification?.(err.message || 'Gagal memecah Box.', 'error');
    } finally {
      setRackActionBusy(false);
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
    if (!shippingSource) {
      showNotification?.('Pilih sumber Pengiriman terlebih dahulu.', 'error');
      return;
    }

    const epcs = shipForm.epcs
      .split(/[\n,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const totalAmount = Number(shipForm.total_amount);

    if (!shipForm.resi.trim() || !shipForm.dest.trim() || epcs.length === 0) {
      showNotification?.('Nomor resi, tujuan, dan minimal satu EPC wajib diisi.', 'error');
      return;
    }

    if (shippingSource.epcs && epcs.some(epc => !shippingSource.epcs.includes(epc))) {
      showNotification?.('Daftar EPC harus berasal dari sumber Pengiriman yang dipilih.', 'error');
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
          source: shippingSource.source,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409 && String(json.code || '').startsWith('SHIPMENT_SOURCE_')) {
          setShipForm(previous => ({ ...previous, sourceKey: '', epcs: '' }));
          await fetchInventoryData();
        }
        throw new Error(json.message || 'Gagal menyimpan pengiriman.');
      }

      showNotification?.(json.message || 'Pengiriman berhasil disimpan.', 'success');
      setShowShippingModal(false);
      setShipForm(emptyShipment);
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
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Peta & Zona Lokasi Rak Gudang
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Denah kapasitas rak penyimpanan, detail isi box/tag, dan penempatan Putaway RFID.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-8 px-3 text-xs">
              {rackLocations.length} Rak Terdaftar
            </Badge>
            <Button type="button" size="sm" onClick={() => setShowRackModal(true)}>
              <Plus className="h-4 w-4" />
              Tambah Rak
            </Button>
          </div>
        </div>

        <div
          data-tour="inventory-main-section"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {rackLocations.map((loc) => {
            const capacity = Number(loc.max_capacity || 0);
            const occupied = Number(loc.current_items_count || 0);
            const pct =
              capacity > 0
                ? Math.min(100, Math.round((occupied / capacity) * 100))
                : 0;
            const status = loc.capacity_status || 'Longgar';
            const badgeVariant =
              status === 'Padat'
                ? 'destructive'
                : status === 'Optimal'
                  ? 'success'
                  : 'secondary';
            const barClass =
              status === 'Padat'
                ? 'bg-destructive'
                : status === 'Optimal'
                  ? 'bg-emerald-500'
                  : 'bg-primary';

            return (
              <Card
                key={loc.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedRackId(loc.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedRackId(loc.id);
                  }
                }}
                className="text-left hover:border-primary/50 hover:shadow-md transition-all group cursor-pointer"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="font-mono font-bold text-xs">
                      {loc.code}
                    </Badge>
                    <Badge variant={badgeVariant} className="text-[11px]">
                      {status}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-2 group-hover:text-primary transition-colors">
                    {loc.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Zona: {loc.zone_code}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5 gap-2">
                      <span>Kapasitas terisi</span>
                      <span className="font-semibold text-foreground">
                        {occupied} / {capacity} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full transition-all ${barClass}`}
                      />
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      📦 <strong className="text-foreground">{Number(loc.box_count || 0)}</strong> Box · 🏷️{' '}
                      <strong className="text-foreground">{Number(loc.unit_items_count || 0)}</strong> Tag
                    </span>
                    <span className="font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                      Lihat Isi →
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {rackLocations.length === 0 && (
            <Card className="col-span-full border-dashed p-10 text-center">
              <p className="font-semibold text-foreground">Belum ada rak penyimpanan.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tambahkan rak baru menggunakan tombol Tambah Rak.
              </p>
            </Card>
          )}
        </div>

        {/* Modal Detail Isi Rak (Muncul saat kartu rak diklik) */}
        {(() => {
          const activeRack = rackLocations.find((r) => r.id === selectedRackId);
          if (!activeRack) return null;

          const capacity = Number(activeRack.max_capacity || 0);
          const occupied = Number(activeRack.current_items_count || 0);
          const pct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;
          const productsSummary = Array.isArray(activeRack.products_summary) ? activeRack.products_summary : [];
          const rackBoxes = Array.isArray(activeRack.boxes) ? activeRack.boxes : [];
          const rackUnitTags = allTags.filter(
            (t) =>
              String(t.location_id || '') === String(activeRack.id) &&
              ['IN_STOCK', 'RESERVED', 'AUTHORIZED_OUT'].includes(String(t.status || '').toUpperCase())
          );

          return (
            <div
              onClick={() => setSelectedRackId(null)}
              className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-card text-card-foreground w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl p-6 shadow-2xl border border-border space-y-5"
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-sm text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                        {activeRack.code}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                        Zona: {activeRack.zone_code}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {activeRack.capacity_status || 'Longgar'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-2">
                      {activeRack.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={rackActionBusy}
                      onClick={() =>
                        setEditingRack(
                          editingRack?.id === activeRack.id
                            ? null
                            : {
                                id: activeRack.id,
                                code: activeRack.code,
                                zone_code: activeRack.zone_code,
                                name: activeRack.name,
                                max_capacity: String(activeRack.max_capacity || 50),
                              }
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                    >
                      {editingRack?.id === activeRack.id ? 'Batal Edit' : '✏️ Edit Rak'}
                    </button>
                    {occupied === 0 && (
                      <button
                        type="button"
                        disabled={rackActionBusy}
                        onClick={() => setDeleteRackTarget(activeRack)}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition"
                      >
                        🗑️ Hapus Rak
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRackId(null);
                        setEditingRack(null);
                      }}
                      className="text-slate-400 hover:text-slate-700 text-2xl leading-none px-2"
                      aria-label="Tutup detail rak"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {editingRack?.id === activeRack.id && (
                  <form
                    onSubmit={handleUpdateRack}
                    className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-3"
                  >
                    <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                      Edit Konfigurasi Rak {activeRack.code}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Kode Rak
                        </label>
                        <input
                          required
                          value={editingRack.code}
                          onChange={(e) => setEditingRack({ ...editingRack, code: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Kode Zona
                        </label>
                        <input
                          required
                          value={editingRack.zone_code}
                          onChange={(e) => setEditingRack({ ...editingRack, zone_code: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Nama Rak
                        </label>
                        <input
                          required
                          value={editingRack.name}
                          onChange={(e) => setEditingRack({ ...editingRack, name: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Kapasitas Maksimum (min. {Math.max(1, occupied)})
                        </label>
                        <input
                          required
                          type="number"
                          min={Math.max(1, occupied)}
                          step="1"
                          value={editingRack.max_capacity}
                          onChange={(e) => setEditingRack({ ...editingRack, max_capacity: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        disabled={rackActionBusy}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                      >
                        {rackActionBusy ? 'Menyimpan...' : 'Simpan Perubahan Rak'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Ringkasan Angka */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[11px] text-slate-500 font-medium">Total Terisi</p>
                    <p className="text-base font-bold text-slate-900 mt-0.5">
                      {occupied} / {capacity} <span className="text-xs font-normal text-slate-500">({pct}%)</span>
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200">
                    <p className="text-[11px] text-indigo-700 font-medium">Kemasan Box</p>
                    <p className="text-base font-bold text-indigo-900 mt-0.5">
                      {Number(activeRack.box_count || 0)} Box{' '}
                      <span className="text-xs font-normal text-indigo-700">
                        ({Number(activeRack.box_units_count || 0)} unit)
                      </span>
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200">
                    <p className="text-[11px] text-blue-700 font-medium">Tag RFID Satuan</p>
                    <p className="text-base font-bold text-blue-900 mt-0.5">
                      {Number(activeRack.unit_items_count || 0)} Tag
                    </p>
                  </div>
                </div>

                {/* Daftar Produk di Rak */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Ringkasan Produk di Rak ({productsSummary.length} SKU)
                  </h4>
                  {productsSummary.length > 0 ? (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      {productsSummary.map((prod) => (
                        <div
                          key={prod.product_id || prod.sku}
                          className="px-4 py-2.5 bg-white flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{prod.product_name}</p>
                            <p className="font-mono text-[11px] text-slate-500">
                              {prod.sku}
                              {Number(prod.box_count) > 0
                                ? ` · 📦 ${prod.box_count} Box (${prod.box_qty} unit)`
                                : ''}
                              {Number(prod.unit_qty) > 0
                                ? ` · 🏷️ ${prod.unit_qty} Tag Satuan`
                                : ''}
                            </p>
                          </div>
                          <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg shrink-0">
                            {prod.total_qty} unit
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                      Rak ini masih kosong (belum ada box maupun tag satuan).
                    </div>
                  )}
                </div>

                {/* Daftar Box di Rak (dengan Aksi Cepat Pecah Box & Pindah Rak) */}
                {rackBoxes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Daftar Box di Rak Ini ({rackBoxes.length} Box)
                    </h4>
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                      {rackBoxes.map((bx) => {
                        const otherRacks = rackLocations.filter((r) => r.id !== activeRack.id);
                        return (
                          <div
                            key={bx.id || bx.box_code}
                            className="px-4 py-2.5 bg-white flex flex-wrap items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-indigo-700">
                                  {bx.box_code}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {bx.box_level === 'MASTER' ? 'MASTER BOX' : 'INNER BOX'}
                                </span>
                                <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                  {bx.qty_per_box} unit
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {bx.product_name} ({bx.sku}) · EPC: <span className="font-mono">{bx.master_epc}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={rackActionBusy}
                                onClick={() => handleQuickUnpackBox(bx)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold disabled:opacity-50"
                                title="Pecah Box (Break-Pack) langsung di rak ini"
                              >
                                {bx.box_level === 'MASTER' ? '🔨 Pecah ke Inner' : '🔨 Pecah ke Tag'}
                              </button>
                              {otherRacks.length > 0 && (
                                <select
                                  aria-label={`Pindah ${bx.box_code} ke rak lain`}
                                  disabled={rackActionBusy}
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleQuickMoveToRack(bx.master_epc || bx.box_code, e.target.value);
                                      e.target.value = '';
                                    }
                                  }}
                                  className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700"
                                >
                                  <option value="">⇄ Pindah Rak...</option>
                                  {otherRacks.map((r) => (
                                    <option key={r.id} value={r.code}>
                                      Ke {r.code} ({r.name})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Daftar Tag RFID Satuan di Rak (dengan Aksi Cepat Pindah Rak) */}
                {rackUnitTags.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Daftar Tag RFID Satuan di Rak Ini ({rackUnitTags.length} Tag)
                    </h4>
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                      {rackUnitTags.map((tg) => {
                        const otherRacks = rackLocations.filter((r) => r.id !== activeRack.id);
                        const canTransfer = String(tg.status || '').toUpperCase() === 'IN_STOCK';
                        return (
                          <div
                            key={tg.id || tg.epc}
                            className="px-4 py-2 bg-white flex flex-wrap items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-mono font-semibold text-slate-800">{tg.epc}</p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {tg.product_name || '-'} ({tg.sku || '-'})
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {tg.status}
                              </span>
                              {canTransfer && otherRacks.length > 0 && (
                                <select
                                  aria-label={`Pindah EPC ${tg.epc} ke rak lain`}
                                  disabled={rackActionBusy}
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleQuickMoveToRack(tg.epc, e.target.value);
                                      e.target.value = '';
                                    }
                                  }}
                                  className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700"
                                >
                                  <option value="">⇄ Pindah Rak...</option>
                                  {otherRacks.map((r) => (
                                    <option key={r.id} value={r.code}>
                                      Ke {r.code}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedRackId(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Modal Konfirmasi Hapus Rak Kosong */}
        {deleteRackTarget && (
          <div
            onClick={() => !rackActionBusy && setDeleteRackTarget(null)}
            className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-card text-card-foreground w-full max-w-md rounded-2xl p-6 shadow-2xl border border-border space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0 text-lg">
                  🗑️
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Hapus Rak {deleteRackTarget.code}?
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Rak <strong>{deleteRackTarget.name}</strong> (Zona {deleteRackTarget.zone_code}) saat ini kosong (`0` unit) dan akan dihapus permanen dari daftar lokasi gudang.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={rackActionBusy}
                  onClick={() => setDeleteRackTarget(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={rackActionBusy}
                  onClick={() => handleDeleteRack(deleteRackTarget)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {rackActionBusy ? 'Menghapus...' : 'Ya, Hapus Rak'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Tambah Rak */}
        {showRackModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="bg-card text-card-foreground border border-border w-full max-w-lg rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Tambah Rak Baru</h3>
                  <p className="text-xs text-muted-foreground mt-1">Data akan disimpan ke PostgreSQL.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRackModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xl"
                  aria-label="Tutup modal"
                >
                  ×
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

        {/* Form Putaway / Pindah Lokasi Rak (Mendukung Tag Satuan & Box Massal) */}
        <Card className="p-6 space-y-4">
          {(() => {
            const readyPutawayTags = allTags
              .filter((t) => String(t.status || '').toUpperCase() === 'ENCODED')
              .map((t) => ({
                key: t.id || t.epc,
                code: t.epc,
                isBox: false,
                label: t.epc,
                sublabel: `${t.sku || ''} ${t.product_name || 'Tag ENCODED'}`.trim(),
                badge: 'TAG',
              }));
            const readyPutawayBoxes = allBoxes
              .filter((b) => ['SEALED', 'IN_RACK'].includes(String(b.status || '').toUpperCase()))
              .map((b) => ({
                key: b.id || b.box_code,
                code: b.master_epc || b.box_code,
                isBox: true,
                label: `${b.box_code} (${b.product_name || b.sku})`,
                sublabel: `EPC: ${b.master_epc} · ${b.qty_per_box} unit · ${b.location_code ? `Rak ${b.location_code}` : 'Staging INB01'}`,
                badge: b.box_level === 'MASTER' ? 'MASTER BOX' : 'INNER BOX',
              }));
            const allPutawayCandidates = [...readyPutawayBoxes, ...readyPutawayTags];

            return (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Putaway & Transfer Tag RFID / Box Antar-Rak (Satuan / Massal)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Centang Box (Master/Inner Box) atau Tag RFID dari Staging Inbound (INB01) maupun pindah rak untuk ditempatkan ke Rak Penyimpanan Utama.
                    </p>
                  </div>
                  {allPutawayCandidates.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                      {readyPutawayBoxes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedPutawayEpcs(readyPutawayBoxes.map((b) => b.code))}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold transition"
                        >
                          Pilih Semua Box ({readyPutawayBoxes.length})
                        </button>
                      )}
                      {readyPutawayTags.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedPutawayEpcs(readyPutawayTags.map((t) => t.code))}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold transition"
                        >
                          Pilih Semua Tag ({readyPutawayTags.length})
                        </button>
                      )}
                      {selectedPutawayEpcs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedPutawayEpcs([])}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold transition"
                        >
                          Batal ({selectedPutawayEpcs.length})
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {allPutawayCandidates.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2.5 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {allPutawayCandidates.map((item) => {
                      const checked = selectedPutawayEpcs.includes(item.code);
                      return (
                        <label
                          key={item.key}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition ${
                            checked
                              ? 'bg-blue-50 border-blue-300 text-blue-900'
                              : item.isBox
                              ? 'bg-indigo-50/40 border-indigo-200 text-slate-800 hover:border-indigo-300'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedPutawayEpcs((prev) =>
                                checked ? prev.filter((e) => e !== item.code) : [...prev, item.code]
                              )
                            }
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="font-mono font-semibold truncate">{item.label}</p>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                  item.isBox
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {item.badge}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">{item.sublabel}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}

          <form onSubmit={handlePutaway} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              required={selectedPutawayEpcs.length === 0}
              value={epcCode}
              onChange={(e) => setEpcCode(e.target.value)}
              placeholder={
                selectedPutawayEpcs.length > 0
                  ? `${selectedPutawayEpcs.length} Tag/Box terpilih (opsional tambah manual)`
                  : 'Kode EPC Tag / Master EPC Box / Kode Box (bisa pisah koma)'
              }
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-mono text-foreground shadow-sm"
            />
            <select
              required
              value={targetLoc}
              onChange={(e) => setTargetLoc(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm"
            >
              <option value="">Pilih rak tujuan</option>
              {rackLocations.map((l) => (
                <option key={l.id || l.code} value={l.code}>
                  {l.code} - {l.name}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              disabled={rackLocations.length === 0 || isBulkPutaway}
              className="w-full"
            >
              {isBulkPutaway
                ? 'Memproses Putaway...'
                : selectedPutawayEpcs.length > 0
                ? `Simpan ${selectedPutawayEpcs.length} Tag ke Rak`
                : 'Simpan Putaway Rak'}
            </Button>
          </form>
        </Card>
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
    const shipStatuses = [...new Set(shippingList.map((s) => s.status).filter(Boolean))].sort();
    const shipCouriers = [...new Set(shippingList.map((s) => s.courier).filter((c) => c && c !== '-'))].sort();

    const shipColumns = [
      {
        accessorKey: 'resi',
        header: 'No. Resi / Ref',
        cell: ({ row }) => <span className="font-mono font-semibold">{row.original.resi}</span>,
      },
      {
        accessorKey: 'dest',
        header: 'Tujuan / Pelanggan',
        cell: ({ row }) => <span className="font-medium">{row.original.dest}</span>,
      },
      { accessorKey: 'courier', header: 'Kurir' },
      {
        id: 'createdAt',
        header: 'Tanggal Kirim',
        accessorFn: (row) => (row.createdAt ? new Date(row.createdAt).getTime() : 0),
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground whitespace-nowrap">{row.original.date}</span>
        ),
      },
      {
        accessorKey: 'gatePass',
        header: 'Gate Pass',
        cell: ({ row }) =>
          row.original.gatePass ? (
            <Badge variant="success" className="font-mono">{row.original.gatePass}</Badge>
          ) : (
            <span className="text-muted-foreground">Belum tersedia</span>
          ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = String(row.original.status).toUpperCase();
          const done = s.includes('SHIPPED') || s.includes('KELUAR');
          return <Badge variant={done ? 'success' : 'secondary'}>{row.original.status}</Badge>;
        },
      },
      {
        id: 'actions',
        header: 'Aksi',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handlePrintShipping(row.original)}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Cetak Surat Jalan
          </Button>
        ),
      },
    ];

    return (
      <div className="space-y-6">
        <div
          data-tour="inventory-header"
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Pengiriman</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Daftar pengiriman barang keluar gudang, otorisasi gerbang keluar, dan pelacakan kurir.
              </p>
            </div>
          </div>
          <Button type="button" size="sm" onClick={() => setShowShippingModal(true)}>
            <Plus className="h-4 w-4" />
            Buat Pengiriman Baru
          </Button>
        </div>

        <div data-tour="inventory-main-section">
          <DataTable
            data={shippingList}
            columns={shipColumns}
            externalSearch={searchQuery}
            searchPlaceholder="Cari resi, tujuan, atau kurir..."
            dateField="createdAt"
            initialSorting={[{ id: 'createdAt', desc: true }]}
            filters={[
              { key: 'status', label: 'Status', options: shipStatuses.map((v) => ({ value: v, label: v })) },
              { key: 'courier', label: 'Kurir', options: shipCouriers.map((v) => ({ value: v, label: v })) },
            ]}
            emptyMessage="Belum ada data pengiriman."
          />
        </div>

        {showShippingModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
            <div className="bg-card text-card-foreground rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-foreground">
                  Buat Pengiriman & Gate Pass Baru
                </h3>
                <button
                  onClick={() => setShowShippingModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleAddShipping} className="space-y-4">
                <label className="block p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                      Sumber Pengiriman
                    </span>
                    <select
                      required
                      value={shippingSource?.key || ''}
                      disabled={isSavingShipping}
                      onChange={(e) => {
                        const next = shippingSources.find(option => option.key === e.target.value);
                        setShipForm((prev) => ({
                          ...prev,
                          sourceKey: next?.key ?? '',
                          resi: next?.resi ?? '',
                          dest: next?.destination ?? '',
                          epcs: next?.epcs?.join('\n') ?? '',
                          total_amount: '0',
                        }));
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="">Pilih sumber</option>
                      {shippingSources.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                    </select>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="outbound-resi" className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      No. Resi / Surat Jalan
                    </label>
                    <input
                      id="outbound-resi"
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
                  <label htmlFor="outbound-destination" className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Tujuan / Nama Pelanggan
                  </label>
                  <input
                    id="outbound-destination"
                    type="text"
                    required
                    placeholder="PT Sentosa Computer (Surabaya)"
                    value={shipForm.dest}
                    onChange={(e) => setShipForm({ ...shipForm, dest: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  {(() => {
                    const tagsByEpc = new Map(allTags.map(tag => [tag.epc, tag]));
                    const shippableTags = shippingSource?.source.type === 'STOK_BEBAS'
                      ? [
                          ...allBoxes
                            .filter(b => b.status === 'IN_RACK')
                            .map(b => ({
                              id: b.id,
                              epc: b.master_epc,
                              displayCode: `${b.box_code} (${b.product_name || b.sku} · ${b.qty_per_box}u)`,
                              status: 'BOX IN_RACK',
                              isBox: true,
                            })),
                          ...allTags
                            .filter(tag => tag.status === 'IN_STOCK')
                            .map(tag => ({
                              ...tag,
                              displayCode: `${tag.epc}${tag.product_name ? ` (${tag.product_name})` : ''}`,
                            })),
                        ]
                      : (shippingSource?.epcs ?? []).map(epc => tagsByEpc.get(epc) ?? { epc });
                    const currentEpcs = shipForm.epcs
                      .split(/[\n,;]+/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    return (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-600 uppercase">
                            Pilih EPC Barang Massal ({shippableTags.length} tersedia)
                          </label>
                          {shippableTags.length > 0 && (
                            <div className="flex items-center gap-2 text-[11px]">
                              <button
                                type="button"
                                onClick={() =>
                                  setShipForm({
                                    ...shipForm,
                                    epcs: shippableTags.map((t) => t.epc).join('\n'),
                                  })
                                }
                                className="font-semibold text-blue-600 hover:underline"
                              >
                                Pilih Semua
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                onClick={() => setShipForm({ ...shipForm, epcs: '' })}
                                className="font-semibold text-slate-500 hover:underline"
                              >
                                Bersihkan
                              </button>
                            </div>
                          )}
                        </div>
                        {shippableTags.length > 0 && (
                          <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1 mb-2">
                            {shippableTags.map((t) => {
                              const checked = currentEpcs.includes(t.epc);
                              const isAuthOut = String(t.status).toUpperCase() === 'AUTHORIZED_OUT';
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
                                        setShipForm({ ...shipForm, epcs: next.join('\n') });
                                      }}
                                      className="rounded border-slate-300 text-blue-600"
                                    />
                                    <span className="font-mono font-semibold text-slate-800 truncate">
                                      {t.displayCode || t.epc}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                                      isAuthOut
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {t.status}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <textarea
                    required
                    rows={3}
                    aria-label="EPC Pengiriman"
                    disabled={!shippingSource || isSavingShipping}
                    value={shipForm.epcs}
                    onChange={(e) => setShipForm({ ...shipForm, epcs: e.target.value })}
                    placeholder="Atau paste banyak EPC (pisahkan baris baru atau koma)..."
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
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="text-xs text-emerald-800 font-medium">
                    ✅ <strong>Otorisasi & Gate Pass Otomatis (1-Langkah):</strong> Cukup pilih EPC di sini (baik yang sudah selesai Picking/Packing maupun stok rak). Sistem akan otomatis mengubah status menjadi <code>AUTHORIZED_OUT</code> dan menerbitkan nomor <strong>Gate Pass ACTIVE</strong> untuk langsung diverifikasi Satpam di menu <em>Keamanan & Pass</em>.
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
                    disabled={isSavingShipping || !shippingSource}
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
  // MENU 4: BUKU BESAR PERGERAKAN (LEDGER APPEND-ONLY) — TanStack DataTable
  // ============================================================================
  const movementTypes = [...new Set(ledger.map((m) => m.movement_type).filter(Boolean))].sort();

  const ledgerColumns = [
    {
      accessorKey: 'tx_code',
      header: 'Kode Transaksi',
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-foreground">
          {row.original.tx_code || row.original.id || '-'}
        </span>
      ),
    },
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
      accessorKey: 'movement_type',
      header: 'Jenis Mutasi',
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-mono text-[11px]">
          {row.original.movement_type || '-'}
        </Badge>
      ),
    },
    {
      accessorKey: 'product_name',
      header: 'Produk / SKU',
      cell: ({ row }) => (
        <div>
          <div className="font-mono font-semibold">{row.original.sku || '-'}</div>
          <div className="text-[11px] text-muted-foreground">
            {row.original.product_name || '-'}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'from_location',
      header: 'Lokasi Asal',
      cell: ({ row }) => row.original.from_location || '-',
    },
    {
      accessorKey: 'to_location',
      header: 'Lokasi Tujuan',
      cell: ({ row }) => row.original.to_location || '-',
    },
    {
      id: 'qty_change',
      header: 'Perubahan',
      accessorFn: (row) => Number(row.qty_change ?? row.qty ?? 0),
      cell: ({ row }) => {
        const qtyChange = Number(row.original.qty_change ?? row.original.qty ?? 0);
        return (
          <span
            className={`font-semibold ${
              qtyChange >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-destructive'
            }`}
          >
            {qtyChange > 0 ? '+' : ''}
            {qtyChange}
          </span>
        );
      },
    },
    {
      accessorKey: 'running_balance',
      header: 'Saldo Berjalan',
      cell: ({ row }) => (
        <span className="font-semibold">{row.original.running_balance ?? '-'}</span>
      ),
    },
    {
      id: 'operator',
      header: 'Operator',
      accessorFn: (row) =>
        row.operator_name || row.performed_by_name || 'Tidak diketahui',
    },
    {
      accessorKey: 'reference_doc',
      header: 'Dokumen Ref',
      cell: ({ row }) => (
        <span className="font-mono text-muted-foreground">
          {row.original.reference_doc || '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div
        data-tour="inventory-header"
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">
                Ledger Pergerakan Stok
              </h2>
              <Badge variant="outline">Append-Only</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Seluruh mutasi tercatat permanen tanpa menimpa angka stok; mendukung sorting & filter tanggal.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={handleExportLedger}>
          <Download className="h-4 w-4" />
          Export Data Ledger
        </Button>
      </div>

      <div data-tour="inventory-main-section">
        <DataTable
          data={ledger}
          columns={ledgerColumns}
          externalSearch={searchQuery}
          searchPlaceholder="Cari transaksi, SKU, lokasi, operator..."
          dateField="created_at"
          initialSorting={[{ id: 'created_at', desc: true }]}
          filters={[
            {
              key: 'movement_type',
              label: 'Jenis Mutasi',
              options: movementTypes.map((t) => ({ value: t, label: t })),
            },
          ]}
          emptyMessage="Belum ada data mutasi stok."
        />
      </div>
    </div>
  );
}
