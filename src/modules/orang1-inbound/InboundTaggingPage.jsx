import React, { useCallback, useEffect, useRef, useState } from 'react';
import { inboundRequest, newEpc, normalizeTag, productForm, selectedProductId, tagTypeDetailField } from './api';

const inputClass = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const buttonClass = 'px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed';
const typeOptions = ['STANDARD_LABEL', 'ON_METAL', 'HARD_TAG'];
const tagStatuses = ['UNASSIGNED', 'ENCODED', 'IN_STOCK', 'RESERVED', 'AUTHORIZED_OUT', 'EXITED', 'DAMAGED'];
const labels = { MENUNGGU_VERIFIKASI: 'Menunggu Verifikasi', SELESAI: 'Selesai', DIBATALKAN: 'Dibatalkan', MENUNGGU_TAGGING: 'Menunggu Tagging', STANDARD_LABEL: 'Label Biasa (UHF)', ON_METAL: 'On Metal', HARD_TAG: 'Hard Tag' };
const display = value => value === undefined || value === null || value === '' ? '—' : (labels[value] || String(value));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateText = value => value ? String(value).slice(0, 10) : '—';
const pathFor = kind => kind === 'product' ? '/products' : kind === 'grn' ? '/inbound/grn' : '/tags';
function Field({ label, children }) { return <label className="block text-sm text-slate-600"><span className="block text-xs font-semibold mb-1">{label}</span>{children}</label>; }
function Badge({ value }) { return <span className={`inline-block text-xs px-2.5 py-1 rounded-lg font-semibold ${['DIBATALKAN', 'DAMAGED'].includes(value) ? 'bg-rose-50 text-rose-700' : value === 'MENUNGGU_VERIFIKASI' ? 'bg-amber-50 text-amber-700' : 'bg-cyan-50 text-cyan-700'}`}>{display(value)}</span>; }
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
  const [loading, setLoading] = useState(true), [loadErrors, setLoadErrors] = useState([]);
  const [localSearch, setLocalSearch] = useState(''), [filter, setFilter] = useState(''), [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState(null), [form, setForm] = useState({}), [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(null);
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
  useEffect(() => { setLocalSearch(''); setFilter(''); setTypeFilter(''); if (!busyRef.current) { setModal(null); setFormError(''); } }, [activeMenu]);
  const close = () => { if (!busyRef.current) { setModal(null); setFormError(''); } };
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const openForm = (kind, row) => {
    setFormError('');
    setForm(kind === 'product' ? productForm(row ?? (products.some(product => 'default_location_code' in product) ? { default_location_code: '' } : {})) : kind === 'grn' ? {
      po_number: row?.po_number ?? '', supplier_name: row?.supplier_name ?? '', receipt_date: row ? dateText(row.receipt_date) : today(), total_qty: row?.total_qty ?? 1,
    } : { product_id: row?.product_id ?? '', type: row ? row.type ?? '' : 'STANDARD_LABEL', epc_custom: '', grn_id: row?.grn_id ?? '', ...(row?.status === 'UNASSIGNED' ? { status: 'ENCODED' } : {}) });
    setModal({ action: 'form', kind, row });
  };
  const details = async (kind, row) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try { const data = await inboundRequest(`${pathFor(kind)}/${encodeURIComponent(row.id)}`); setFormError(''); setModal({ action: 'detail', kind, row: kind === 'tag' ? normalizeTag(data) : data }); }
    catch (error) { notify(error.message, 'error'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const action = (kind, row, operation) => { setForm({ reason: '' }); setFormError(''); setModal({ action: operation, kind, row }); };
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
        if (kind === 'grn') payload.total_qty = Number(form.total_qty);
        if (kind === 'tag') {
          payload.product_id = selectedProductId(products, form.product_id);
          if (row) { delete payload.epc_custom; delete payload.grn_id; }
          else { payload.epc_custom = form.epc_custom.trim().toUpperCase(); payload.mode = 'simulation'; if (!payload.grn_id) delete payload.grn_id; }
        }
        method = row ? (kind === 'tag' ? 'PATCH' : 'PUT') : 'POST';
        path += row ? `/${encodeURIComponent(row.id)}` : kind === 'tag' ? '/encode' : '';
      } else {
        path += `/${encodeURIComponent(row.id)}`;
        method = operation === 'delete' ? 'DELETE' : 'PATCH';
        if (operation !== 'delete') path += `/${operation}`;
        if (['cancel', 'deactivate'].includes(operation)) payload = { reason: form.reason.trim() };
      }
      await inboundRequest(path, method, payload);
      setModal(null);
      notify(kind === 'tag' && operation === 'form' ? 'Registrasi simulasi tersimpan. Penulisan chip fisik belum dilakukan.' : 'Perubahan berhasil disimpan.');
      await fetchData();
    } catch (error) { setFormError(error.message); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const kind = activeMenu === 'stok' ? 'product' : activeMenu === 'penerimaan' ? 'grn' : 'tag';
  const titles = { product: 'Inventaris Stok Barang Gudang', grn: 'Manajemen Penerimaan Barang (Inbound & GRN)', tag: 'Manajemen Tag RFID UHF & Encoding' };
  const descriptions = { product: 'Kelola master SKU dan lihat stok yang tercatat pada sistem gudang.', grn: 'Catat surat jalan supplier, verifikasi penerimaan, dan pantau status RFID.', tag: 'Mode simulasi: registrasi EPC 96-bit dan tautkan produk. Encoding chip fisik memerlukan reader dan konfirmasi perangkat.' };
  const search = `${localSearch} ${searchQuery}`.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const source = kind === 'product' ? products : kind === 'grn' ? grns : tags;
  const filtered = source.filter(row => {
    const haystack = (kind === 'product' ? `${row.sku} ${row.name}` : kind === 'grn' ? `${row.po_number} ${row.supplier_name}` : `${row.epc} ${row.sku} ${row.product_name}`).toLowerCase();
    return search.every(term => haystack.includes(term)) && (!filter || (kind === 'product' ? row.category : row.status) === filter) && (!typeFilter || row.type === typeFilter);
  });
  const categories = [...new Set(products.map(row => row.category).filter(Boolean))].sort();
  const filters = kind === 'product' ? categories : kind === 'grn' ? ['MENUNGGU_VERIFIKASI', 'SELESAI', 'DIBATALKAN'] : tagStatuses;
  const tableHeaders = kind === 'product' ? ['SKU / Kode', 'Nama Barang', 'Kategori', 'Lokasi Default', 'Jumlah Stok', 'Minimum Stok', 'Harga Satuan', 'Aksi'] : kind === 'grn' ? ['No. PO / Ref', 'Supplier', 'Tanggal Masuk', 'Jumlah Unit', 'Status RFID', 'Status Penerimaan', 'Aksi'] : ['EPC Tag (Hex)', 'Barang / SKU', 'Tipe Tag', 'Status', 'Tanggal Registrasi', 'Aksi'];
  const rowActions = row => <div className="flex flex-wrap justify-end gap-3 min-w-40">
    <button type="button" disabled={busy} onClick={() => details(kind, row)} className="text-xs font-semibold text-blue-600 disabled:opacity-50">Detail</button>
    {(kind === 'product' || (kind === 'grn' && row.status === 'MENUNGGU_VERIFIKASI') || (kind === 'tag' && ['UNASSIGNED', 'ENCODED'].includes(row.status))) && <button type="button" disabled={busy} onClick={() => openForm(kind, row)} className="text-xs font-semibold text-blue-600 disabled:opacity-50">Edit</button>}
    {kind === 'product' && <button type="button" disabled={busy} onClick={() => action(kind, row, 'delete')} className="text-xs font-semibold text-rose-600">Hapus</button>}
    {kind === 'grn' && row.status === 'MENUNGGU_VERIFIKASI' && <><button type="button" disabled={busy} onClick={() => action(kind, row, 'verify')} className="text-xs font-semibold text-emerald-700">Verifikasi</button><button type="button" disabled={busy} onClick={() => action(kind, row, 'cancel')} className="text-xs font-semibold text-rose-600">Batalkan</button></>}
    {kind === 'tag' && ['UNASSIGNED', 'ENCODED'].includes(row.status) && <button type="button" disabled={busy} onClick={() => action(kind, row, 'deactivate')} className="text-xs font-semibold text-rose-600">Tandai Rusak</button>}
  </div>;
  const productSelector = <Field label="Produk / SKU"><select aria-label="Produk / SKU" required className={inputClass} value={String(form.product_id ?? '')} onChange={e => change('product_id', e.target.value)}><option value="">Pilih produk</option>{products.map(row => <option key={row.id} value={String(row.id)}>{row.sku} — {row.name}</option>)}</select></Field>;
  const textField = (key, label, attributes = {}) => <Field label={label}><input className={inputClass} required value={form[key] ?? ''} onChange={event => change(key, event.target.value)} {...attributes} /></Field>;
  const modalTitle = modal && (modal.action === 'detail' ? 'Detail ' : modal.action === 'form' ? `${modal.row ? 'Edit' : 'Tambah'} ` : '') + (modal.action === 'delete' ? 'Hapus Produk' : modal.action === 'verify' ? 'Verifikasi Penerimaan' : modal.action === 'cancel' ? 'Batalkan GRN' : modal.action === 'deactivate' ? 'Tandai Tag Rusak' : modal.kind === 'product' ? 'Master Produk / SKU' : modal.kind === 'grn' ? 'Penerimaan GRN' : 'Tag RFID — Simulasi');
  const detailFields = modal?.kind === 'product' ? [['id', 'ID Produk'], ['sku', 'SKU'], ['name', 'Nama Barang'], ['category', 'Kategori'], ['price', 'Harga'], ['min_stock_alert', 'Minimum Stok'], ['current_stock', 'Stok Tercatat'], ['default_location_code', 'Lokasi Default']] : modal?.kind === 'grn' ? [['id', 'ID GRN'], ['po_number', 'Nomor PO'], ['supplier_name', 'Supplier'], ['receipt_date', 'Tanggal'], ['total_qty', 'Jumlah Unit'], ['status', 'Status'], ['rfid_tagging_status', 'Status RFID'], ['verified_at', 'Waktu Verifikasi']] : [['id', 'ID Tag'], ['epc', 'EPC'], [tagTypeDetailField(modal?.row), 'Tipe'], ['status', 'Status'], ['product_id', 'ID Produk'], ['sku', 'SKU'], ['product_name', 'Produk'], ['grn_id', 'ID GRN'], ['created_at', 'Tanggal Registrasi']];

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div><h2 className="text-xl font-bold text-slate-900">{titles[kind]}</h2><p className="text-xs text-slate-500 mt-1 max-w-2xl">{descriptions[kind]}</p></div>
      <div className="flex flex-wrap gap-2">{kind === 'product' && <button disabled={busy || loading} onClick={() => openForm('tag')} className={`${buttonClass} bg-cyan-600 text-white`}>🏷️ Registrasi Tag</button>}<button disabled={busy || loading} onClick={() => openForm(kind)} className={`${buttonClass} bg-blue-600 hover:bg-blue-700 text-white shadow-md`}>{kind === 'product' ? '➕ Tambah SKU Barang' : kind === 'grn' ? '➕ Catat Penerimaan Baru' : '🏷️ Registrasi Tag Simulasi'}</button></div>
    </div>
    {notice && <div role="status" className={`p-4 rounded-xl text-sm ${notice.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{notice.message}</div>}
    {loadErrors.length > 0 && <div role="alert" className="bg-rose-50 text-rose-700 p-4 rounded-xl text-sm">{loadErrors.map(error => <p key={error}>{error}</p>)}<p>Data yang tampil mungkin belum mutakhir. Gunakan Muat Ulang.</p></div>}
    {kind === 'tag' && <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl text-xs flex flex-wrap gap-3"><span>UNASSIGNED → ENCODED (meja penerimaan)</span><span>→ IN_STOCK (putaway) → RESERVED → AUTHORIZED_OUT → EXITED</span><span>DAMAGED: EPC dan riwayat tetap tersimpan.</span></div>}
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" aria-busy={loading}>
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-3">
        <input aria-label="Cari data Orang 1" value={localSearch} onChange={e => setLocalSearch(e.target.value)} placeholder={kind === 'product' ? 'Cari nama barang atau SKU...' : kind === 'grn' ? 'Cari nomor PO atau supplier...' : 'Cari EPC, SKU atau nama barang...'} className={`${inputClass} sm:max-w-xs`} />
        <div className="flex flex-wrap gap-2"><select aria-label={kind === 'product' ? 'Filter kategori' : 'Filter status'} className={inputClass + ' !w-auto'} value={filter} onChange={e => setFilter(e.target.value)}><option value="">{kind === 'product' ? 'Semua Kategori' : 'Semua Status'}</option>{filters.map(value => <option key={value} value={value}>{display(value)}</option>)}</select>
          {kind === 'tag' && <select aria-label="Filter tipe tag" className={inputClass + ' !w-auto'} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">Semua Tipe</option>{typeOptions.map(type => <option key={type} value={type}>{display(type)}</option>)}</select>}
          <button disabled={loading || busy} onClick={fetchData} className={`${buttonClass} bg-slate-100 text-slate-700`}>Muat Ulang</button>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse text-sm"><thead><tr className="bg-slate-50 text-slate-600 border-b border-slate-200">{tableHeaders.map(header => <th key={header} className="p-4 whitespace-nowrap">{header}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {loading ? <tr><td className="p-8 text-center" colSpan={tableHeaders.length}>Memuat data dari backend...</td></tr> : filtered.length === 0 ? <tr><td className="p-8 text-center text-slate-500" colSpan={tableHeaders.length}>{loadErrors.length ? 'Data belum dapat ditampilkan.' : 'Belum ada data yang sesuai.'}</td></tr> : filtered.map(row => <tr key={row.id} className="hover:bg-slate-50">
            {kind === 'product' ? <><td className="p-4 font-mono font-bold text-blue-600">{row.sku}</td><td className="p-4 font-semibold text-slate-900">{row.name}</td><td className="p-4">{row.category}</td><td className="p-4">{display(row.default_location_code)}</td><td className="p-4 font-bold">{display(row.current_stock)} Unit</td><td className="p-4">{display(row.min_stock_alert ?? row.min_stock_threshold)}</td><td className="p-4 whitespace-nowrap">Rp {Number(row.price ?? row.unit_price ?? 0).toLocaleString('id-ID')}</td></> : kind === 'grn' ? <><td className="p-4 font-mono font-bold text-blue-600">{row.po_number}</td><td className="p-4">{row.supplier_name}</td><td className="p-4 whitespace-nowrap">{dateText(row.receipt_date)}</td><td className="p-4">{row.total_qty} Unit</td><td className="p-4"><Badge value={row.rfid_tagging_status} /></td><td className="p-4"><Badge value={row.status} /></td></> : <><td className="p-4 font-mono font-bold text-cyan-700">{row.epc}</td><td className="p-4"><p className="font-semibold">{display(row.product_name)}</p><span className="text-xs text-slate-400 font-mono">{display(row.sku)}</span></td><td className="p-4">{row.type ? display(row.type) : row.type_label}</td><td className="p-4"><Badge value={row.status} /></td><td className="p-4">{dateText(row.created_at)}</td></>}
            <td className="p-4">{rowActions(row)}</td>
          </tr>)}
        </tbody></table></div>
    </div>
    {modal && <Modal title={modalTitle} close={close} busy={busy}>
      {modal.action === 'detail' ? <><dl className="space-y-3">{detailFields.map(([key, label]) => <div key={key} className="grid grid-cols-3 gap-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="col-span-2 break-words font-medium">{display(modal.row[key])}</dd></div>)}</dl>
        {Array.isArray(modal.row.audit_history) && <div className="mt-6 border-t pt-4"><h4 className="font-semibold text-sm mb-3">Riwayat Perubahan</h4>{modal.row.audit_history.length ? <ul className="space-y-3 text-xs text-slate-600">{modal.row.audit_history.map((entry, index) => <li key={entry.id ?? index}>{entry.action} · {display(entry.created_at)}{entry.reason && <p className="mt-1">Alasan: {entry.reason}</p>}</li>)}</ul> : <p className="text-xs text-slate-500">Belum ada riwayat perubahan.</p>}</div>}
      </> : <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
        {modal.action === 'form' ? modal.kind === 'product' ? <>
          {textField('sku', 'SKU / Kode Barang', { maxLength: 50 })}{textField('name', 'Nama Barang', { maxLength: 150 })}
          <Field label="Kategori"><input required list="inbound-categories" maxLength={100} className={inputClass} value={form.category} onChange={e => change('category', e.target.value)} /><datalist id="inbound-categories">{categories.map(category => <option key={category} value={category} />)}</datalist></Field>
          <div className="grid grid-cols-2 gap-4">{textField('price', 'Harga Satuan (Rp)', { type: 'number', min: 0, max: 9999999999.99, step: '0.01' })}{textField('min_stock_alert', 'Minimum Stok', { type: 'number', min: 0, max: 2147483647, step: 1 })}</div>
          {'default_location_code' in form && textField('default_location_code', 'Lokasi Default (opsional)', { required: false, maxLength: 100 })}
        </> : modal.kind === 'grn' ? <>
          {textField('po_number', 'Nomor PO / Surat Jalan', { maxLength: 50 })}{textField('supplier_name', 'Nama Supplier', { maxLength: 150 })}
          <div className="grid grid-cols-2 gap-4">{textField('receipt_date', 'Tanggal Penerimaan', { type: 'date' })}{textField('total_qty', 'Jumlah Unit', { type: 'number', min: 1, max: 2147483647, step: 1 })}</div>
          <p className="text-xs text-slate-500">Penerimaan baru menunggu verifikasi dan tagging. Produk ditautkan melalui tag/item saat registrasi RFID.</p>
        </> : <>
          <div className="bg-cyan-50 p-3 rounded-xl text-xs text-cyan-800">Simulasi pencatatan EPC. Belum menulis chip atau memverifikasi pembacaan reader fisik.</div>
          {productSelector}
          <Field label="Tipe Tag"><select aria-label="Tipe Tag" required className={inputClass} value={form.type} onChange={e => change('type', e.target.value)}><option value="">Pilih tipe tag</option>{typeOptions.map(type => <option key={type} value={type}>{display(type)}</option>)}</select></Field>
          {!modal.row && <>
            <Field label="Penerimaan GRN (opsional)"><select aria-label="Penerimaan GRN (opsional)" className={inputClass} value={form.grn_id} onChange={e => change('grn_id', e.target.value)}><option value="">Tanpa GRN</option>{grns.filter(row => row.status !== 'DIBATALKAN').map(row => <option key={row.id} value={row.id}>{row.po_number} — {row.supplier_name}</option>)}</select></Field>
            <Field label="EPC 96-bit — 24 Digit Hexadecimal"><div className="flex gap-2"><input className={inputClass + ' font-mono min-w-0'} value={form.epc_custom} onChange={e => change('epc_custom', e.target.value.toUpperCase())} pattern="[0-9A-Fa-f]{24}" maxLength={24} placeholder="Kosongkan untuk generate di backend" /><button type="button" onClick={() => change('epc_custom', newEpc())} className={`${buttonClass} bg-slate-200`}>Generate</button></div></Field>
          </>}
        </> : <>
          <p className="text-sm text-slate-600">{modal.action === 'delete' ? `Hapus produk ${modal.row.sku}? Backend akan menolak jika memiliki relasi transaksi.` : modal.action === 'verify' ? `Konfirmasi penerimaan fisik ${modal.row.po_number}? Setelah verifikasi, data penting GRN dikunci. Status RFID tetap mengikuti proses tagging.` : modal.action === 'cancel' ? `Batalkan ${modal.row.po_number}? Riwayat GRN tetap tersimpan. Penerimaan dengan transaksi stok harus melalui reversal terotorisasi.` : `Tandai EPC ${modal.row.epc} sebagai DAMAGED? EPC dan seluruh riwayat tetap disimpan.`}</p>
          {['cancel', 'deactivate'].includes(modal.action) && <Field label="Alasan (wajib)"><textarea required maxLength={1000} rows={3} className={inputClass} value={form.reason} onChange={e => change('reason', e.target.value)} /></Field>}
        </>}
      </fieldset>
        {formError && <p role="alert" className="p-3 bg-rose-50 text-rose-700 rounded-xl text-sm">{formError}</p>}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100"><button type="button" disabled={busy} onClick={close} className={`${buttonClass} bg-slate-100 text-slate-700`}>Batal</button><button type="submit" disabled={busy} className={`${buttonClass} bg-blue-600 text-white`}>{busy ? 'Menyimpan...' : modal.action === 'form' ? modal.kind === 'tag' ? 'Simpan Registrasi Simulasi' : 'Simpan' : 'Konfirmasi'}</button></div>
      </form>}
    </Modal>}
  </div>;
}
