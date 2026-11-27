import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ReturnPage({ showNotification }) {
  const [sales, setSales] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState('');
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [selectedEpc, setSelectedEpc] = useState('');
  const [reason, setReason] = useState('');
  const [inspectionResult, setInspectionResult] = useState('');
  const [notes, setNotes] = useState('');
  const [targetRack, setTargetRack] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);

      try {
        const [salesResponse, locationsResponse] = await Promise.all([
          apiRequest('/pos/sales'),
          apiRequest('/locations'),
        ]);

        setSales(Array.isArray(salesResponse.data) ? salesResponse.data : []);
        setLocations(
          Array.isArray(locationsResponse.data)
            ? locationsResponse.data.filter(
                location => location.location_type === 'RACK'
              )
            : []
        );
      } catch (error) {
        console.error('Gagal memuat data retur:', error);
        showNotification?.(error.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const handleSelectInvoice = async (invoiceNo) => {
  setSelectedInvoice(invoiceNo);
  setInvoiceItems([]);
  setSelectedEpc('');
  setDetailLoading(true);

  try {
    const response = await apiRequest(
      `/pos/sales/${encodeURIComponent(invoiceNo)}/items`
    );

    setInvoiceItems(
      Array.isArray(response.data?.items)
        ? response.data.items
        : []
    );
  } catch (error) {
    console.error('Gagal mengambil detail invoice:', error);
    showNotification?.(error.message, 'error');
  } finally {
    setDetailLoading(false);
  }
};

const handleProcessReturn = async () => {
  if (!selectedInvoice || !selectedEpc || !reason || !inspectionResult) {
    showNotification?.(
      'Lengkapi invoice, EPC, alasan, dan hasil pemeriksaan.',
      'error'
    );
    return;
  }

  if (inspectionResult === 'GOOD' && !targetRack) {
    showNotification?.(
      'Pilih rak tujuan untuk barang dengan kondisi GOOD.',
      'error'
    );
    return;
  }

  setReturnSubmitting(true);

  try {
    const response = await apiRequest('/pos/return', {
      method: 'POST',
      body: JSON.stringify({
        invoice_no: selectedInvoice,
        epc: selectedEpc,
        reason: reason,
        target_rack: inspectionResult === 'GOOD' ? targetRack : null,
        inspection_result: inspectionResult,
        notes: notes || null,
      }),
    });

    showNotification?.(
      response.message || 'Retur berhasil diproses.',
      'success'
    );

    setSelectedEpc('');
    setReason('');
    setTargetRack('');
    setInspectionResult('');
    setNotes('');

    await handleSelectInvoice(selectedInvoice);
  } catch (error) {
    console.error('Gagal memproses retur:', error);
    showNotification?.(
      error.message || 'Retur gagal diproses.',
      'error'
    );
  } finally {
    setReturnSubmitting(false);
  }
};

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
          <RotateCcw className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Retur POS</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pengembalian barang berdasarkan invoice dan EPC RFID.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Riwayat Transaksi POS
          </h2>
          <p className="text-xs text-muted-foreground">
            Pilih invoice untuk memproses pengembalian barang (urutkan & filter berdasarkan tanggal).
          </p>
        </div>

        {loading ? (
          <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
            Memuat transaksi...
          </div>
        ) : (
          <DataTable
            data={sales}
            columns={[
              {
                accessorKey: 'invoice_no',
                header: 'Invoice',
                cell: ({ row }) => (
                  <span className="font-mono font-semibold">
                    {row.original.invoice_no}
                  </span>
                ),
              },
              {
                id: 'customer_name',
                header: 'Pelanggan',
                accessorFn: (row) => row.customer_name || 'Pelanggan Umum',
              },
              {
                accessorKey: 'total_items',
                header: 'Jumlah',
                cell: ({ row }) => `${row.original.total_items} unit`,
              },
              {
                id: 'total_amount',
                header: 'Total',
                accessorFn: (row) => Number(row.total_amount || 0),
                cell: ({ row }) => (
                  <span className="font-semibold">
                    Rp {Number(row.original.total_amount).toLocaleString('id-ID')}
                  </span>
                ),
              },
              {
                accessorKey: 'payment_status',
                header: 'Status',
                cell: ({ row }) => (
                  <Badge
                    variant={
                      row.original.payment_status === 'PAID'
                        ? 'success'
                        : 'warning'
                    }
                  >
                    {row.original.payment_status}
                  </Badge>
                ),
              },
              {
                id: 'created_at',
                header: 'Tanggal',
                accessorFn: (row) =>
                  row.created_at ? new Date(row.created_at).getTime() : 0,
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
                  const inv = row.original.invoice_no;
                  const active = selectedInvoice === inv;
                  return (
                    <Button
                      type="button"
                      size="sm"
                      variant={active ? 'default' : 'outline'}
                      className="h-7 px-2.5 text-xs"
                      onClick={() => handleSelectInvoice(inv)}
                    >
                      {active ? 'Dipilih' : 'Pilih'}
                    </Button>
                  );
                },
              },
            ]}
            searchPlaceholder="Cari invoice atau pelanggan..."
            dateField="created_at"
            initialSorting={[{ id: 'created_at', desc: true }]}
            filters={[
              {
                key: 'payment_status',
                label: 'Status',
                options: [
                  ...new Set(sales.map((s) => s.payment_status).filter(Boolean)),
                ].map((v) => ({ value: v, label: v })),
              },
            ]}
            emptyMessage="Belum ada transaksi POS."
          />
        )}
      </div>

{selectedInvoice && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Detail Invoice</h2>
          <p className="text-sm text-gray-500">{selectedInvoice}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedInvoice('');
            setInvoiceItems([]);
            setSelectedEpc('');
          }}
          className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100"
        >
          ✕
        </button>
      </div>

      <div className="mt-5">
  {detailLoading ? (
    <p>Memuat detail barang dan EPC...</p>
  ) : invoiceItems.length === 0 ? (
    <p className="text-gray-500">
      Tidak ada detail barang pada invoice ini.
    </p>
  ) : (
    <div className="space-y-3">
      {invoiceItems.map((item) => (
        <label
          key={item.tag_id}
          className={`block rounded-lg border p-4 ${
            item.already_returned
              ? 'cursor-not-allowed bg-gray-100 opacity-60'
              : selectedEpc === item.epc
                ? 'border-blue-500 bg-blue-50'
                : 'cursor-pointer hover:border-blue-300'
          }`}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="selectedEpc"
              value={item.epc}
              checked={selectedEpc === item.epc}
              disabled={item.already_returned}
              onChange={() => setSelectedEpc(item.epc)}
              className="mt-1"
            />

            <div>
              <p className="font-semibold">SKU: {item.sku}</p>
              <p className="text-sm text-gray-600">EPC: {item.epc}</p>
              <p className="text-sm text-gray-600">
                Status RFID: {item.tag_status}
              </p>
              <p className="mt-1 text-sm font-medium">
                {item.already_returned ? 'Sudah diretur' : 'Belum diretur'}
              </p>
            </div>
          </div>
        </label>
      ))}
    </div>
  )}

  {/* Dropdown alasan retur */}
  <div className="mt-5">
    <label className="mb-2 block font-semibold">
      Alasan Retur
    </label>

    <select
      value={reason}
      onChange={(e) => setReason(e.target.value)}
      className="w-full rounded-lg border border-gray-300 p-3"
    >
      <option value="">Pilih alasan retur</option>
      <option value="Barang rusak">Barang rusak</option>
      <option value="Barang tidak sesuai">Barang tidak sesuai</option>
      <option value="Salah pengiriman">Salah pengiriman</option>
      <option value="Lainnya">Lainnya</option>
    </select>
  </div>

  {/* Dropdown hasil pemeriksaan */}
