import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Package, Plus, RefreshCw, Tag, Truck } from 'lucide-react';
import { inboundRequest, newEpc, newSku, normalizeTag, productForm, receivedLines, selectedProductId, tagTypeDetailField } from './api';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const buttonClass = 'inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const typeOptions = ['STANDARD_LABEL', 'ON_METAL', 'HARD_TAG'];
const tagStatuses = ['UNASSIGNED', 'ENCODED', 'IN_STOCK', 'RESERVED', 'AUTHORIZED_OUT', 'EXITED', 'DAMAGED'];
const labels = { MENUNGGU_VERIFIKASI: 'Menunggu Verifikasi', SELESAI: 'Selesai', DIBATALKAN: 'Dibatalkan', MENUNGGU_TAGGING: 'Menunggu Tagging', SEDANG_TAGGING: 'Sedang Tagging', SELESAI_TAGGING: 'Tagging Selesai', STANDARD_LABEL: 'Label Biasa (UHF)', ON_METAL: 'On Metal', HARD_TAG: 'Hard Tag' };
const display = value => value === undefined || value === null || value === '' ? '—' : (labels[value] || String(value));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateText = value => value ? String(value).slice(0, 10) : '—';
const pathFor = kind => kind === 'product' ? '/products' : kind === 'grn' ? '/inbound/grn' : '/tags';
function Field({ label, children }) { return <label className="block text-sm text-slate-600"><span className="block text-xs font-semibold mb-1">{label}</span>{children}</label>; }
function Badge({ value }) { return <span className={`inline-block text-xs px-2.5 py-1 rounded-lg font-semibold ${['DIBATALKAN', 'DAMAGED'].includes(value) ? 'bg-rose-50 text-rose-700' : value === 'MENUNGGU_VERIFIKASI' ? 'bg-amber-50 text-amber-700' : 'bg-cyan-50 text-cyan-700'}`}>{display(value)}</span>; }
const emptyLine = () => ({ product_id: '', received_qty: 1 });

function ReceiptLineFields({ lines, products, onChange, expected }) {
  function edit(index, field, value) {
    onChange(lines.map((line, position) => position === index ? { ...line, [field]: value } : line));
  }
  return <div className="space-y-3">
    <h4 className="text-sm font-semibold text-slate-800">{expected ? 'Hasil hitung fisik per SKU' : 'Rincian penerimaan'}</h4>
    {lines.map((line, index) => <div className="grid grid-cols-1 items-end gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_8rem_auto]" key={index}>
      {expected ? <p className="text-sm font-medium text-slate-700">{expected[index].sku} · {expected[index].product_name}<br />Draft {expected[index].received_qty} unit</p>
        : <Field label={`Produk / SKU ${index + 1}`}><select required className={inputClass} value={String(line.product_id)} onChange={event => edit(index, 'product_id', event.target.value)}>
          <option value="">Pilih produk</option>
          {products.map(product => <option value={product.id} key={product.id}>{product.sku} — {product.name}</option>)}
        </select></Field>}
      <Field label={`Jumlah ${expected ? 'fisik' : 'diterima'} ${index + 1}`}><input type="number" className={inputClass} required min="1" max="2147483647" step="1"
        value={line.received_qty} onChange={event => edit(index, 'received_qty', event.target.value)} /></Field>
      {!expected && <button type="button" disabled={lines.length === 1} className={buttonClass + ' text-rose-700'} onClick={() => onChange(lines.filter((_, position) => index !== position))}>Hapus baris {index + 1}</button>}
    </div>)}
    {!expected && <div className="flex items-center justify-between gap-2">
      <button type="button" disabled={lines.length >= 200} className={buttonClass + ' bg-slate-100'} onClick={() => onChange([...lines, emptyLine()])}>Tambah baris SKU</button>
      <strong className="text-sm" aria-live="polite">Total {lines.reduce((sum, line) => sum + (Number(line.received_qty) || 0), 0)} unit</strong>
    </div>}
  </div>;
}

