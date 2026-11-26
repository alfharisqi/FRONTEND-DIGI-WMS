import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createEmqxWebSocketClient } from '../../services/mqttClient';
import { apiRequest } from '../../services/api';
import JsBarcode from 'jsbarcode';
import { RefreshCw, ShoppingCart } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function PosPage({ showNotification }) {
  const [products, setProducts] = useState([]);
  // Pulihkan draft keranjang saat halaman POS dibuka kembali dalam tab yang sama.
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = sessionStorage.getItem('digiwms_pos_cart');
      const parsedCart = savedCart ? JSON.parse(savedCart) : [];
      return Array.isArray(parsedCart) ? parsedCart : [];
    } catch (error) {
      console.warn('Draft keranjang POS tidak dapat dipulihkan:', error);
      return [];
    }
  });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [loading, setLoading] = useState(true);
  const [rackStockLoaded, setRackStockLoaded] = useState(false);
  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [activePosTab, setActivePosTab] = useState('kasir');
  const [epcInput, setEpcInput] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutGatePass, setCheckoutGatePass] = useState(null);
  const [cartModalOpen, setCartModalOpen] = useState(false);
    // Detail invoice POS
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDetail, setInvoiceDetail] = useState(null);
  const [invoiceDetailLoading, setInvoiceDetailLoading] = useState(false);
  const handleScanRFIDRef = useRef(null);

  const fetchProducts = async () => {
    setLoading(true);

    try {
      const [productsResult, rackStockResult] = await Promise.allSettled([
        apiRequest('/products'),
        apiRequest('/inventory/stock-by-rack'),
      ]);

      if (productsResult.status === 'rejected') throw productsResult.reason;

      const catalog = Array.isArray(productsResult.value.data)
        ? productsResult.value.data
        : [];

      if (rackStockResult.status === 'fulfilled') {
        const rackRows = Array.isArray(rackStockResult.value.data)
          ? rackStockResult.value.data
          : [];
        const stockBySku = rackRows.reduce((totals, row) => {
          const sku = String(row.sku || '');
          if (!sku) return totals;
          const available = Number(row.available_quantity ?? row.quantity ?? 0);
          const quantity = Number(row.quantity ?? available);
          const reserved = Number(row.reserved_quantity || 0);
          totals[sku] ||= { available: 0, quantity: 0, reserved: 0 };
          totals[sku].available += Number.isFinite(available) ? available : 0;
          totals[sku].quantity += Number.isFinite(quantity) ? quantity : 0;
          totals[sku].reserved += Number.isFinite(reserved) ? reserved : 0;
          return totals;
        }, {});

        setProducts(catalog.map(product => {
          const rackStock = stockBySku[product.sku] || { available: 0, quantity: 0, reserved: 0 };
          return {
            ...product,
            current_stock: rackStock.available,
            catalog_stock: Number(product.current_stock || 0),
            rack_quantity: rackStock.quantity,
            reserved_quantity: rackStock.reserved,
            stock_source: 'inventory.stock-by-rack',
          };
        }));
        setRackStockLoaded(true);
      } else {
        console.error('Gagal mengambil stok rak untuk katalog POS:', rackStockResult.reason);
        setProducts(catalog);
        setRackStockLoaded(false);
        showNotification?.('Stok rak belum dapat dimuat. Angka stok sementara mengikuti katalog produk.', 'error');
      }
    } catch (error) {
      console.error('Gagal mengambil katalog POS:', error);
      showNotification?.(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Mengambil riwayat transaksi POS dari backend
const fetchSales = async () => {
  setSalesLoading(true);

  try {
    const response = await apiRequest('/pos/sales');

    setSales(
      Array.isArray(response.data) ? response.data : []
    );
  } catch (error) {
    console.error('Gagal mengambil riwayat POS:', error);
    showNotification?.(error.message, 'error');
  } finally {
    setSalesLoading(false);
  }
};

  useEffect(() => {
  fetchProducts();
  fetchSales();
}, []);

  // Simpan draft keranjang agar tidak hilang saat berpindah menu/halaman.
  useEffect(() => {
    try {
      if (cart.length > 0) {
        sessionStorage.setItem('digiwms_pos_cart', JSON.stringify(cart));
      } else {
        sessionStorage.removeItem('digiwms_pos_cart');
      }
    } catch (error) {
      console.warn('Draft keranjang POS tidak dapat disimpan:', error);
    }
  }, [cart]);

// Mengambil detail barang dan EPC berdasarkan invoice
const fetchInvoiceDetail = async (invoiceNo) => {
  setSelectedInvoice(invoiceNo);
  setInvoiceDetail(null);
  setInvoiceDetailLoading(true);

  try {
    const response = await apiRequest(
      `/pos/sales/${encodeURIComponent(invoiceNo)}/items`
    );

    setInvoiceDetail(response.data);
  } catch (error) {
    console.error('Gagal mengambil detail invoice:', error);
    showNotification?.(error.message, 'error');
    setSelectedInvoice(null);
  } finally {
    setInvoiceDetailLoading(false);
  }
};

// Cetak invoice POS
const handlePrintInvoice = () => {
  if (!invoiceDetail?.invoice || !invoiceDetail?.items) {
    showNotification?.('Data invoice belum tersedia.', 'error');
    return;
  }

  const invoice = invoiceDetail.invoice;
  const items = invoiceDetail.items;

  // Membuat barcode resmi dari kode Gate Pass.
const gatePassCode = checkoutGatePass?.pass_code;
let gatePassBarcodeHtml = '';

if (gatePassCode) {
  const barcodeSvg = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg'
  );

  JsBarcode(barcodeSvg, gatePassCode, {
    format: 'CODE128',
    width: 2,
    height: 70,
    displayValue: true,
    fontSize: 14,
    margin: 10,
  });

  gatePassBarcodeHtml = barcodeSvg.outerHTML;
}

  const printWindow = window.open('', '_blank', 'width=900,height=700');

  if (!printWindow) {
    showNotification?.('Izinkan pop-up browser untuk mencetak invoice.', 'error');
    return;
  }

  const escapeHtml = (value) =>
    String(value ?? '-').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);

  const formatMoney = (value) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const itemRows = items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.sku)}</td>
      <td>${escapeHtml(item.product_name)}</td>
      <td>${escapeHtml(item.epc)}</td>
      <td>${formatMoney(item.unit_price)}</td>
      <td>${item.already_returned ? 'Sudah Diretur' : 'Belum Diretur'}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Invoice ${escapeHtml(invoice.invoice_or_resi)}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #1e293b;
          padding: 30px;
          font-size: 12px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 15px;
        }
        h1 { color: #1d4ed8; margin: 0; }
        h2 { margin-top: 25px; }
        .info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 20px;
        }
        .info div { padding: 10px; background: #f1f5f9; }
        .label { color: #64748b; font-size: 10px; }
        .value { font-weight: bold; margin-top: 5px; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 9px;
          text-align: left;
          word-break: break-word;
        }
        th { background: #eff6ff; }
        .total {
          text-align: right;
          font-size: 18px;
          font-weight: bold;
          margin-top: 20px;
          color: #1d4ed8;
        }
        .footer {
          margin-top: 35px;
          text-align: center;
          color: #64748b;
          border-top: 1px solid #cbd5e1;
          padding-top: 12px;
        }
        @page { size: A4; margin: 15mm; }
        @media print {
          th { print-color-adjust: exact; }
          tr { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <header class="header">
        <div>
          <h1>DIGI WMS</h1>
          <p>Warehouse Management System</p>
        </div>
        <div>
          <h2>INVOICE PENJUALAN</h2>
          <strong>${escapeHtml(invoice.invoice_or_resi)}</strong>
        </div>
      </header>

      <section class="info">
        <div>
          <div class="label">Pelanggan</div>
          <div class="value">${escapeHtml(invoice.customer_or_destination)}</div>
        </div>
        <div>
          <div class="label">Tanggal Transaksi</div>
          <div class="value">${invoice.created_at ? escapeHtml(new Date(invoice.created_at).toLocaleString('id-ID')) : '-'}</div>
        </div>
        <div>
          <div class="label">Metode Pembayaran</div>
          <div class="value">${escapeHtml(invoice.payment_method)}</div>
        </div>
        <div>
          <div class="label">Status Pembayaran</div>
          <div class="value">${escapeHtml(invoice.payment_status)}</div>
        </div>
        <div>
          <div class="label">Nama Kasir</div>
          <div class="value">${escapeHtml(invoice.cashier_or_pic)}</div>
        </div>
        <div>
          <div class="label">Jumlah Barang</div>
          <div class="value">${escapeHtml(invoice.total_items)} unit</div>
        </div>
      </section>

      <h2>Rincian Barang</h2>
      <table>
        <thead>
          <tr>
            <th>No.</th>
            <th>SKU</th>
            <th>Produk</th>
            <th>EPC RFID</th>
            <th>Harga</th>
            <th>Status Retur</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="total">
        Total Pembayaran: ${formatMoney(invoice.total_amount)}
      </div>

      ${gatePassBarcodeHtml ? `
        <div style="text-align: center; margin: 20px 0;">
          <h3>GATE PASS RESMI</h3>
          ${gatePassBarcodeHtml}
          <p>Scan barcode ini untuk verifikasi Gate Pass.</p>
        </div>
      ` : ''}

      <footer class="footer">
        Dokumen diterbitkan secara elektronik oleh DIGI WMS.
        <br>Terima kasih atas transaksi Anda.
      </footer>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.title = `Invoice - ${invoice.invoice_or_resi}`;

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
};

  const categories = useMemo(() => {
    const values = products
      .map(product => product.category)
      .filter(Boolean);

    return ['Semua', ...new Set(values)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return products.filter(product => {
      const matchesSearch =
        `${product.sku || ''} ${product.name || ''} ${product.category || ''}`
          .toLowerCase()
          .includes(keyword);

      const matchesCategory =
        selectedCategory === 'Semua' ||
        product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);


// Proses pemindaian RFID POS
const handleScanRFID = async (receivedEpc = epcInput) => {
  const epc = String(receivedEpc || '').trim();

  if (!epc) {
    showNotification?.('Masukkan EPC RFID terlebih dahulu.', 'error');
    return;
  }

  const alreadyScanned = cart.some(item =>
    item.epcs?.includes(epc) ||
    item.box_epcs?.includes(epc) ||
    item.epc === epc
  );

  if (alreadyScanned) {
    showNotification?.('RFID / Box ini sudah masuk ke keranjang.', 'error');
    setEpcInput('');
    return;
  }

  setScanLoading(true);

  try {
    const response = await apiRequest('/pos/scan', {
      method: 'POST',
      body: JSON.stringify({ epc }),
    });

    const scanned = response.data;
    const addQty = scanned.is_box ? Number(scanned.qty_per_box || 1) : 1;

    const catalogProduct = products.find(
      product => product.id === scanned.product_id
    );

    setCart(previous => {
      const existing = previous.find(
        item => item.product_id === scanned.product_id
      );

      if (existing) {
        return previous.map(item =>
          item.product_id === scanned.product_id
            ? {
                ...item,
                quantity: item.quantity + addQty,
                epc: scanned.epc,
                epcs: scanned.is_box ? (item.epcs || []) : [...(item.epcs || []), scanned.epc],
                box_epcs: scanned.is_box ? [...(item.box_epcs || []), scanned.epc] : (item.box_epcs || []),
                box_units: (item.box_units || 0) + (scanned.is_box ? addQty : 0),
              }
            : item
        );
      }

      return [
        ...previous,
        {
          product_id: scanned.product_id,
          sku: scanned.sku,
          name: scanned.name,
          category: scanned.category,
          price: Number(scanned.price),
          quantity: addQty,
          stock: Number(catalogProduct?.current_stock || 0),
          epc: scanned.epc,
          epcs: scanned.is_box ? [] : [scanned.epc],
          box_epcs: scanned.is_box ? [scanned.epc] : [],
          box_units: scanned.is_box ? addQty : 0,
        },
      ];
    });

    setEpcInput('');
    showNotification?.(
      scanned.is_box
        ? `${scanned.name} (${scanned.box_code} · ${addQty} unit) berhasil ditambahkan ke keranjang.`
        : `${scanned.name} berhasil ditambahkan ke keranjang.`,
      'success'
    );

  } catch (error) {
    showNotification?.(error.message, 'error');
  } finally {
    setScanLoading(false);
  }
};

// Menyimpan fungsi scan RFID terbaru untuk listener MQTT.
handleScanRFIDRef.current = handleScanRFID;

// Listener MQTT untuk Desktop RFID Reader POS
useEffect(() => {
  const client = createEmqxWebSocketClient((topic, data) => {
    if (topic !== 'wms/pos/live-scan') return;
    if (data.event !== 'POS_RFID_SCANNED') return;

    const epc = String(data.epc || '').trim();

    if (!epc) {
      console.warn('[POS MQTT] EPC kosong:', data);
      return;
    }

    console.log('[POS MQTT] RFID diterima:', epc);

    handleScanRFIDRef.current?.(epc);
  });

  return () => {
    const wasConnected = client.connected;
    client.end(true);
    if (wasConnected) {
      console.log('[POS MQTT] Koneksi ditutup.');
    }
  };
}, []);

// Proses checkout POS
const handleCheckout = async () => {
  if (!customerName.trim()) {
    showNotification?.('Nama pelanggan wajib diisi.', 'error');
    return;
  }

  if (cart.length === 0) {
    showNotification?.('Keranjang masih kosong.', 'error');
    return;
  }

  const scannedUnitsCount = cart.reduce(
    (sum, item) => sum + (item.epcs?.length || 0) + (item.box_units || 0),
    0
  );

  if (scannedUnitsCount !== totalItems) {
    showNotification?.(
      'Pastikan setiap barang sudah memiliki RFID atau Box yang valid.',
      'error'
    );
    return;
  }

  setCheckoutLoading(true);

  try {
    const response = await apiRequest('/pos/checkout', {
      method: 'POST',
      body: JSON.stringify({
        customer_name: customerName.trim(),
        payment: paymentMethod,
        items: cart.map(item => ({
          epcs: item.epcs || [],
          box_epcs: item.box_epcs || [],
        })),
      }),
    });

    // Simpan Gate Pass resmi dari respons checkout.
    setCheckoutGatePass(response.data.gate_pass || null);

    showNotification?.(
      `Checkout berhasil. Invoice: ${response.data.invoice_no}`,
      'success'
    );

    // Buka detail invoice setelah checkout berhasil
    await fetchInvoiceDetail(response.data.invoice_no);

    setCart([]);
    setCustomerName('');
    setPaymentMethod('CASH');
    setCashReceived('');
    setCartModalOpen(false);

    await fetchSales();
    await fetchProducts();

 } catch (error) {
  console.error('Checkout POS gagal:', error);

  if (error.data?.sale_created === true) {
    setCart([]);
    setCustomerName('');
    setPaymentMethod('CASH');
    setCashReceived('');
    setCartModalOpen(false);

    await fetchSales();
    await fetchProducts();

    showNotification?.(
      `Penjualan tercatat dengan invoice ${error.data.data?.invoice_no || ''}, tetapi Gate Pass gagal diterbitkan. Hubungi supervisor.`,
      'error'
    );
  } else {
    showNotification?.(error.message, 'error');
  }
} finally {
    setCheckoutLoading(false);
  }
};


  // Tambah produk atau tambah jumlah produk yang sudah ada
  const addProduct = (product) => {
    const stock = Number(product.current_stock || 0);

    if (stock <= 0) {
      showNotification?.('Stok produk tidak tersedia.', 'error');
      return;
    }

    const existing = cart.find(
      item => item.product_id === product.id
    );

    if (existing && existing.quantity >= stock) {
      showNotification?.(
        `Jumlah melebihi stok tersedia (${stock}).`,
        'error'
      );
      return;
    }

    setCart(previous => {
      const alreadyExists = previous.some(
        item => item.product_id === product.id
      );

      if (alreadyExists) {
        return previous.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...previous,
        {
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          price: Number(product.unit_price ?? product.price ?? 0),
          quantity: 1,
          stock: stock,
          epc: '',
        },
      ];
    });
  };

  // Tambah jumlah dari keranjang
  const increaseQuantity = (productId) => {
    const product = cart.find(
      item => item.product_id === productId
    );

    if (!product) return;

    if (product.quantity >= product.stock) {
      showNotification?.(
        `Stok maksimal tersedia adalah ${product.stock}.`,
        'error'
      );
      return;
    }

    setCart(previous =>
      previous.map(item =>
        item.product_id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  // Kurangi jumlah dari keranjang
  const decreaseQuantity = (productId) => {
    setCart(previous =>
      previous
        .map(item =>
          item.product_id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter(item => item.quantity > 0)
    );
  };


  // Hapus satu unit barang berdasarkan EPC
  const removeScannedEpc = (productId, epcToRemove) => {
    setCart(previous =>
      previous
        .map(item => {
          if (item.product_id !== productId) return item;

          const remainingEpcs = (item.epcs || [])
            .filter(epc => epc !== epcToRemove);

          return {
            ...item,
            epcs: remainingEpcs,
            epc: remainingEpcs[0] || '',
            quantity: remainingEpcs.length,
          };
        })
        .filter(item => item.quantity > 0)
    );

    showNotification?.('Barang RFID berhasil dihapus dari keranjang.', 'success');
  };


  // Hapus satu produk
  const removeProduct = (productId) => {
    setCart(previous =>
      previous.filter(item => item.product_id !== productId)
    );
  };

  // Hapus seluruh keranjang
  const clearCart = () => {
    if (cart.length === 0) return;

    const confirmed = window.confirm(
      'Apakah kamu yakin ingin menghapus semua barang dari keranjang?'
    );

    if (!confirmed) return;

    setCart([]);
    showNotification?.('Semua barang berhasil dihapus.', 'success');
  };

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const totalItems = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const cashReceivedAmount = Number(cashReceived || 0);
  const cashChange = Math.max(0, cashReceivedAmount - total);
  const cashPaymentInsufficient = paymentMethod === 'CASH' && cashReceivedAmount < total;
  const formatCashInput = (value) =>
    value ? Number(value).toLocaleString('id-ID') : '';

  const formatRupiah = (value) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="space-y-5 pb-6">

      {/* HEADER POS */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
          <ShoppingCart className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Kasir POS
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola transaksi penjualan dan pemindaian RFID DIGI WMS
          </p>
        </div>
      </div>

      {/* NAVIGASI TAB POS */}
<div className="flex items-center gap-2 border-b border-slate-200 pb-3">
  <button
    onClick={() => setActivePosTab('kasir')}
    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition ${
      activePosTab === 'kasir'
        ? 'bg-blue-600 text-white shadow-md'
        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
    }`}
  >
    🛒 Kasir
  </button>

  <button
    onClick={() => setActivePosTab('riwayat')}
    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition ${
      activePosTab === 'riwayat'
        ? 'bg-blue-600 text-white shadow-md'
        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
    }`}
  >
    🧾 Riwayat Transaksi
    <span className={`text-xs px-2 py-0.5 rounded-full ${
      activePosTab === 'riwayat'
        ? 'bg-blue-500 text-white'
        : 'bg-slate-100 text-slate-600'
    }`}>
      {sales.length}
    </span>
  </button>
</div>

    {activePosTab === 'kasir' && (
  <>
    {/* MAIN LAYOUT */}
    <div className="grid grid-cols-1 gap-5 items-start">

        {/* KATALOG PRODUK */}
        <section className="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden">

          <div className="p-5 border-b border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="font-bold text-lg text-slate-900">
                  Katalog Produk
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {rackStockLoaded
                    ? 'Stok tersedia dihitung dari seluruh rak inventaris.'
                    : 'Stok rak belum tersedia; angka mengikuti katalog produk.'}
                </p>
              </div>

              <button
                onClick={fetchProducts}
                disabled={loading}
                className="text-sm text-blue-600 font-semibold hover:text-blue-800 disabled:opacity-50"
              >
                ↻ Refresh
              </button>
            </div>

            {/* SEARCH */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                🔎
              </span>

              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Cari nama barang, SKU, atau kategori..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
              />
            </div>


            {/* RFID SCANNER INPUT */}
            <div className="mt-5 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">📡</span>
                <div>
                  <h3 className="text-sm font-bold text-blue-900">
                    Pemindaian RFID
                  </h3>
                  <p className="text-xs text-blue-600">
                    Masukkan EPC atau gunakan simulasi scanner RFID
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={epcInput}
                  onChange={event => setEpcInput(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      handleScanRFID();
                    }
                  }}
                  placeholder="Masukkan kode EPC RFID..."
                  className="flex-1 min-w-0 bg-white border border-blue-200 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={scanLoading}
                />

                <button
                  onClick={() => handleScanRFID()}
                  disabled={scanLoading || !epcInput.trim()}
                  className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-bold transition"
                >
                  {scanLoading ? 'Memindai...' : '📡 Scan RFID'}
                </button>
              </div>
            </div>


            {/* CATEGORY FILTER */}
            <div className="flex gap-2 overflow-x-auto mt-4 pb-1">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs font-semibold transition ${
                    selectedCategory === category
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* PRODUCT GRID */}
          <div className="p-5">
            {loading ? (
              <div className="text-center py-16 text-slate-500">
                Memuat katalog produk...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📦</div>
                <p className="font-semibold text-slate-700">
                  Produk tidak ditemukan
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Coba kata kunci atau kategori lainnya.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map(product => {
                  const stock = Number(product.current_stock || 0);
                  const noRackAllocation = stock <= 0 &&
                    Number(product.rack_quantity || 0) <= 0 &&
                    Number(product.catalog_stock || 0) > 0;
                  const fullyReserved = stock <= 0 &&
                    Number(product.rack_quantity || 0) > 0 &&
                    Number(product.reserved_quantity || 0) > 0;
                  const price = Number(
                    product.unit_price ?? product.price ?? 0
                  );

                  const cartItem = cart.find(
                    item => item.product_id === product.id
                  );

                  const unavailable = stock <= 0;
                  const maxReached =
                    cartItem && cartItem.quantity >= stock;

                  return (
                    <div
                      key={product.id}
                      className="group border border-slate-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition bg-white"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[11px] font-mono text-slate-400">
                          {product.sku}
                        </span>

                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          unavailable
                            ? fullyReserved
                              ? 'bg-amber-100 text-amber-700'
                              : noRackAllocation
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-rose-100 text-rose-600'
                            : stock <= 5
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {unavailable
                            ? fullyReserved
                              ? 'Dipesan'
                              : noRackAllocation
                                ? 'Belum di rak'
                                : 'Habis'
                            : `Stok ${stock}`}
                        </span>
                      </div>

                      <div className="mt-5 mb-4">
                        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-xl mb-3">
                          📦
                        </div>

                        <h3 className="font-bold text-sm text-slate-800 leading-snug min-h-10">
                          {product.name}
                        </h3>

                        <p className="text-xs text-slate-400 mt-1">
                          {product.category || 'Tanpa kategori'}
                        </p>
                      </div>

                      <div className="border-t border-slate-100 pt-3">
                        <p className="text-blue-700 font-bold text-base">
                          {formatRupiah(price)}
                        </p>

                        <button
                          type="button"
                          disabled={true}
                          className="w-full mt-3 bg-slate-200 text-slate-500 rounded-lg py-2.5 text-xs font-bold cursor-not-allowed"
                        >
                          Scan RFID untuk Menambahkan
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

      {/* Tombol keranjang mengambang */}
      <button
        type="button"
        onClick={() => setCartModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-2xl bg-blue-600 px-5 py-4 text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-blue-700"
        aria-label={`Buka keranjang, ${totalItems} item`}
      >
        <span className="relative text-2xl">
          🛒
          <span className="absolute -right-3 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">
            {totalItems}
          </span>
        </span>
        <span className="text-left">
          <span className="block text-sm font-bold">Lihat Keranjang</span>
          <span className="block text-xs text-blue-100">{formatRupiah(total)}</span>
        </span>
      </button>

      {/* Modal keranjang transaksi */}
      {cartModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCartModalOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-cart-modal-title"
            className="flex h-[94vh] max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h2 id="pos-cart-modal-title" className="text-lg font-bold text-slate-900">
                  Keranjang Transaksi
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Periksa barang dan data pembayaran sebelum checkout
                </p>
                <span className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                  {totalItems} Item
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className="rounded-lg px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  🗑 Hapus Semua
                </button>
                <button
                  type="button"
                  onClick={() => setCartModalOpen(false)}
                  className="rounded-lg px-3 py-2 text-2xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Tutup keranjang"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Hanya daftar barang yang memiliki scroll sendiri */}
            <div className="min-h-[180px] flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
              {cart.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mb-3 text-5xl">🛒</div>
                  <p className="font-semibold text-slate-700">Keranjang masih kosong</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Pindai RFID dari katalog untuk memulai transaksi.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div
                      key={item.product_id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-800">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-400">{item.sku}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeProduct(item.product_id)}
                          className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                        >
                          Hapus Produk
                        </button>
                      </div>

                      <div className="mt-3">
                        <p className="mb-2 text-xs font-semibold text-slate-600">
                          RFID Terpindai ({item.epcs?.length || 0} unit)
                        </p>
                        <div className="space-y-2">
                          {(item.epcs || []).map(epc => (
                            <div
                              key={epc}
                              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                            >
                              <span className="break-all font-mono text-[11px] text-slate-600">
                                {epc}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeScannedEpc(item.product_id, epc)}
                                className="shrink-0 rounded px-2 py-1 text-xs font-bold text-rose-500 transition hover:bg-rose-50"
                              >
                                Hapus
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                        <span className="text-xs text-slate-500">
                          {formatRupiah(item.price)} / unit
                        </span>
                        <span className="font-bold text-blue-700">
                          {formatRupiah(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ringkasan dan checkout tetap terlihat di bawah */}
            <div className="max-h-[48%] shrink-0 space-y-3 overflow-y-auto overscroll-contain border-t border-slate-200 bg-white p-4 sm:px-5">
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Data Transaksi</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-600">
                      Nama Pelanggan
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={event => setCustomerName(event.target.value)}
                      placeholder="Masukkan nama pelanggan"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-600">
                      Metode Pembayaran
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={event => {
                        setPaymentMethod(event.target.value);
                        if (event.target.value !== 'CASH') setCashReceived('');
                      }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="CASH">CASH</option>
                      <option value="QRIS">QRIS</option>
                    </select>
                  </div>
                </div>

                {paymentMethod === 'CASH' && (
                  <div className="mt-3">
                    <label className="mb-2 block text-xs font-semibold text-slate-600">
                      Uang yang Dibayarkan Pembeli
                    </label>
                    <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3 transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                      <span className="mr-2 text-sm font-semibold text-slate-500">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatCashInput(cashReceived)}
                        onChange={event => {
                          const digitsOnly = event.target.value.replace(/[^0-9]/g, '');
                          setCashReceived(digitsOnly);
                        }}
                        placeholder="Masukkan nominal uang"
                        className="w-full min-w-0 bg-transparent py-2.5 text-sm outline-none"
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-slate-500">Uang diterima</span>
                      <span className="font-semibold text-slate-800">
                        {formatRupiah(cashReceivedAmount)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-slate-500">Kembalian</span>
                      <span className={`text-base font-bold ${
                        cashPaymentInsufficient ? 'text-slate-400' : 'text-emerald-600'
                      }`}>
                        {formatRupiah(cashChange)}
                      </span>
                    </div>
                    {cashPaymentInsufficient && cashReceived !== '' && (
                      <p className="mt-2 text-xs font-medium text-rose-600">
                        Uang pembayaran kurang {formatRupiah(total - cashReceivedAmount)}.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Total item</span>
                  <span>{totalItems}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm text-slate-500">
                  <span>Subtotal</span>
                  <span>{formatRupiah(total)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="font-bold text-slate-800">Total Pembayaran</span>
                  <span className="text-xl font-extrabold text-blue-700">
                    {formatRupiah(total)}
                  </span>
                </div>
              </div>

              {!customerName.trim() && (
                <p className="text-xs text-amber-700">
                  Isi nama pelanggan terlebih dahulu untuk melanjutkan checkout.
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setCartModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Lanjut Pilih Barang
                </button>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || checkoutLoading || scanLoading || cashPaymentInsufficient}
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {checkoutLoading ? 'Memproses Checkout...' : 'Checkout'}
                </button>
              </div>
              <p className="text-center text-[10px] text-slate-400">
                Pembayaran CASH / QRIS dan penerbitan Gate Pass.
              </p>
            </div>
          </section>
        </div>
      )}
      </div>
          </>
        )}
      {activePosTab === 'riwayat' && (
  <>

    {/* RIWAYAT TRANSAKSI POS */}
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

  <div className="p-5 border-b border-slate-100 flex justify-between items-center">
    <div>
      <h2 className="font-bold text-lg text-slate-900">
        Riwayat Transaksi
      </h2>
      <p className="text-xs text-slate-500 mt-1">
        Daftar 50 transaksi penjualan POS terbaru
      </p>
    </div>

    <button
      onClick={fetchSales}
      disabled={salesLoading}
      className="text-sm text-blue-600 font-semibold hover:text-blue-800 disabled:opacity-50"
    >
      {salesLoading ? 'Memuat...' : '↻ Refresh'}
    </button>
  </div>

  <div className="overflow-x-auto">
    <table className="w-full text-sm text-left">
      <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
        <tr>
          <th className="px-5 py-3">Invoice</th>
          <th className="px-5 py-3">Pelanggan</th>
          <th className="px-5 py-3 text-center">Jumlah Item</th>
          <th className="px-5 py-3">Total</th>
          <th className="px-5 py-3">Pembayaran</th>
          <th className="px-5 py-3">Waktu</th>
          <th className="px-5 py-3 text-center">Aksi</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-100">
        {salesLoading ? (
          <tr>
            <td colSpan="6" className="text-center py-8 text-slate-400">
              Memuat riwayat transaksi...
            </td>
          </tr>
        ) : sales.length === 0 ? (
          <tr>
            <td colSpan="6" className="text-center py-8 text-slate-400">
              Belum ada transaksi POS.
            </td>
          </tr>
        ) : (
          sales.map(sale => (
            <tr key={sale.id} className="hover:bg-slate-50">
              <td className="px-5 py-4">
              <button
                type="button"
                onClick={() => fetchInvoiceDetail(sale.invoice_no)}
                className="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
              >
                {sale.invoice_no}
              </button>
            </td>

              <td className="px-5 py-4">
                {sale.customer_name || 'Pelanggan Umum'}
              </td>

              <td className="px-5 py-4 text-center">
                {sale.total_items}
              </td>

              <td className="px-5 py-4 font-semibold">
                {formatRupiah(Number(sale.total_amount))}
              </td>

              <td className="px-5 py-4">
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  sale.payment_status === 'PAID'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {sale.payment_status}
                </span>
              </td>

              <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                {sale.created_at
                  ? new Date(sale.created_at).toLocaleString('id-ID')
                  : '-'}
              </td>

              <td className="px-5 py-4 text-center">
              <button
                type="button"
                onClick={() => fetchInvoiceDetail(sale.invoice_no)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition"
              >
                Detail
              </button>
            </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
</section>

    {/* RIWAYAT TRANSAKSI POS (TanStack DataTable) */}
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Riwayat Transaksi</h2>
        <p className="text-sm text-muted-foreground">
          Daftar transaksi penjualan POS terbaru — urutkan & filter berdasarkan tanggal.
        </p>
      </div>
      {salesLoading ? (
        <div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
          Memuat riwayat transaksi...
        </div>
      ) : (
        <DataTable
          data={sales}
          columns={[
            {
              accessorKey: 'invoice_no',
              header: 'Invoice',
              cell: ({ row }) => <span className="font-mono font-semibold">{row.original.invoice_no}</span>,
            },
            {
              id: 'customer',
              header: 'Pelanggan',
              accessorFn: (row) => row.customer_name || 'Pelanggan Umum',
            },
            {
              id: 'total_items',
              header: 'Jumlah Item',
              accessorFn: (row) => Number(row.total_items || 0),
            },
            {
              id: 'total_amount',
              header: 'Total',
              accessorFn: (row) => Number(row.total_amount || 0),
              cell: ({ row }) => (
                <span className="font-semibold">{formatRupiah(Number(row.original.total_amount))}</span>
              ),
            },
            {
              accessorKey: 'payment_status',
              header: 'Pembayaran',
              cell: ({ row }) => (
                <Badge variant={row.original.payment_status === 'PAID' ? 'success' : 'warning'}>
                  {row.original.payment_status}
                </Badge>
              ),
            },
            {
              accessorKey: 'created_at',
              header: 'Waktu',
              cell: ({ row }) => (
                <span className="font-mono text-muted-foreground whitespace-nowrap">
                  {row.original.created_at
                    ? new Date(row.original.created_at).toLocaleString('id-ID')
                    : '-'}
                </span>
              ),
            },
          ]}
          searchPlaceholder="Cari invoice atau pelanggan..."
          dateField="created_at"
          initialSorting={[{ id: 'created_at', desc: true }]}
          filters={[
            {
              key: 'payment_status',
              label: 'Pembayaran',
              options: [...new Set(sales.map((s) => s.payment_status).filter(Boolean))].map((v) => ({ value: v, label: v })),
            },
          ]}
          emptyMessage="Belum ada transaksi POS."
          toolbarActions={
            <Button type="button" variant="outline" size="sm" onClick={fetchSales} disabled={salesLoading} className="h-8 gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          }
        />
      )}
    </section>

  </>
)}

{/* MODAL DETAIL INVOICE */}
{selectedInvoice && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">

      <div className="p-5 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Detail Invoice
          </h2>
          <p className="text-sm text-blue-700 font-semibold mt-1">
            {selectedInvoice}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedInvoice(null);
            setInvoiceDetail(null);
          }}
          className="text-slate-500 hover:text-red-600 text-2xl"
        >
          &times;
        </button>
      </div>

      <div className="p-5">
        {invoiceDetailLoading ? (
          <div className="text-center py-10 text-slate-500">
            Memuat detail invoice...
          </div>
        ) : invoiceDetail ? (
          <>
            <div className="mb-5">
              <p className="text-xs text-slate-500">Nama pelanggan</p>
              <p className="font-semibold text-slate-800">
                {invoiceDetail.invoice?.customer_or_destination || 'Pelanggan Umum'}
              </p>
            </div>

            <h3 className="font-bold text-slate-800 mb-3">
              Daftar Barang dan RFID
            </h3>

            <div className="space-y-3">
              {invoiceDetail.items?.length > 0 ? (
                invoiceDetail.items.map((item, index) => (
                  <div
                    key={`${item.tag_id}-${index}`}
                    className="border border-slate-200 rounded-xl p-4"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="font-bold text-slate-800">
                          {item.product_name || item.sku}
                          {item.product_name && (
                            <span className="ml-2 text-xs font-mono font-normal text-slate-500">
                              ({item.sku})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          EPC: {item.epc}
                          {Math.abs(Number(item.qty_change || 1)) > 1 && (
                            <span className="ml-2 font-semibold text-slate-700">
                              · {Math.abs(Number(item.qty_change))} unit
                              {item.box_code ? ` (${item.box_code})` : ''}
                            </span>
                          )}
                        </p>
                      </div>

                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        item.already_returned
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {item.already_returned ? 'Sudah Diretur' : 'Belum Diretur'}
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-slate-500">
                      Status RFID: <strong>{item.tag_status || '-'}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Tidak ada barang pada invoice ini.
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-center py-8 text-slate-500">
            Detail invoice tidak tersedia.
          </p>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 flex justify-between items-center">
        <button
          type="button"
          onClick={handlePrintInvoice}
          disabled={invoiceDetailLoading || !invoiceDetail}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-5 py-2 rounded-lg text-sm font-semibold"
        >
          Cetak Invoice
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedInvoice(null);
            setInvoiceDetail(null);
          }}
          className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-semibold"
        >
          Tutup
        </button>
      </div>

    </div>
  </div>
)}
  </div>
  );
}
