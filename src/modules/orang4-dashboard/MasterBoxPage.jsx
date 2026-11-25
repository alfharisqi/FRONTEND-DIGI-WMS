import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Box,
  PackagePlus,
  PackageOpen,
  ArrowRightLeft,
  RefreshCw,
  CheckCircle2,
  X,
  Layers,
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';

export default function MasterBoxPage({ showNotification, lastEvent }) {
  const [boxes, setBoxes] = useState([]);
  const [summary, setSummary] = useState({
    total_boxes: 0,
    master_boxes: 0,
    inner_boxes: 0,
    sealed_boxes: 0,
    in_rack_boxes: 0,
    unpacked_boxes: 0,
    total_units_in_active_boxes: 0,
  });
  const [products, setProducts] = useState([]);
  const [racks, setRacks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Terima Box Baru (Master Carton atau Inner Box)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    box_level: 'MASTER',
    product_id: '',
    inner_box_count: 25,
    qty_per_inner: 10,
    qty_per_box: 10,
    location_code: 'INB01',
    master_epc: '',
    notes: '',
  });

  // Modal Putaway Box
  const [putawayBox, setPutawayBox] = useState(null);
  const [targetRack, setTargetRack] = useState('');
  const [savingPutaway, setSavingPutaway] = useState(false);

  // Modal Hasil Break-Pack (Inner Boxes atau EPC Satuan)
  const [unpackingId, setUnpackingId] = useState(null);
  const [unpackedResult, setUnpackedResult] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [boxRes, prodRes, locRes] = await Promise.all([
        fetch(`${API_BASE_URL}/boxes`),
        fetch(`${API_BASE_URL}/products`),
        fetch(`${API_BASE_URL}/locations`),
      ]);
      const [boxJson, prodJson, locJson] = await Promise.all([
        boxRes.json(),
        prodRes.json(),
        locRes.json(),
      ]);

      setBoxes(Array.isArray(boxJson.data) ? boxJson.data : []);
      if (boxJson.summary) setSummary(boxJson.summary);

      setProducts(Array.isArray(prodJson.data) ? prodJson.data : []);

      const locList = Array.isArray(locJson.data) ? locJson.data : [];
      const rackOnly = locList.filter((l) => l.location_type === 'RACK');
      setRacks(rackOnly);
      if (rackOnly.length > 0 && !targetRack) {
        setTargetRack(rackOnly[0].code);
      }
    } catch (err) {
      console.error('Gagal memuat data Master Box:', err);
      showNotification?.('Gagal memuat data Master Box dari server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [lastEvent]);

  const handleCreateBox = async (e) => {
    e.preventDefault();
    if (!form.product_id) {
      showNotification?.('Silakan pilih produk terlebih dahulu.', 'error');
      return;
    }
    setCreating(true);
    try {
      const payload =
        form.box_level === 'MASTER'
          ? {
              box_level: 'MASTER',
              product_id: form.product_id,
              inner_box_count: Number(form.inner_box_count),
              qty_per_inner: Number(form.qty_per_inner),
              location_code: form.location_code,
              master_epc: form.master_epc.trim() || undefined,
              notes: form.notes.trim() || undefined,
            }
          : {
              box_level: 'INNER',
              product_id: form.product_id,
              qty_per_box: Number(form.qty_per_box),
              location_code: form.location_code,
              master_epc: form.master_epc.trim() || undefined,
              notes: form.notes.trim() || undefined,
            };

      const res = await fetch(`${API_BASE_URL}/boxes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Gagal mendaftarkan Box.');
      showNotification?.(json.message, 'success');
      setShowCreateModal(false);
      setForm({
        box_level: 'MASTER',
        product_id: '',
        inner_box_count: 25,
        qty_per_inner: 10,
        qty_per_box: 10,
        location_code: 'INB01',
        master_epc: '',
        notes: '',
      });
      await fetchAll();
    } catch (err) {
      showNotification?.(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handlePutawayBox = async (e) => {
    e.preventDefault();
    if (!putawayBox || !targetRack) return;
    setSavingPutaway(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/boxes/${encodeURIComponent(putawayBox.id)}/putaway`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location_code: targetRack }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Gagal putaway Box.');
      showNotification?.(json.message, 'success');
      setPutawayBox(null);
      await fetchAll();
    } catch (err) {
      showNotification?.(err.message, 'error');
    } finally {
      setSavingPutaway(false);
    }
  };

  const handleUnpackBox = async (box) => {
    const isMaster = String(box.box_level || 'INNER').toUpperCase() === 'MASTER';
    const confirmText = isMaster
      ? `Break-Pack Tahap 1 untuk ${box.box_code}?\n1 Master Carton (${box.qty_per_box} unit) akan dipecah menjadi ${box.inner_box_count} Inner Box (masing-masing ${box.qty_per_inner} unit).`
      : `Break-Pack Satuan untuk ${box.box_code}?\n1 Inner Box akan dipecah menjadi ${box.qty_per_box} tag RFID satuan (Pcs) untuk produk ${box.sku}.`;

    if (!window.confirm(confirmText)) return;

    setUnpackingId(box.id);
    try {
      const res = await fetch(
        `${API_BASE_URL}/boxes/${encodeURIComponent(box.id)}/unpack`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: isMaster ? 'TO_INNER' : 'TO_UNIT' }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Gagal memecah Box.');
      showNotification?.(json.message, 'success');
      setUnpackedResult({
        unpack_mode: json.data?.unpack_mode || (isMaster ? 'TO_INNER' : 'TO_UNIT'),
        box_code: box.box_code,
        sku: box.sku,
        product_name: box.product_name,
        target_status: json.data?.target_status,
        qty_per_inner: json.data?.qty_per_inner,
        generated_boxes: json.data?.generated_boxes || [],
        generated_epcs: json.data?.generated_epcs || [],
      });
      await fetchAll();
    } catch (err) {
      showNotification?.(err.message, 'error');
    } finally {
      setUnpackingId(null);
    }
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: 'box_code',
        header: 'Kode Box & EPC',
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-semibold text-foreground">
                  {b.box_code}
                </span>
                <Badge
                  variant={b.box_level === 'MASTER' ? 'default' : 'secondary'}
                  className="text-[10px]"
                >
                  {b.box_level === 'MASTER' ? 'Master Carton' : 'Inner Box'}
                </Badge>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                {b.master_epc}
              </p>
              {b.parent_box_code && (
                <p className="text-[10px] text-muted-foreground">
                  Induk: <span className="font-mono">{b.parent_box_code}</span>
                </p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'product_name',
        header: 'Produk / SKU',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.product_name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {row.original.sku}
            </p>
          </div>
        ),
      },
      {
        id: 'qty_per_box',
        header: 'Hirarki Isi',
        accessorFn: (row) => Number(row.qty_per_box || 0),
        cell: ({ row }) => {
          const b = row.original;
          return b.box_level === 'MASTER' && Number(b.inner_box_count) > 0 ? (
            <div>
              <span className="font-semibold text-foreground">
                {b.inner_box_count} Inner Box × {b.qty_per_inner} Pcs
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Total {b.qty_per_box} unit
              </span>
            </div>
          ) : (
            <span className="font-semibold text-foreground">
              {b.qty_per_box} Pcs
            </span>
          );
        },
      },
      {
        id: 'location',
        header: 'Lokasi',
        accessorFn: (row) =>
          row.location_code ? `${row.location_code} - ${row.location_name}` : 'Staging (INB01)',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const st = row.original.status;
          const variant =
            st === 'IN_RACK'
              ? 'success'
              : st === 'SEALED'
              ? 'warning'
              : 'secondary';
          return <Badge variant={variant}>{st}</Badge>;
        },
      },
      {
        id: 'created_at',
        header: 'Tanggal Masuk',
        accessorFn: (row) => (row.created_at ? new Date(row.created_at).getTime() : 0),
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground whitespace-nowrap">
            {row.original.created_at
              ? new Date(row.original.created_at).toLocaleString('id-ID')
              : '-'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Aksi',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const b = row.original;
          const isMaster = b.box_level === 'MASTER';
          if (b.status !== 'SEALED' && b.status !== 'IN_RACK') {
            return (
              <span className="text-[11px] text-muted-foreground italic">
                Sudah Break-Pack
              </span>
            );
          }
          return (
            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => {
                  setPutawayBox(b);
                  if (racks.length > 0) setTargetRack(racks[0].code);
                }}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Putaway
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                disabled={unpackingId === b.id}
                onClick={() => handleUnpackBox(b)}
              >
                <PackageOpen className="h-3.5 w-3.5" />
                {unpackingId === b.id
                  ? 'Memecah...'
                  : isMaster
                  ? `Pecah → ${b.inner_box_count} Box`
                  : `Pecah → ${b.qty_per_box} Pcs`}
              </Button>
            </div>
          );
        },
      },
    ],
    [racks, unpackingId]
  );

  const previewTotalUnits =
    form.box_level === 'MASTER'
      ? Number(form.inner_box_count || 0) * Number(form.qty_per_inner || 0)
      : Number(form.qty_per_box || 0);

  return (
    <div className="space-y-6">
      {/* Header matching sidebar icon (Boxes) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
            <Boxes className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Master Box (Karton) & Break-Pack Multi-Level
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Dukungan kemasan bertingkat: <strong>Master Carton</strong> → <strong>Inner Box</strong> → <strong>Satuan (Pcs)</strong> dengan Break-Pack bertahap.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            <PackagePlus className="h-4 w-4" />
            Terima Box / Karton
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={fetchAll}
            title="Muat Ulang"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Master Carton Aktif</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.master_boxes || 0}</div>
            <p className="text-xs text-muted-foreground">Karton besar tersegel / di rak</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inner Box Aktif</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.inner_boxes || 0}</div>
            <p className="text-xs text-muted-foreground">Box kecil siap ecer / break-pack</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Unit Dalam Box</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.total_units_in_active_boxes || 0}
            </div>
            <p className="text-xs text-muted-foreground">Unit tersimpan dalam kemasan aktif</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sudah Break-Pack</CardTitle>
            <PackageOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.unpacked_boxes || 0}</div>
            <p className="text-xs text-muted-foreground">Karton / box yang telah dipecah</p>
          </CardContent>
        </Card>
      </div>

      {/* TanStack DataTable */}
      {loading ? (
        <div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
          Memuat data Master Box...
        </div>
      ) : (
        <DataTable
          data={boxes}
          columns={columns}
          searchPlaceholder="Cari kode box, EPC, SKU, produk..."
          dateField="created_at"
          initialSorting={[{ id: 'created_at', desc: true }]}
          filters={[
            {
              key: 'box_level',
              label: 'Level',
              options: [
                { value: 'MASTER', label: 'Master Carton' },
                { value: 'INNER', label: 'Inner Box' },
              ],
            },
            {
              key: 'status',
              label: 'Status',
              options: [
                { value: 'SEALED', label: 'Tersegel (Staging)' },
                { value: 'IN_RACK', label: 'Di Rak' },
                { value: 'UNPACKED', label: 'Sudah Break-Pack' },
              ],
            },
          ]}
          emptyMessage='Belum ada Box. Klik "Terima Box / Karton" untuk mendaftarkan Master Carton atau Inner Box.'
        />
      )}

      {/* ================= MODAL TERIMA BOX / KARTON BARU ================= */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border bg-card text-card-foreground p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">
                  Terima Box / Karton Baru
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pilih level kemasan: Karton Besar (berisi Inner Box) atau Inner Box langsung.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowCreateModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateBox} className="space-y-4">
              {/* Toggle Level Kemasan */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, box_level: 'MASTER' })}
                  className={`rounded-lg border p-3 text-left transition ${
                    form.box_level === 'MASTER'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs">
                    <Boxes className="h-4 w-4" />
                    Master Carton (Box Besar)
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Berisi beberapa Inner Box (mis. 25 Box × 10 Pcs)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, box_level: 'INNER' })}
                  className={`rounded-lg border p-3 text-left transition ${
                    form.box_level === 'INNER'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs">
                    <Box className="h-4 w-4" />
                    Inner Box (Box Kecil)
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Langsung berisi satuan Pcs (mis. 10 Pcs)
                  </p>
                </button>
              </div>

              <div className="space-y-1.5">
                <Label>Produk / SKU</Label>
                <select
                  required
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">-- Pilih Produk --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {form.box_level === 'MASTER' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Jumlah Inner Box</Label>
                      <Input
                        type="number"
                        min={1}
                        max={200}
                        required
                        value={form.inner_box_count}
                        onChange={(e) =>
                          setForm({ ...form, inner_box_count: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Isi per Inner Box (Pcs)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={500}
                        required
                        value={form.qty_per_inner}
                        onChange={(e) =>
                          setForm({ ...form, qty_per_inner: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Total isi karton:{' '}
                    <strong className="text-foreground">
                      {previewTotalUnits.toLocaleString('id-ID')} Pcs
                    </strong>{' '}
                    ({form.inner_box_count || 0} Inner Box × {form.qty_per_inner || 0} Pcs)
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Isi per Inner Box (Pcs)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    required
                    value={form.qty_per_box}
                    onChange={(e) => setForm({ ...form, qty_per_box: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Lokasi Awal</Label>
                  <select
                    value={form.location_code}
                    onChange={(e) => setForm({ ...form, location_code: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="INB01">Staging Inbound (INB01)</option>
                    {racks.map((r) => (
                      <option key={r.id} value={r.code}>
                        {r.code} — {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>EPC Tag (Opsional)</Label>
                  <Input
                    placeholder="Auto-generate 24 hex"
                    maxLength={24}
                    value={form.master_epc}
                    onChange={(e) =>
                      setForm({ ...form, master_epc: e.target.value.toUpperCase() })
                    }
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Catatan (Opsional)</Label>
                <Input
                  placeholder="Contoh: Batch supplier ATK gelombang 1"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Menyimpan...' : 'Simpan Box'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL PUTAWAY BOX ================= */}
      {putawayBox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          onClick={() => setPutawayBox(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-card text-card-foreground p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold">Putaway Box ke Rak</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pindahkan <strong className="font-mono">{putawayBox.box_code}</strong> ({putawayBox.qty_per_box} unit) ke rak tujuan.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setPutawayBox(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={handlePutawayBox} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Rak Tujuan</Label>
                <select
                  required
                  value={targetRack}
                  onChange={(e) => setTargetRack(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  {racks.map((r) => (
                    <option key={r.id} value={r.code}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPutawayBox(null)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={savingPutaway}>
                  {savingPutaway ? 'Memindahkan...' : 'Simpan Putaway'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL HASIL BREAK-PACK (INNER BOXES / EPC SATUAN) ================= */}
      {unpackedResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          onClick={() => setUnpackedResult(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border bg-card text-card-foreground p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <h3 className="text-base font-semibold">
                  {unpackedResult.unpack_mode === 'TO_INNER'
                    ? 'Break-Pack Tahap 1 Berhasil (Inner Boxes)'
                    : 'Break-Pack Satuan Berhasil (EPC Pcs)'}
                </h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setUnpackedResult(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              Box <strong className="font-mono text-foreground">{unpackedResult.box_code}</strong> ({unpackedResult.sku} — {unpackedResult.product_name}) berhasil dipecah menjadi{' '}
              <strong className="text-foreground">
                {unpackedResult.unpack_mode === 'TO_INNER'
                  ? `${unpackedResult.generated_boxes.length} Inner Box (@ ${unpackedResult.qty_per_inner} Pcs)`
                  : `${unpackedResult.generated_epcs.length} tag RFID satuan (${unpackedResult.target_status})`}
              </strong>
              .
            </p>

            <div className="max-h-64 overflow-y-auto rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs custom-scrollbar">
              {unpackedResult.unpack_mode === 'TO_INNER'
                ? unpackedResult.generated_boxes.map((child, idx) => (
                    <div
                      key={child.id || idx}
                      className="flex items-center justify-between rounded-md border bg-background px-2.5 py-1.5"
                    >
                      <div>
                        <span className="font-mono font-semibold">{child.box_code}</span>
                        <span className="block font-mono text-[10px] text-muted-foreground">
                          {child.master_epc}
                        </span>
                      </div>
                      <Badge variant="secondary">{child.qty_per_box} Pcs</Badge>
                    </div>
                  ))
                : unpackedResult.generated_epcs.map((epc, idx) => (
                    <div
                      key={epc}
                      className="flex items-center justify-between rounded-md border bg-background px-2.5 py-1 font-mono"
                    >
                      <span className="text-muted-foreground">#{idx + 1}</span>
                      <span>{epc}</span>
                    </div>
                  ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={() => setUnpackedResult(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
