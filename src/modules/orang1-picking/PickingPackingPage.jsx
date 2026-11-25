import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ClipboardCheck, ClipboardList, Package, PackageCheck, Plus, RefreshCw, ScanLine, Search, Send } from 'lucide-react';
import { pickingRequest } from './api';
import { inboundRequest } from '../orang1-inbound/api';
import PackingDetailsDialog from './PackingDetailsDialog';

const columns = [
  { status: 'MENUNGGU_PICKING', label: 'Menunggu Picking', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', icon: Package },
  { status: 'SEDANG_DIAMBIL', label: 'Sedang Diambil', tone: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', icon: ScanLine },
  { status: 'SIAP_PACKING', label: 'Siap Packing', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', icon: PackageCheck },
  { status: 'DIKIRIM', label: 'Dikirim / Kurir', tone: 'bg-violet-500/15 text-violet-700 dark:text-violet-400', icon: Send },
];

const button = 'inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50';
const primary = `${button} bg-primary text-primary-foreground shadow-sm hover:bg-primary/90`;
const secondary = `${button} border border-input bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground`;
const input = 'flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

function Progress({ order }) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap justify-between gap-1 text-xs font-semibold text-slate-600">
        <span>EPC tervalidasi</span>
        <span>{order.picked_qty}/{order.requested_qty}</span>
      </div>
      <progress className="h-2 w-full rounded-full accent-blue-600" aria-label="Progres picking" value={order.picked_qty} max={order.requested_qty} />
    </div>
  );
}

function RackList({ locations }) {
  if (!locations.length) return <p className="text-xs text-slate-500">Tidak ada unit tersedia di rak</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {locations.map(rack => (
        <li key={rack.id} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {rack.code} · {rack.name} · {rack.available_qty} unit
        </li>
      ))}
    </ul>
  );
}

function OrderCard({ order, column, open }) {
  const shipped = order.status === 'DIKIRIM';
  const exited = order.shipping_stage === 'EXITED';
  const ready = order.status === 'SIAP_PACKING';
  const complete = order.packing_status === 'SELESAI_PACKING';
  const picked = order.lines.every(line => line.picked_qty === line.requested_qty);
  const action = ready ? 'Checklist Packing' : order.status === 'MENUNGGU_PICKING' ? 'Mulai Picking' : 'Lanjut Picking';
  const badgeText = shipped
    ? (exited ? 'Keluar Gerbang RFID' : 'Diserahkan ke Kurir')
    : complete
    ? 'Packing Selesai'
    : column.label;
  const badgeTone = shipped
    ? (exited ? 'bg-emerald-600 text-white' : 'bg-violet-600 text-white')
    : complete
    ? 'bg-emerald-700 text-white'
    : column.tone;

  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm" aria-label={order.order_number}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="break-all font-bold text-foreground">{order.order_number}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badgeTone}`}>{badgeText}</span>
      </div>
      <ul className="space-y-2.5">
        {order.lines.map(line => (
          <li key={line.product_id} className="space-y-1">
            <p className="text-sm font-medium text-foreground">{line.product_name} <span className="text-muted-foreground">· {line.sku}</span></p>
            <p className="text-xs text-muted-foreground">{line.picked_qty}/{line.requested_qty} unit</p>
            {line.picked_qty < line.requested_qty && <RackList locations={line.locations} />}
            {line.scans.length > 0 && <p className="text-xs text-muted-foreground">Rak scan: {[...new Set(line.scans.map(scan => scan.location_code))].join(', ')}</p>}
          </li>
        ))}
      </ul>
      <Progress order={order} />
      <div className="flex flex-wrap gap-2">
        <button className={secondary} onClick={() => open(order.id, 'detail')}>Detail</button>
        {!shipped && (
          <button className={primary} disabled={ready && !picked} onClick={() => open(order.id, ready ? 'packing' : 'scan')}>{action}</button>
        )}
      </div>
    </article>
  );
}

