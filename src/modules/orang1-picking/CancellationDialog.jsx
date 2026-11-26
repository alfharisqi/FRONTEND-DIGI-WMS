import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';

const reasons = {
  STOK_TIDAK_MENCUKUPI: 'Stok tidak mencukupi',
  BARANG_TIDAK_TERSEDIA: 'Barang tidak tersedia',
  PESANAN_PELANGGAN_DIBATALKAN: 'Pesanan pelanggan dibatalkan',
  KESALAHAN_PEMBUATAN_PESANAN: 'Kesalahan pembuatan pesanan',
  KESALAHAN_PEMILIHAN_SKU: 'Kesalahan pemilihan SKU',
  LAINNYA: 'Lainnya',
};

export function CancellationAudit({ audit }) {
  if (!audit) return <p className="text-sm text-muted-foreground">Catatan pembatalan belum tersedia.</p>;
  const cancelledAt = new Date(audit.cancelled_at).toLocaleString('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  });
  return (
    <dl className="space-y-1 text-sm">
      <div><dt className="inline font-medium">Alasan</dt> <dd className="inline">{reasons[audit.reason] ?? audit.reason}</dd></div>
      {audit.notes && <div><dt className="inline font-medium">Keterangan</dt> <dd className="inline whitespace-pre-wrap break-words">{audit.notes}</dd></div>}
      <div><dt className="inline font-medium">Petugas</dt> <dd className="inline">{audit.actor_name || audit.actor_id}</dd></div>
      <div><dt className="inline font-medium">Waktu</dt> <dd className="inline"><time dateTime={audit.cancelled_at}>{cancelledAt} WIB</time></dd></div>
      {audit.released_units?.length > 0 && (
        <div>
          <dt className="font-medium">EPC dikembalikan ke rak</dt>
          <dd><ul className="space-y-1">
            {audit.released_units.map(unit => (
              <li key={unit.scan_id}><code>{unit.epc}</code> · {unit.location_code} · {unit.location_name}</li>
            ))}
          </ul></dd>
        </div>
      )}
    </dl>
  );
}

export default function CancellationDialog({ order, close, onSubmit }) {
  const dialog = useRef(null);
  const pending = useRef(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmedIds, setConfirmedIds] = useState([]);
  const partial = order.status === 'SEDANG_DIAMBIL';
  const reservations = order.lines.flatMap(line => line.scans.filter(scan => scan.active)
    .map(scan => ({ ...scan, productName: line.product_name, sku: line.sku })));
  const returnConfirmed = reservations.length > 0 && confirmedIds.length === reservations.length
    && reservations.every(scan => confirmedIds.includes(scan.id));
  const canSubmit = order.can_cancel === true && reason && (reason !== 'LAINNYA' || notes.trim())
    && (!partial || returnConfirmed);

  useEffect(() => {
    const opener = document.activeElement;
    const element = dialog.current;
    element.showModal();
    return () => {
      element.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (pending.current || !canSubmit) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        reason, notes: notes.trim(),
        ...(partial && { physical_return_confirmed: true, return_scan_ids: confirmedIds }),
      });
    } catch (err) {
      setError(err.message || 'Pembatalan pesanan gagal.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="picking-cancellation-title"
      onCancel={event => { event.preventDefault(); if (!pending.current) close(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-xl border border-border bg-card p-5 text-foreground shadow-xl backdrop:bg-black/50">
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <h2 id="picking-cancellation-title" className="text-lg font-semibold">Konfirmasi Pembatalan Picking</h2>
          <p className="break-all text-sm text-muted-foreground">{order.order_number}</p>
        </div>
        <ul className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-sm">
          {order.lines.map(line => (
            <li key={line.product_id} className="flex flex-wrap justify-between gap-x-2">
              <span>{line.product_name} · {line.sku}</span>
              <span className="text-muted-foreground">{line.requested_qty} unit</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-2 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground">Jumlah diminta</dt><dd>{order.requested_qty} unit</dd></div>
          <div><dt className="text-muted-foreground">EPC tervalidasi</dt><dd>{order.picked_qty}</dd></div>
          <div><dt className="text-muted-foreground">Reservasi aktif</dt><dd>{reservations.length} EPC</dd></div>
        </dl>
        {partial && (
          <div className="space-y-2 rounded-md border border-border p-3 text-sm">
            <h3 className="font-medium">EPC dan rak pengembalian</h3>
            <ul className="space-y-2">
              {reservations.map(scan => (
                <li key={scan.id}>
                  <p><code className="break-all">{scan.epc}</code> · {scan.productName} · {scan.sku}</p>
                  <p className="text-muted-foreground">{scan.location_code} · {scan.location_name}</p>
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={returnConfirmed} disabled={busy || !reservations.length}
                onChange={event => setConfirmedIds(event.target.checked ? reservations.map(scan => scan.id) : [])} />
              <span>Saya sudah mengembalikan seluruh barang di atas secara fisik ke rak yang tercantum.</span>
            </label>
          </div>
        )}
        <label className="block space-y-1.5 text-sm font-medium">
          <span>Alasan pembatalan</span>
          <select required value={reason} onChange={event => setReason(event.target.value)} disabled={busy}
            className="h-9 w-full rounded-md border border-input bg-background px-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="">Pilih alasan</option>
            {Object.entries(reasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          <span>Keterangan tambahan</span>
          <textarea value={notes} onChange={event => setNotes(event.target.value)} required={reason === 'LAINNYA'} disabled={busy} rows={2}
            className="w-full rounded-md border border-input bg-background p-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </label>
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-foreground">
          {partial
            ? 'Pesanan akan dibatalkan secara permanen. EPC yang dilepas akan tersedia kembali di stok rak.'
            : 'Pesanan akan dibatalkan secara permanen. Status RFID dan saldo stok tetap sama karena Picking belum dimulai.'}
        </p>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={busy}>Kembali</Button>
          <Button type="submit" variant="destructive" disabled={busy || !canSubmit}>
            {busy ? 'Membatalkan…' : 'Konfirmasi Pembatalan'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
