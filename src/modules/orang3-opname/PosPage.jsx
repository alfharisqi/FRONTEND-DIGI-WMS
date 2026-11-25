
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShoppingCart } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function PosPage({ showNotification }) {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [activePosTab, setActivePosTab] = useState('kasir');
  const [epcInput, setEpcInput] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);

    try {
      const [response, stockRes] = await Promise.all([
        apiRequest('/products'),
        apiRequest('/inventory/stock').catch(() => null),
      ]);
      const ledgerMap = new Map();
      if (Array.isArray(stockRes?.data)) {
        stockRes.data.forEach((row) => {
          ledgerMap.set(row.sku, Number(row.current_stock ?? 0));
        });
      }
      const list = (Array.isArray(response.data) ? response.data : []).map((p) => ({
        ...p,
        current_stock: ledgerMap.has(p.sku)
          ? ledgerMap.get(p.sku)
          : Number(p.current_stock ?? 0),
      }));
      setProducts(list);
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
const handleScanRFID = async () => {
  const epc = epcInput.trim();

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

    showNotification?.(
      `Checkout berhasil. Invoice: ${response.data.invoice_no}`,
      'success'
    );

    setCart([]);
    setCustomerName('');
    setPaymentMethod('CASH');

    await fetchSales();
    await fetchProducts();

 } catch (error) {
  console.error('Checkout POS gagal:', error);

  if (error.data?.sale_created === true) {
    setCart([]);
    setCustomerName('');
    setPaymentMethod('CASH');

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
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">

        {/* KATALOG PRODUK */}
        <section className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">

          <div className="p-5 border-b border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="font-bold text-lg text-slate-900">
                  Katalog Produk
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Pilih produk untuk dimasukkan ke keranjang
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
                  onClick={handleScanRFID}
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
                            ? 'bg-rose-100 text-rose-600'
                            : stock <= 5
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {unavailable ? 'Habis' : `Stok ${stock}`}
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

        {/* KERANJANG */}
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden xl:sticky xl:top-4">

          <div className="p-5 border-b border-slate-100">
            <div className="flex justify-between items-center gap-2">
              <div>
                <h2 className="font-bold text-lg text-slate-900">
                  Keranjang Transaksi
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Daftar barang yang dibeli
                </p>
              </div>

              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg disabled:text-slate-300 disabled:bg-transparent disabled:cursor-not-allowed"
              >
                🗑 Hapus Semua
              </button>
            </div>

            <div className="mt-3">
              <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-xs font-bold">
                {totalItems} Item
              </span>
            </div>
          </div>

          {/* CART ITEMS */}
          <div className="p-5 space-y-3 max-h-[430px] overflow-y-auto">
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">🛒</div>
                <p className="font-semibold text-slate-700">
                  Keranjang masih kosong
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  Pilih produk dari katalog untuk memulai transaksi.
                </p>
              </div>
            ) : (
              cart.map(item => (
                <div
                  key={item.product_id}
                  className="border border-slate-100 bg-slate-50 rounded-xl p-3"
                >
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-800">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {item.sku}
                      </p>
                    </div>

                    <button
                      onClick={() => removeProduct(item.product_id)}
                      className="text-rose-500 hover:bg-rose-50 rounded-lg px-2 py-1 text-xs font-bold h-fit"
                    >
                      Hapus
                    </button>
                  </div>
                    
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600">
                  RFID Terpindai ({item.epcs?.length || 0} unit)
                </p>

                        {(item.epcs || []).map(epc => (
                          <div
                            key={epc}
                            className="flex justify-between items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2"
                          >
                            <span className="text-[11px] font-mono text-slate-600 break-all">
                              {epc}
                            </span>

                            <button
                              onClick={() => removeScannedEpc(item.product_id, epc)}
                              className="text-rose-500 hover:bg-rose-50 rounded px-2 py-1 text-xs font-bold shrink-0"
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center mt-3">
                        <span className="text-sm font-bold text-blue-700">
                          {formatRupiah(item.price * item.quantity)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 mt-2">
                        {formatRupiah(item.price)} / unit
                      </p>

                </div>
              ))
            )}
          </div>

          {/* DATA TRANSAKSI */}
            <div className="p-5 border-t border-slate-100 space-y-3">
              <h3 className="text-sm font-bold text-slate-800">
                Data Transaksi
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Nama Pelanggan
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={event => setCustomerName(event.target.value)}
                  placeholder="Masukkan nama pelanggan"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Metode Pembayaran
                </label>
                <select
                  value={paymentMethod}
                  onChange={event => setPaymentMethod(event.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="CASH">CASH</option>
                  <option value="QRIS">QRIS</option>
                </select>
              </div>
            </div>

          {/* PAYMENT SUMMARY */}
          <div className="p-5 bg-slate-50 border-t border-slate-100">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Total item</span>
              <span>{totalItems}</span>
            </div>

            <div className="flex justify-between text-sm text-slate-500 mt-2">
              <span>Subtotal</span>
              <span>{formatRupiah(total)}</span>
            </div>

            <div className="border-t border-slate-200 mt-4 pt-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">
                  Total Pembayaran
                </span>
                <span className="text-xl font-extrabold text-blue-700">
                  {formatRupiah(total)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={
                  cart.length === 0 ||
                  checkoutLoading ||
                  scanLoading
                }
                className="w-full mt-5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl py-3.5 text-sm font-bold transition"
              >
                {checkoutLoading ? 'Memproses Checkout...' : 'Checkout'}
              </button>

              <p className="text-[10px] text-center text-slate-400 mt-3">
                Pembayaran CASH / QRIS dan penerbitan Gate Pass.
              </p>

            </div>
          </div>
        </section>
      </div>
          </>
        )}
      {activePosTab === 'riwayat' && (
  <>
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
  </div>
  );
}