<div className="mt-5">
  <label className="mb-2 block font-semibold">
    Hasil Pemeriksaan Barang
  </label>

  <select
    value={inspectionResult}
    onChange={(e) => {
      setInspectionResult(e.target.value);
      setTargetRack('');
    }}
    className="w-full rounded-lg border border-gray-300 p-3"
  >
    <option value="">Pilih hasil pemeriksaan</option>
    <option value="GOOD">GOOD - Barang layak dijual kembali</option>
    <option value="DAMAGED">DAMAGED - Barang rusak</option>
    <option value="NEEDS_INSPECTION">
      NEEDS INSPECTION - Perlu pemeriksaan lanjutan
    </option>
  </select>
</div>

  {inspectionResult === 'GOOD' && (
  <div className="mt-5">
    <label className="mb-2 block font-semibold">
      Rak Tujuan Pengembalian
    </label>

  <select
    value={targetRack}
    onChange={(e) => setTargetRack(e.target.value)}
    className="w-full rounded-lg border border-gray-300 p-3"
  >
    <option value="">Pilih rak tujuan</option>

    {locations.map((location) => (
     <option key={location.id} value={location.code}>
    {location.code} - {location.name}
    </option>
))}
  </select>
  </div>
)}

{/* Catatan Pemeriksaan */}
<div className="mt-5">
  <label className="mb-2 block font-semibold">
    Catatan Pemeriksaan (Opsional)
  </label>
  <textarea
    value={notes}
    onChange={(e) => setNotes(e.target.value)}
    placeholder="Tambahkan catatan kondisi barang..."
    rows={3}
    className="w-full rounded-lg border border-gray-300 p-3"
  />
</div>

    <div className="mt-6 flex justify-end">
  <button
    type="button"
    disabled={
  !selectedEpc ||
  !reason ||
  !inspectionResult ||
  (inspectionResult === 'GOOD' && !targetRack) ||
  returnSubmitting
}
    onClick={handleProcessReturn}
    className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
  >
    {returnSubmitting ? 'Memproses Retur...' : 'Proses Retur'}
  </button>
</div>

</div>
    </div>
  </div>
)}    
  </div>
)}