function ReceiptProgress({ row }) {
  if (!row.lines?.length) return <p className="my-3 text-sm text-slate-500">Rincian SKU belum tercatat.</p>;
  return <section className="mt-4 rounded-xl border border-slate-200 p-3">
    <h4 className="text-sm font-semibold">Progres Tagging RFID</h4>
    <ul className="mt-2 space-y-1 text-sm">
      {row.lines.map(line => <li className="flex flex-wrap justify-between gap-2" key={line.id}>
        <span>{line.sku} · {line.product_name}</span><span>{line.tagged_qty}/{line.received_qty} unit</span>
      </li>)}
    </ul>
    <p className="mt-2 border-t pt-2 text-sm font-semibold">Total {row.tagging_progress.tagged}/{row.tagging_progress.total} unit</p>
  </section>;
}
function Modal({ title, children, close, busy }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.focus();
    return () => previous?.focus();
  }, []);
  const onKeyDown = event => {
    if (event.key === 'Escape' && !busy) close();
    if (event.key !== 'Tab') return;
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div ref={dialogRef} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-labelledby="inbound-modal-title" className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center gap-4 mb-5"><h3 id="inbound-modal-title" className="font-bold text-lg text-slate-900">{title}</h3><button type="button" aria-label="Tutup dialog" disabled={busy} onClick={close} className={buttonClass}>✕</button></div>{children}
    </div>
  </div>;
}

