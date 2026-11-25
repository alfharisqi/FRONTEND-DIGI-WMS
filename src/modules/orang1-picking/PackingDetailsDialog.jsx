import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardCheck, PackageCheck } from 'lucide-react';
import { pickingRequest } from './api';

const checks = [
  ['quantity_checked', 'Jumlah fisik barang sudah sesuai dengan pesanan.'],
  ['epc_checked', 'Seluruh EPC/barcode barang sudah tervalidasi.'],
  ['condition_checked', 'Kondisi fisik barang telah diperiksa dan layak dikirim.'],
  ['packaging_checked', 'Barang sudah dikemas dengan aman.'],
  ['label_checked', 'Label identitas pesanan sudah dipasang dan sesuai.'],
];
const button = 'inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50';
const primary = `${button} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`;
const date = value => value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Belum tersedia';
const pickingLabels = { DIKIRIM: 'Dikirim / Kurir', SIAP_PACKING: 'Siap Packing', SEDANG_DIAMBIL: 'Sedang Diambil', MENUNGGU_PICKING: 'Menunggu Picking' };

function OrderItems({ order }) {
  return (
    <ul className="space-y-3" aria-label="Rincian barang dan EPC">
      {order.lines.map(line => (
        <li key={line.product_id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap justify-between gap-1">
            <p className="font-semibold text-slate-900">{line.product_name} <span className="font-normal text-slate-600">· {line.sku}</span></p>
            <span className="text-sm text-slate-600">{line.picked_qty}/{line.requested_qty} unit diambil</span>
          </div>
          {line.picked_qty < line.requested_qty && (
            <p className="mt-1 text-sm text-slate-600">Rak tersedia: {line.locations.length
              ? line.locations.map(rack => `${rack.code} · ${rack.name}`).join(', ') : 'Belum ada rak yang tersedia.'}</p>
          )}
          {line.scans.length ? (
            <ul className="mt-2 divide-y divide-slate-100 text-xs text-slate-600">
              {line.scans.map(scan => (
                <li key={scan.id} className="flex flex-wrap gap-x-3 gap-y-1 py-1.5">
                  <code className="break-all font-semibold text-slate-900">{scan.epc}</code>
                  <span>{scan.location_code} · {scan.location_name}</span>
                  <span>{date(scan.scanned_at)}</span>
                  <span>Petugas: {scan.scanner_name || scan.scanned_by || 'Belum tercatat'}</span>
                  {!scan.active && <span>Reservasi dilepas</span>}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-slate-500">Belum ada EPC tervalidasi atau rak asal yang tercatat.</p>}
        </li>
      ))}
    </ul>
  );
}

export default function PackingDetailsDialog({ orderId, orderNumber, mode, close, onOrderChange, notify }) {
  const dialog = useRef(null);
  const pending = useRef(false);
  const [view, setView] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const isPacking = mode === 'packing';
  const base = `/orders/${encodeURIComponent(orderId)}`;

  function useSnapshot(next) {
    setView(next);
    setDraft(next.checklist);
  }
  const load = useCallback(async signal => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await pickingRequest(`${base}/packing`, { signal });
      if (!signal?.aborted) useSnapshot(result);
    } catch (error) {
      if (!signal?.aborted) setMessage({ error: true, text: error.message });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [base]);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element.showModal();
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
      element.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [load]);

  const completed = view?.status === 'SELESAI_PACKING';
  const dirty = Boolean(view && checks.some(([key]) => draft[key] !== view.checklist[key]));
  const done = draft ? checks.filter(([key]) => draft[key]).length : 0;
  const canEdit = Boolean(view?.picking_complete && !completed && !loading && !busy);
  const canComplete = canEdit && !dirty && done === checks.length;

  async function submit(finalize) {
    if (pending.current || (finalize ? !canComplete : !canEdit || !dirty)) return;
    pending.current = true;
    setBusy(true);
    setMessage(null);
    setConfirm(false);
    try {
      const result = await pickingRequest(`${base}/${finalize ? 'packing-complete' : 'packing-checklist'}`, {
        method: finalize ? 'POST' : 'PATCH',
        body: finalize ? { revision: view.revision } : { revision: view.revision, checklist: draft },
      });
      useSnapshot(result);
      onOrderChange(result.order);
      const text = finalize ? 'Packing selesai. Paket siap diserahterimakan.' : 'Checklist Packing tersimpan.';
      setMessage({ error: false, text });
      notify?.(text, 'success');
    } catch (error) {
      setMessage({ error: true, text: error.message });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function requestClose() {
    if (pending.current || (dirty && !window.confirm('Tutup tanpa menyimpan perubahan checklist?'))) return;
    close();
  }

  return (
    <dialog ref={dialog} aria-labelledby="packing-dialog-title"
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-auto rounded-2xl bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/50"
      onCancel={event => { event.preventDefault(); requestClose(); }}>
      <div className="space-y-4 p-5 sm:p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900" id="packing-dialog-title">{isPacking ? 'Verifikasi Pengemasan' : 'Detail Pesanan'}</h2>
            <p className="break-all text-sm text-slate-600">{orderNumber}</p>
          </div>
          <button className={button} disabled={busy} onClick={requestClose}>Tutup</button>
        </header>
        {loading && <p role="status">Memuat detail pesanan…</p>}
        {view && (
          <>
            <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
              <div><dt className="text-slate-600">Picking</dt><dd className="font-semibold">{pickingLabels[view.order.status]}</dd></div>
              <div><dt className="text-slate-600">Packing</dt><dd className="font-semibold">{completed ? 'Packing Selesai' : view.picking_complete ? 'Menunggu Packing' : 'Belum siap packing'}</dd></div>
              <div><dt className="text-slate-600">Progres Picking</dt><dd className="font-semibold">{view.order.picked_qty}/{view.order.requested_qty} unit</dd></div>
              <div><dt className="text-slate-600">Dibuat</dt><dd>{date(view.order.created_at)}</dd></div>
              {completed && <div className="col-span-2"><dt className="text-slate-600">Packing selesai</dt><dd>{date(view.completed_at)} · {view.completed_by_name || view.completed_by || 'Petugas belum tercatat'}</dd></div>}
            </dl>
            <OrderItems order={view.order} />
            {isPacking && (
              <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-semibold"><ClipboardCheck size={18} /> Checklist Packing</h3>
                  <span className="text-sm text-slate-600">{done}/{checks.length} diperiksa</span>
                </div>
                {!view.picking_complete && !completed && <p className="text-sm text-amber-800">Picking belum lengkap atau ada EPC yang tidak lagi direservasi.</p>}
                <fieldset className="space-y-2" disabled={!canEdit || confirm}>
                  <legend className="sr-only">Pemeriksaan Pengemasan</legend>
                  {checks.map(([key, label]) => (
                    <label className="flex items-start gap-2.5 text-sm" key={key}>
                      <input className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" type="checkbox" checked={draft[key]}
                        onChange={event => setDraft({ ...draft, [key]: event.target.checked })} />
                      <span>{label}</span>
                    </label>
                  ))}
                </fieldset>
                {view.updated_at && <p className="text-xs text-slate-600">Checklist disimpan oleh {view.checked_by_name || view.checked_by || 'petugas belum tercatat'}.</p>}
                {dirty && <p className="text-sm text-amber-800">Perubahan belum disimpan.</p>}
                {!completed && (
                  <div className="flex flex-wrap gap-2">
                    <button className={button} disabled={!canEdit || !dirty || confirm} onClick={() => submit(false)}>Simpan Checklist</button>
                    <button className={primary} disabled={!canComplete || confirm} onClick={() => setConfirm(true)}><PackageCheck size={16} /> Selesai Packing</button>
                  </div>
                )}
                {confirm && (
                  <div role="alertdialog" aria-label="Konfirmasi selesai packing" className="rounded-lg border border-emerald-200 bg-white p-3">
                    <p className="mb-2 text-sm">Selesaikan pengemasan order ini? Checklist akan dikunci.</p>
                    <div className="flex flex-wrap gap-2">
                      <button className={button} onClick={() => setConfirm(false)}>Batal</button>
                      <button className={primary} autoFocus onClick={() => submit(true)}>Konfirmasi Selesai Packing</button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
        {message && <p role={message.error ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${message.error ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{message.text}</p>}
        {message?.error && <button className={button} disabled={busy || loading} onClick={() => load()}>Muat Ulang Detail</button>}
      </div>
    </dialog>
  );
}