function ScanHistory({ lines }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><ClipboardCheck size={18} /> Riwayat scan</h3>
      <ul className="space-y-3">
        {lines.map(line => (
          <li className="space-y-1.5" key={line.product_id}>
            <div className="flex items-start gap-2 text-sm font-medium">
              {line.picked_qty === line.requested_qty && <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={16} aria-label="Lengkap" />}
              <span>{line.sku} · {line.product_name} · {line.picked_qty}/{line.requested_qty} unit</span>
            </div>
            <ul className="space-y-1">
              {line.scans.map(scan => (
                <li key={scan.id} className="flex flex-wrap gap-x-2 text-xs text-slate-600">
                  <code className="break-all font-semibold text-slate-800">{scan.epc}</code>
                  <span>{scan.location_code} · {scan.location_name} · {scan.active ? 'Tervalidasi' : 'Reservasi dilepas'}</span>
                </li>
              ))}
              {!line.scans.length && <li className="text-xs text-slate-500">Belum ada EPC tervalidasi.</li>}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OrderDialog({ order, close, onScan, notify }) {
  const dialog = useRef(null), epcField = useRef(null), inFlight = useRef(false);
  const [epc, setEpc] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const ready = order.status === 'SIAP_PACKING';
  useEffect(() => {
    const trigger = document.activeElement;
    const element = dialog.current;
    element.showModal();
    return () => {
      element.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  useEffect(() => { if (!ready) epcField.current?.focus(); }, [ready]);

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current || ready || !epc.trim()) return;
    inFlight.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const updated = await onScan(order.id, epc);
      setEpc('');
      const message = updated.status === 'SIAP_PACKING' ? 'Semua EPC tervalidasi. Pesanan siap packing.' : 'EPC cocok dan berhasil direservasi.';
      setNotice({ text: message, error: false });
      notify?.(message, 'success');
    } catch (error) {
      setNotice({ text: error.message, error: true });
      notify?.(error.message, 'error');
    } finally {
      setBusy(false);
      inFlight.current = false;
      requestAnimationFrame(() => epcField.current?.focus());
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="picking-dialog-title" onCancel={event => { event.preventDefault(); if (!inFlight.current) close(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-auto rounded-2xl bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/50">
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-blue-700">{columns.find(column => column.status === order.status)?.label}</p>
            <h2 id="picking-dialog-title" className="break-all text-xl font-bold text-slate-900">{order.order_number}</h2>
          </div>
          <button className={secondary} disabled={busy} onClick={close}>Tutup</button>
        </div>
        <Progress order={order} />
        {!ready && order.lines.filter(line => line.picked_qty < line.requested_qty).map(line => (
          <div className="space-y-1" key={line.product_id}>
            <p className="text-sm font-semibold">{line.sku} · {line.product_name}</p>
            <RackList locations={line.locations} />
          </div>
        ))}
        {!ready && (
          <form className="space-y-2" onSubmit={submit}>
            <label className="block text-sm font-semibold" htmlFor="picking-epc">EPC RFID</label>
            <div className="flex flex-wrap gap-2 sm:flex-nowrap">
              <input ref={epcField} className={input} id="picking-epc" value={epc} onChange={event => setEpc(event.target.value)} required maxLength={64} autoComplete="off" spellCheck={false} disabled={busy} />
              <button className={`${primary} shrink-0`} disabled={busy || !epc.trim()} type="submit">
                <ScanLine size={16} /> {busy ? 'Memvalidasi…' : 'Validasi Scan'}
              </button>
            </div>
          </form>
        )}
        {notice && <p role={notice.error ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-sm ${notice.error ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{notice.text}</p>}
        <ScanHistory lines={order.lines} />
      </div>
    </dialog>
  );
}

export default function PickingPackingPage({ searchQuery = '', showNotification }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [packingStatus, setPackingStatus] = useState('');
  const [dialog, setDialog] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    order_number: `ORD-PICK-2026-${Math.floor(100 + Math.random() * 900)}`,
    product_id: '',
    requested_qty: 1,
  });
  const listRequest = useRef(null);

  const load = useCallback(async () => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    setLoading(true);
    setError('');
    try {
      const data = await pickingRequest('/orders', { signal: controller.signal });
      if (!controller.signal.aborted) {
        if (!Array.isArray(data)) throw new Error('Format daftar pesanan tidak valid.');
        setOrders(data);
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => { load(); return () => listRequest.current?.abort(); }, [load]);

  async function scan(orderId, epc) {
    const response = await pickingRequest('/scan', { body: { order_id: orderId, epc } });
    listRequest.current?.abort();
    setOrders(previous => previous.map(order => order.id === response.order.id ? response.order : order));
    // Reload every card since the same rack stock may be listed on several orders.
    void load();
    return response.order;
  }

  function updateOrder(updated) {
    listRequest.current?.abort();
    setLoading(false);
    setOrders(previous => previous.map(order => order.id === updated.id ? updated : order));
  }

  async function openCreateOrderModal() {
    setShowCreateModal(true);
    try {
      const prodList = await inboundRequest('/products');
      if (Array.isArray(prodList)) {
        setProducts(prodList);
        if (prodList.length > 0 && !newOrderForm.product_id) {
          setNewOrderForm(prev => ({ ...prev, product_id: prodList[0].id }));
        }
      }
    } catch {
      // ignore
    }
  }

  async function handleCreatePickingOrder(event) {
    event.preventDefault();
    if (!newOrderForm.order_number.trim() || !newOrderForm.product_id) return;
    setCreating(true);
    try {
      await pickingRequest('/orders', {
        body: {
          order_number: newOrderForm.order_number.trim(),
          lines: [
            {
              product_id: newOrderForm.product_id,
              requested_qty: Number(newOrderForm.requested_qty) || 1,
            },
          ],
        },
      });
      showNotification?.(`Pesanan picking ${newOrderForm.order_number} berhasil dibuat!`, 'success');
      setShowCreateModal(false);
      setNewOrderForm({
        order_number: `ORD-PICK-2026-${Math.floor(100 + Math.random() * 900)}`,
        product_id: products[0]?.id || '',
        requested_qty: 1,
      });
      await load();
    } catch (err) {
      showNotification?.(err.message || 'Gagal membuat pesanan picking', 'error');
    } finally {
      setCreating(false);
    }
  }

  const terms = [searchQuery, search].join(' ').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = orders.filter(order => {
    if (packingStatus && (order.status !== 'SIAP_PACKING' || order.packing_status !== packingStatus)) return false;
    const searchable = [order.order_number, ...order.lines.flatMap(line => [line.sku, line.product_name])].join(' ').toLowerCase();
    return terms.every(term => searchable.includes(term));
  });
  const selected = dialog && orders.find(order => order.id === dialog.id);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Picking &amp; Packing</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pantau progres pengambilan barang, checklist packing, hingga serah terima kurir.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={primary} onClick={openCreateOrderModal}>
            <Plus size={16} /> Buat Pesanan Picking
          </button>
          <button className={secondary} disabled={loading} onClick={load}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Muat Ulang
          </button>
        </div>
      </header>
      <div className="flex flex-wrap gap-3">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Cari nomor pesanan, SKU, atau produk</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
          <input className={`${input} pl-9`} placeholder="Cari nomor pesanan, SKU, atau produk" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <label>
          <span className="sr-only">Filter status packing</span>
          <select className={input} value={packingStatus} onChange={event => {
            setPackingStatus(event.target.value);
            if (event.target.value) setStatus('SIAP_PACKING');
          }}>
            <option value="">Semua Packing</option>
            <option value="MENUNGGU_PACKING">Menunggu Packing</option>
            <option value="SELESAI_PACKING">Packing Selesai</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Filter status picking</span>
          <select className={input} value={status} onChange={event => {
            setStatus(event.target.value);
            if (event.target.value !== 'SIAP_PACKING') setPackingStatus('');
          }}>
            <option value="">Semua status</option>
            {columns.map(column => <option key={column.status} value={column.status}>{column.label}</option>)}
          </select>
        </label>
      </div>
      {loading && <p className="text-sm text-slate-600" role="status">Memuat pesanan…</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}{orders.length > 0 ? ' Daftar menampilkan hasil terakhir.' : ''}</p>}
      {!loading && !error && !orders.length && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Belum ada pesanan picking.</p>}
      {(orders.length > 0 || (!loading && !error)) && (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.filter(column => !status || status === column.status).map(column => {
            const cards = matches.filter(order => order.status === column.status);
            const Icon = column.icon;
            return (
              <section key={column.status} aria-label={column.label} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className={`rounded-lg p-1.5 ${column.tone}`}><Icon size={17} /></span>
                  {column.label} <span className="ml-auto text-xs text-slate-500">{cards.length}</span>
                </h3>
                <div className="space-y-3">
                  {cards.map(order => <OrderCard key={order.id} order={order} column={column} open={(id, mode) => setDialog({ id, mode })} />)}
                  {!cards.length && <p className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">Tidak ada pesanan pada kolom ini.</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {selected && (dialog.mode === 'scan'
        ? <OrderDialog key={selected.id} order={selected} close={() => setDialog(null)} onScan={scan} notify={showNotification} />
        : <PackingDetailsDialog key={`${selected.id}:${dialog.mode}`} orderId={selected.id} orderNumber={selected.order_number}
            mode={dialog.mode} close={() => setDialog(null)} onOrderChange={updateOrder} notify={showNotification} />)}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Buat Pesanan Picking Baru</h3>
              <button type="button" className={secondary} onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreatePickingOrder} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">Nomor Pesanan (Order Number)</label>
                <input
                  type="text"
                  required
                  className={input}
                  value={newOrderForm.order_number}
                  onChange={e => setNewOrderForm({ ...newOrderForm, order_number: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">Pilih Barang / SKU</label>
                <select
                  required
                  className={input}
                  value={newOrderForm.product_id}
                  onChange={e => setNewOrderForm({ ...newOrderForm, product_id: e.target.value })}
                >
                  <option value="">-- Pilih Produk --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">Jumlah Unit Diminta</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="100"
                  className={input}
                  value={newOrderForm.requested_qty}
                  onChange={e => setNewOrderForm({ ...newOrderForm, requested_qty: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" className={secondary} onClick={() => setShowCreateModal(false)}>Batal</button>
                <button type="submit" disabled={creating} className={primary}>
                  {creating ? 'Menyimpan…' : 'Simpan Pesanan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