export default function InboundTaggingPage({ activeMenu = 'penerimaan', lastEvent, searchQuery = '', showNotification }) {
  const [products, setProducts] = useState([]), [grns, setGrns] = useState([]), [tags, setTags] = useState([]);
  const [stock, setStock] = useState({ ledger: null, racks: null });
  const [loading, setLoading] = useState(true), [loadErrors, setLoadErrors] = useState([]);
  const [localSearch, setLocalSearch] = useState(''), [filter, setFilter] = useState(''), [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState(null), [form, setForm] = useState({}), [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(null);
  const [customCategories, setCustomCategories] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('digiwms_custom_categories') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  });
  const [addingCategory, setAddingCategory] = useState(false), [newCatInput, setNewCatInput] = useState('');
  const busyRef = useRef(false), fetchVersion = useRef(0), mounted = useRef(true);
  const notify = (message, type = 'success') => { setNotice({ message, type }); showNotification?.(message, type); };
  const fetchData = useCallback(async () => {
    const version = ++fetchVersion.current;
    setLoading(true);
    const results = await Promise.allSettled(['/products', '/inbound/grn', '/tags'].map(path => inboundRequest(path)));
    if (!mounted.current || version !== fetchVersion.current) return;
    const setters = [setProducts, setGrns, setTags], names = ['Master Produk', 'GRN', 'RFID'];
    const errors = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) setters[index](index === 2 ? result.value.map(normalizeTag) : result.value);
      else errors.push(`${names[index]}: ${result.reason?.message || 'Format daftar tidak valid.'}`);
    });
    setLoadErrors(errors); setLoading(false);
  }, []);
  useEffect(() => { mounted.current = true; fetchData(); return () => { mounted.current = false; fetchVersion.current++; }; }, [fetchData, lastEvent]);
  useEffect(() => {
    if (activeMenu !== 'stok') return;
    let current = true;
    setStock({ ledger: null, racks: null, rackLocations: null });
    Promise.allSettled([inboundRequest('/inventory/stock'), inboundRequest('/inventory/stock-by-rack')]).then(([ledger, racks]) => {
      if (!current) return;
      const available = new Map();
      const rackLocations = new Map();
      if (racks.status === 'fulfilled' && Array.isArray(racks.value)) {
        for (const row of racks.value) {
          const key = String(row.product_id);
          available.set(key, (available.get(key) ?? 0) + Number(row.quantity));
          if (row.rack_code) {
            const set = rackLocations.get(key) ?? new Set();
            set.add(row.rack_code);
            rackLocations.set(key, set);
          }
        }
      }
      setStock({
        ledger: ledger.status === 'fulfilled' && Array.isArray(ledger.value) ? new Map(ledger.value.map(row => [row.sku, row.current_stock])) : null,
        racks: racks.status === 'fulfilled' && Array.isArray(racks.value) ? available : null,
        rackLocations: racks.status === 'fulfilled' && Array.isArray(racks.value)
          ? new Map([...rackLocations.entries()].map(([k, set]) => [k, [...set].sort().join(', ')]))
          : null,
      });
    });
    return () => { current = false; };
  }, [activeMenu, lastEvent, products]);
  useEffect(() => { setLocalSearch(''); setFilter(''); setTypeFilter(''); if (!busyRef.current) { setModal(null); setFormError(''); } }, [activeMenu]);
  const close = () => { if (!busyRef.current) { setModal(null); setFormError(''); } };
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const openForm = (kind, row) => {
    setFormError('');
    setForm(kind === 'product' ? productForm(row ?? (products.some(product => 'default_location_code' in product) ? { default_location_code: '' } : {})) : kind === 'grn' ? {
      po_number: row?.po_number ?? '', supplier_name: row?.supplier_name ?? '', receipt_date: row ? dateText(row.receipt_date) : today(), lines: row?.lines?.length ? row.lines : [emptyLine()],
    } : { product_id: row?.product_id ?? '', type: row ? row.type ?? '' : 'STANDARD_LABEL', epc_custom: '', batch_qty: 1, inbound_purpose: row ? 'SPECIAL' : 'RECEIPT', grn_id: '', grn_line_id: '', ...(row?.status === 'UNASSIGNED' ? { status: 'ENCODED' } : {}) });
    setModal({ action: 'form', kind, row });
  };
  const details = async (kind, row) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try { const data = await inboundRequest(`${pathFor(kind)}/${encodeURIComponent(row.id)}`); setFormError(''); setModal({ action: 'detail', kind, row: kind === 'tag' ? normalizeTag(data) : data }); }
    catch (error) { notify(error.message, 'error'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const action = (kind, row, operation) => {
    setForm(operation === 'verify' ? { lines: row.lines.map(line => ({ product_id: line.product_id, received_qty: '' })) } : { reason: '', epc: '' });
    setFormError('');
    setModal({ action: operation, kind, row });
  };
  const submit = async event => {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setFormError('');
    try {
      const { kind, row, action: operation } = modal;
      let path = pathFor(kind), method, payload;
      if (operation === 'form') {
        payload = { ...form };
        if (kind === 'product') { payload.price = Number(form.price); payload.min_stock_alert = Number(form.min_stock_alert); }
        if (kind === 'grn') payload.lines = receivedLines(products, form.lines);
        if (kind === 'tag') {
          delete payload.batch_qty;
          if (row || form.inbound_purpose !== 'RECEIPT') payload.product_id = selectedProductId(products, form.product_id);
          else delete payload.product_id;
          if (row || form.inbound_purpose !== 'RECEIPT') { delete payload.grn_id; delete payload.grn_line_id; }
          if (row) delete payload.epc_custom;
          else { payload.epc_custom = form.epc_custom.trim().toUpperCase(); payload.mode = 'simulation'; }
        }
        method = row ? (kind === 'tag' ? 'PATCH' : 'PUT') : 'POST';
        path += row ? `/${encodeURIComponent(row.id)}` : kind === 'tag' ? '/encode' : '';
      } else {
        path += `/${encodeURIComponent(row.id)}`;
        method = operation === 'delete' ? 'DELETE' : operation === 'replace' ? 'POST' : 'PATCH';
        if (operation !== 'delete') path += `/${operation}`;
        if (operation === 'verify') payload = { lines: receivedLines(products, form.lines) };
        if (['cancel', 'deactivate'].includes(operation)) payload = { reason: form.reason.trim() };
        if (operation === 'replace') payload = { reason: form.reason.trim(), epc: form.epc.trim().toUpperCase() };
      }
      const batchQty = kind === 'tag' && operation === 'form' && !row ? Math.max(1, Math.min(100, Number(form.batch_qty) || 1)) : 1;
      if (batchQty > 1) {
        let created = 0;
        for (let idx = 0; idx < batchQty; idx += 1) {
          await inboundRequest(path, method, { ...payload, epc_custom: newEpc() });
          created += 1;
        }
        setModal(null);
        notify(`Registrasi batch berhasil: ${created} tag RFID simulasi dibuat sekaligus.`);
      } else {
        await inboundRequest(path, method, payload);
        setModal(null);
        notify(kind === 'tag' && operation === 'form' ? 'Registrasi simulasi tersimpan. Penulisan chip fisik belum dilakukan.' : 'Perubahan berhasil disimpan.');
      }
      await fetchData();
    } catch (error) { setFormError(error.message); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const kind = activeMenu === 'stok' ? 'product' : activeMenu === 'penerimaan' ? 'grn' : 'tag';
  const titles = { product: 'Inventaris Stok Barang Gudang', grn: 'Manajemen Penerimaan Barang (Inbound & GRN)', tag: 'Manajemen Tag RFID UHF & Encoding' };
  const descriptions = { product: 'Kelola master SKU dan lihat stok yang tercatat pada sistem gudang.', grn: 'Catat surat jalan supplier, verifikasi penerimaan, dan pantau status RFID.', tag: 'Mode simulasi: registrasi EPC 96-bit dan tautkan produk. Encoding chip fisik memerlukan reader dan konfirmasi perangkat.' };
  const PageIcon = kind === 'product' ? Package : kind === 'grn' ? Truck : Tag;
  const source = kind === 'product' ? products : kind === 'grn' ? grns : tags;
  const categories = useMemo(
    () =>
      [
        ...new Set([
          ...products.map((row) => row.category).filter(Boolean),
          ...customCategories,
        ]),
      ].sort(),
    [products, customCategories]
  );
  const addCustomCategory = () => {
    const trimmed = newCatInput.trim();
    if (!trimmed) return;
    const next = [...new Set([...customCategories, trimmed])];
    setCustomCategories(next);
    try {
      localStorage.setItem('digiwms_custom_categories', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
    change('category', trimmed);
    setNewCatInput('');
    setAddingCategory(false);
  };
  const rowActions = useCallback(row => <div className="flex flex-wrap justify-end gap-2.5 min-w-36">
    <button type="button" disabled={busy} onClick={() => details(kind, row)} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">Detail</button>
    {(kind === 'product' || (kind === 'grn' && row.status === 'MENUNGGU_VERIFIKASI' && row.has_sku_lines) || (kind === 'tag' && ['UNASSIGNED', 'ENCODED'].includes(row.status))) && <button type="button" disabled={busy} onClick={() => openForm(kind, row)} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">Edit</button>}
    {kind === 'product' && <button type="button" disabled={busy} onClick={() => action(kind, row, 'delete')} className="text-xs font-medium text-destructive hover:underline">Hapus</button>}
    {kind === 'grn' && row.status === 'MENUNGGU_VERIFIKASI' && <>{row.has_sku_lines && <button type="button" disabled={busy} onClick={() => action(kind, row, 'verify')} className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Verifikasi</button>}<button type="button" disabled={busy} onClick={() => action(kind, row, 'cancel')} className="text-xs font-medium text-destructive hover:underline">Batalkan</button></>}
    {kind === 'tag' && ['UNASSIGNED', 'ENCODED'].includes(row.status) && <button type="button" disabled={busy} onClick={() => action(kind, row, 'deactivate')} className="text-xs font-medium text-destructive hover:underline">Tandai Rusak</button>}
    {kind === 'tag' && row.status === 'ENCODED' && row.inbound_purpose && <button type="button" disabled={busy} onClick={() => action(kind, row, 'replace')} className="text-xs font-medium text-primary hover:underline">Ganti EPC</button>}
  </div>, [busy, kind]);

  const tableColumns = useMemo(() => {
    if (kind === 'product') {
      return [
        { accessorKey: 'sku', header: 'SKU / Kode', cell: ({ row }) => <span className="font-mono font-semibold text-foreground">{row.original.sku}</span> },
        { accessorKey: 'name', header: 'Nama Barang', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span> },
        { accessorKey: 'category', header: 'Kategori' },
        {
          id: 'location_rack',
          header: 'Lokasi / Rak',
          accessorFn: row => row.default_location_code || stock.rackLocations?.get(String(row.id)) || '',
          cell: ({ row }) => {
            const actual = stock.rackLocations?.get(String(row.original.id));
            return display(row.original.default_location_code || actual);
          },
        },
        { id: 'ledger_stock', header: 'Saldo Ledger', accessorFn: row => Number(stock.ledger?.get(row.sku) ?? 0), cell: ({ row }) => <span className="font-semibold">{display(stock.ledger?.get(row.original.sku))}</span> },
        { id: 'rack_stock', header: 'Tersedia di Rak', accessorFn: row => Number(stock.racks?.get(String(row.id)) ?? 0), cell: ({ row }) => display(stock.racks && (stock.racks.get(String(row.original.id)) ?? 0)) },
        { id: 'min_stock', header: 'Minimum Stok', accessorFn: row => Number(row.min_stock_alert ?? row.min_stock_threshold ?? 0), cell: ({ row }) => display(row.original.min_stock_alert ?? row.original.min_stock_threshold) },
        { id: 'price', header: 'Harga Satuan', accessorFn: row => Number(row.price ?? row.unit_price ?? 0), cell: ({ row }) => <span className="whitespace-nowrap">Rp {Number(row.original.price ?? row.original.unit_price ?? 0).toLocaleString('id-ID')}</span> },
        { id: 'actions', header: 'Aksi', enableSorting: false, enableHiding: false, cell: ({ row }) => rowActions(row.original) },
      ];
    }
    if (kind === 'grn') {
      return [
        { accessorKey: 'po_number', header: 'No. PO / Ref', cell: ({ row }) => <span className="font-mono font-semibold">{row.original.po_number}</span> },
        { accessorKey: 'supplier_name', header: 'Supplier', cell: ({ row }) => <span className="font-medium">{row.original.supplier_name}</span> },
        { accessorKey: 'receipt_date', header: 'Tanggal Masuk', cell: ({ row }) => <span className="whitespace-nowrap font-mono">{dateText(row.original.receipt_date)}</span> },
        { accessorKey: 'total_qty', header: 'Jumlah Unit', cell: ({ row }) => `${row.original.total_qty} Unit` },
        { accessorKey: 'rfid_tagging_status', header: 'Status RFID', cell: ({ row }) => <Badge value={row.original.rfid_tagging_status} /> },
        { accessorKey: 'status', header: 'Status Penerimaan', cell: ({ row }) => <Badge value={row.original.status} /> },
        { id: 'actions', header: 'Aksi', enableSorting: false, enableHiding: false, cell: ({ row }) => rowActions(row.original) },
      ];
    }
    return [
      { accessorKey: 'epc', header: 'EPC Tag (Hex)', cell: ({ row }) => <span className="font-mono font-semibold">{row.original.epc}</span> },
      { accessorKey: 'product_name', header: 'Barang / SKU', cell: ({ row }) => <div><p className="font-medium">{display(row.original.product_name)}</p><span className="text-[11px] text-muted-foreground font-mono">{display(row.original.sku)}</span></div> },
      { accessorKey: 'type', header: 'Tipe Tag', cell: ({ row }) => row.original.type ? display(row.original.type) : row.original.type_label },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge value={row.original.status} /> },
      { accessorKey: 'created_at', header: 'Tanggal Registrasi', cell: ({ row }) => <span className="whitespace-nowrap font-mono">{dateText(row.original.created_at)}</span> },
      { id: 'actions', header: 'Aksi', enableSorting: false, enableHiding: false, cell: ({ row }) => rowActions(row.original) },
    ];
  }, [kind, stock, rowActions]);

  const tableFilters = useMemo(() => {
    if (kind === 'product') {
      return [{ key: 'category', label: 'Kategori', options: categories.map(c => ({ value: c, label: c })) }];
    }
    if (kind === 'grn') {
      return [
        { key: 'status', label: 'Status', options: ['MENUNGGU_VERIFIKASI', 'SELESAI', 'DIBATALKAN'].map(v => ({ value: v, label: display(v) })) },
        { key: 'rfid_tagging_status', label: 'Status RFID', options: ['MENUNGGU_TAGGING', 'SEDANG_TAGGING', 'SELESAI_TAGGING'].map(v => ({ value: v, label: display(v) })) },
      ];
    }
    return [
      { key: 'status', label: 'Status', options: tagStatuses.map(v => ({ value: v, label: display(v) })) },
      { key: 'type', label: 'Tipe Tag', options: typeOptions.map(v => ({ value: v, label: display(v) })) },
    ];
  }, [kind, categories]);

  const productSelector = <Field label="Produk / SKU"><select aria-label="Produk / SKU" required className={inputClass} value={String(form.product_id ?? '')} onChange={e => change('product_id', e.target.value)}><option value="">Pilih produk</option>{products.map(row => <option key={row.id} value={String(row.id)}>{row.sku} — {row.name}</option>)}</select></Field>;
  const selectedReceipt = grns.find(row => String(row.id) === String(form.grn_id));
  const textField = (key, label, attributes = {}) => <Field label={label}><input className={inputClass} required value={form[key] ?? ''} onChange={event => change(key, event.target.value)} {...attributes} /></Field>;
  const modalTitle = modal && (modal.action === 'detail' ? 'Detail ' : modal.action === 'form' ? `${modal.row ? 'Edit' : 'Tambah'} ` : '') + (modal.action === 'delete' ? 'Hapus Produk' : modal.action === 'verify' ? 'Verifikasi Penerimaan' : modal.action === 'cancel' ? 'Batalkan GRN' : modal.action === 'deactivate' ? 'Tandai Tag Rusak' : modal.action === 'replace' ? 'Ganti EPC Simulasi' : modal.kind === 'product' ? 'Master Produk / SKU' : modal.kind === 'grn' ? 'Penerimaan GRN' : 'Tag RFID — Simulasi');
  const detailFields = modal?.kind === 'product' ? [['id', 'ID Produk'], ['sku', 'SKU'], ['name', 'Nama Barang'], ['category', 'Kategori'], ['price', 'Harga'], ['min_stock_alert', 'Minimum Stok'], ['current_stock', 'Stok Tercatat'], ['default_location_code', 'Lokasi Default']] : modal?.kind === 'grn' ? [['id', 'ID GRN'], ['po_number', 'Nomor PO'], ['supplier_name', 'Supplier'], ['receipt_date', 'Tanggal'], ['total_qty', 'Jumlah Unit'], ['status', 'Status'], ['rfid_tagging_status', 'Status RFID'], ['verified_at', 'Waktu Verifikasi']] : [['id', 'ID Tag'], ['epc', 'EPC'], [tagTypeDetailField(modal?.row), 'Tipe'], ['status', 'Status'], ['product_id', 'ID Produk'], ['sku', 'SKU'], ['product_name', 'Produk'], ['grn_id', 'ID GRN'], ['created_at', 'Tanggal Registrasi']];

  return <div className="space-y-6">
    <div data-tour="inbound-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
          <PageIcon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{titles[kind]}</h2>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">{descriptions[kind]}</p>
          {kind === 'product' && <p className="text-xs text-muted-foreground mt-1">Tersedia di Rak menghitung item IN_STOCK. Unit RESERVED tetap tercakup dalam saldo ledger sampai ada mutasi keluar.</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {kind === 'product' && (
          <Button type="button" variant="outline" size="sm" disabled={busy || loading} onClick={() => openForm('tag')}>
            <Tag className="h-4 w-4" />
            Registrasi Tag
          </Button>
        )}
        <Button type="button" size="sm" disabled={busy || loading} onClick={() => openForm(kind)}>
          {kind === 'tag' ? <Tag className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {kind === 'product' ? 'Tambah SKU Barang' : kind === 'grn' ? 'Catat Penerimaan Baru' : 'Registrasi Tag Simulasi'}
        </Button>
      </div>
    </div>
    {notice && <div role="status" className={`p-3.5 rounded-lg border text-xs font-medium ${notice.type === 'error' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'}`}>{notice.message}</div>}
    {loadErrors.length > 0 && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive p-3.5 text-xs">{loadErrors.map(error => <p key={error}>{error}</p>)}<p className="mt-1">Data yang tampil mungkin belum mutakhir. Gunakan Muat Ulang.</p></div>}
    {kind === 'tag' && <div className="rounded-lg border bg-muted/40 text-muted-foreground p-3.5 text-xs flex flex-wrap gap-3"><span className="font-mono">UNASSIGNED → ENCODED (meja penerimaan)</span><span className="font-mono">→ IN_STOCK (putaway) → RESERVED → AUTHORIZED_OUT → EXITED</span><span>DAMAGED: EPC dan riwayat tetap tersimpan.</span></div>}
    <div data-tour="inbound-table" aria-busy={loading}>
      {loading ? (
        <div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">Memuat data dari backend...</div>
      ) : (
        <DataTable
          key={kind}
          data={source}
          columns={tableColumns}
          externalSearch={searchQuery}
          searchPlaceholder={kind === 'product' ? 'Cari SKU atau nama barang...' : kind === 'grn' ? 'Cari No. PO atau supplier...' : 'Cari EPC, SKU, atau barang...'}
          dateField={kind === 'grn' ? 'receipt_date' : kind === 'tag' ? 'created_at' : null}
          initialSorting={kind === 'grn' ? [{ id: 'receipt_date', desc: true }] : kind === 'tag' ? [{ id: 'created_at', desc: true }] : [{ id: 'sku', desc: false }]}
          filters={tableFilters}
          emptyMessage={loadErrors.length ? 'Data belum dapat ditampilkan.' : 'Belum ada data yang sesuai.'}
          toolbarActions={
            <Button type="button" variant="outline" size="sm" disabled={loading || busy} onClick={fetchData} className="h-8 gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              Muat Ulang
            </Button>
          }
        />
      )}
    </div>
    {modal && <Modal title={modalTitle} close={close} busy={busy}>
      {modal.action === 'detail' ? <><dl className="space-y-3">{detailFields.map(([key, label]) => <div key={key} className="grid grid-cols-3 gap-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="col-span-2 break-words font-medium">{display(modal.row[key])}</dd></div>)}</dl>
        {modal.kind === 'grn' && <ReceiptProgress row={modal.row} />}
        {Array.isArray(modal.row.audit_history) && <div className="mt-6 border-t pt-4"><h4 className="font-semibold text-sm mb-3">Riwayat Perubahan</h4>{modal.row.audit_history.length ? <ul className="space-y-3 text-xs text-slate-600">{modal.row.audit_history.map((entry, index) => <li className="break-words" key={entry.id ?? index}>{entry.action} · {display(entry.created_at)}{entry.actor_id && <p>Petugas {entry.actor_id}</p>}{entry.reason && <p className="mt-1">Alasan: {entry.reason}</p>}</li>)}</ul> : <p className="text-xs text-slate-500">Belum ada riwayat perubahan.</p>}</div>}
      </> : <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
        {modal.action === 'form' ? modal.kind === 'product' ? <>
          <Field label="SKU / Kode Barang">
            <div className="flex gap-2">
              <input className={inputClass + ' font-mono min-w-0'} required maxLength={50} placeholder="SKU-AKS-1234" value={form.sku ?? ''} onChange={event => change('sku', event.target.value.toUpperCase())} />
              <button type="button" onClick={() => change('sku', newSku(form.category, form.name))} className={`${buttonClass} bg-slate-200 hover:bg-slate-300 text-slate-800 whitespace-nowrap`}>Generate</button>
            </div>
          </Field>
          {textField('name', 'Nama Barang', { maxLength: 150 })}
          <div className="block text-sm text-slate-600">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">Kategori</span>
              <button type="button" onClick={() => setAddingCategory(prev => !prev)} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                {addingCategory ? 'Batal' : '+ Tambah Kategori Baru'}
              </button>
            </div>
            {addingCategory ? (
              <div className="flex gap-2">
                <input type="text" maxLength={100} placeholder="Ketik nama kategori baru..." className={inputClass + ' min-w-0'} value={newCatInput} onChange={e => setNewCatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomCategory(); } }} autoFocus />
                <button type="button" onClick={addCustomCategory} className={`${buttonClass} bg-blue-600 text-white whitespace-nowrap`}>Simpan</button>
              </div>
            ) : (
              <>
                <input required list="inbound-categories" maxLength={100} placeholder="Pilih atau ketik kategori..." className={inputClass} value={form.category} onChange={e => change('category', e.target.value)} />
                <datalist id="inbound-categories">{categories.map(category => <option key={category} value={category} />)}</datalist>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">{textField('price', 'Harga Satuan (Rp)', { type: 'number', min: 0, max: 9999999999.99, step: '0.01' })}{textField('min_stock_alert', 'Minimum Stok', { type: 'number', min: 0, max: 2147483647, step: 1 })}</div>
          {'default_location_code' in form && textField('default_location_code', 'Lokasi Default (opsional)', { required: false, maxLength: 100 })}
        </> : modal.kind === 'grn' ? <>
          {textField('po_number', 'Nomor PO / Surat Jalan', { maxLength: 50 })}{textField('supplier_name', 'Nama Supplier', { maxLength: 150 })}
          {textField('receipt_date', 'Tanggal Penerimaan', { type: 'date' })}
          <ReceiptLineFields lines={form.lines} products={products} onChange={lines => change('lines', lines)} />
        </> : <>
          <div className="bg-cyan-50 p-3 rounded-xl text-xs text-cyan-800">Simulasi pencatatan EPC. Belum menulis chip atau memverifikasi pembacaan reader fisik.</div>
          {(!modal.row || modal.row.status === 'UNASSIGNED') && <Field label="Jenis registrasi"><select required className={inputClass} value={form.inbound_purpose} onChange={event => change('inbound_purpose', event.target.value)}>
            {!modal.row && <option value="RECEIPT">Penerimaan GRN</option>}
            <option value="ASSET">Aset tanpa GRN — Supervisor</option>
            <option value="SPECIAL">Skenario khusus — Supervisor</option>
          </select></Field>}
          {!modal.row && form.inbound_purpose === 'RECEIPT' ? <>
            <Field label="GRN terverifikasi"><select required className={inputClass} value={form.grn_id} onChange={event => setForm(previous => ({ ...previous, grn_id: event.target.value, grn_line_id: '' }))}>
              <option value="">Pilih GRN</option>{grns.filter(row => row.status === 'SELESAI' && row.has_sku_lines).map(row => <option key={row.id} value={row.id}>{row.po_number} — {row.supplier_name}</option>)}
            </select></Field>
            <Field label="Baris SKU GRN"><select required className={inputClass} disabled={!selectedReceipt} value={form.grn_line_id} onChange={event => change('grn_line_id', event.target.value)}>
              <option value="">Pilih baris SKU</option>{selectedReceipt?.lines.map(line => <option key={line.id} value={line.id} disabled={line.tagged_qty >= line.received_qty}>{line.sku} — {line.product_name} · {line.tagged_qty}/{line.received_qty}</option>)}
            </select></Field>
          </> : productSelector}
          <Field label="Tipe Tag"><select aria-label="Tipe Tag" required className={inputClass} value={form.type} onChange={e => change('type', e.target.value)}><option value="">Pilih tipe tag</option>{typeOptions.map(type => <option key={type} value={type}>{display(type)}</option>)}</select></Field>
          {!modal.row && <>
            <Field label="Jumlah Tag Batch (1 - 100)"><div className="flex items-center gap-2"><input type="number" min={1} max={100} required className={inputClass + ' w-28'} value={form.batch_qty ?? 1} onChange={e => change('batch_qty', e.target.value)} /><span className="text-[11px] text-slate-500">{Number(form.batch_qty) > 1 ? `Auto-generate ${form.batch_qty} EPC unik sekaligus` : 'Mode satuan (bisa isi EPC manual)'}</span></div></Field>
            {Number(form.batch_qty || 1) <= 1 && <Field label="EPC 96-bit — 24 Digit Hexadecimal"><div className="flex gap-2"><input className={inputClass + ' font-mono min-w-0'} value={form.epc_custom} onChange={e => change('epc_custom', e.target.value.toUpperCase())} pattern="[0-9A-Fa-f]{24}" maxLength={24} placeholder="Kosongkan untuk generate di backend" /><button type="button" onClick={() => change('epc_custom', newEpc())} className={`${buttonClass} bg-slate-200`}>Generate</button></div></Field>}
          </>}
        </> : <>
          <p className="text-sm text-slate-600">{modal.action === 'delete' ? `Hapus produk ${modal.row.sku}? Backend akan menolak jika memiliki relasi transaksi.` : modal.action === 'verify' ? `Konfirmasi penerimaan fisik ${modal.row.po_number}? Setelah verifikasi, data penting GRN dikunci. Status RFID tetap mengikuti proses tagging.` : modal.action === 'cancel' ? `Batalkan ${modal.row.po_number}? Riwayat GRN tetap tersimpan. Penerimaan dengan transaksi stok harus melalui reversal terotorisasi.` : modal.action === 'replace' ? `Ganti EPC simulasi ${modal.row.epc} sebelum Putaway. EPC lama dan alasannya tersimpan.` : `Tandai EPC ${modal.row.epc} sebagai DAMAGED? EPC dan seluruh riwayat tetap disimpan.`}</p>
          {modal.action === 'verify' && <ReceiptLineFields lines={form.lines} expected={modal.row.lines} products={products} onChange={lines => change('lines', lines)} />}
          {modal.action === 'replace' && textField('epc', 'EPC pengganti', { required: false, pattern: '[0-9A-Fa-f]{24}', maxLength: 24, placeholder: 'Kosongkan untuk generate di backend' })}
          {['cancel', 'deactivate', 'replace'].includes(modal.action) && <Field label="Alasan (wajib)"><textarea required maxLength={1000} rows={3} className={inputClass} value={form.reason} onChange={e => change('reason', e.target.value)} /></Field>}
        </>}
      </fieldset>
        {formError && <p role="alert" className="p-3 bg-rose-50 text-rose-700 rounded-xl text-sm">{formError}</p>}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100"><button type="button" disabled={busy} onClick={close} className={`${buttonClass} bg-slate-100 text-slate-700`}>Batal</button><button type="submit" disabled={busy} className={`${buttonClass} bg-blue-600 text-white`}>{busy ? 'Menyimpan...' : modal.action === 'form' ? modal.kind === 'tag' ? 'Simpan Registrasi Simulasi' : 'Simpan' : 'Konfirmasi'}</button></div>
      </form>}
    </Modal>}
  </div>;
}
