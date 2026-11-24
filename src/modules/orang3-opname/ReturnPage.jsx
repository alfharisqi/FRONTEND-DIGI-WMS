import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';

export default function ReturnPage({ showNotification }) {
  const [sales, setSales] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState('');
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [selectedEpc, setSelectedEpc] = useState('');
  const [reason, setReason] = useState('');
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
  if (!selectedInvoice || !selectedEpc || !reason || !targetRack) {
    showNotification?.(
      'Lengkapi invoice, EPC, alasan, dan rak tujuan.',
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
        target_rack: targetRack,
      }),
    });

    showNotification?.(
      response.message || 'Retur berhasil diproses.',
      'success'
    );

    setSelectedEpc('');
    setReason('');
    setTargetRack('');

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
    <div className="p-6">
      <h1 className="text-2xl font-bold">Retur POS</h1>
      <p className="mt-1 text-gray-500">
        Pengembalian barang berdasarkan invoice dan EPC RFID.
      </p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
  <h2 className="text-lg font-semibold mb-4">
    Riwayat Transaksi POS
  </h2>

  {loading ? (
    <p>Memuat transaksi...</p>
  ) : sales.length === 0 ? (
    <p className="text-gray-500">Belum ada transaksi POS.</p>
  ) : (
    <div className="space-y-3">
      {sales.map((sale) => (
  <button
    key={sale.id}
    type="button"
    onClick={() => handleSelectInvoice(sale.invoice_no)}
    className={`w-full text-left rounded-lg border p-4 transition ${
      selectedInvoice === sale.invoice_no
        ? 'border-blue-500 bg-blue-50'
        : 'border-gray-200 hover:border-blue-300'
    }`}
  >
    <p className="font-semibold text-gray-800">
      Invoice: {sale.invoice_no}
    </p>

    <p className="text-sm text-gray-500">
      Pelanggan: {sale.customer_name || '-'}
    </p>

    <p className="text-sm text-gray-500">
      Jumlah barang: {sale.total_items}
    </p>

    <p className="text-sm text-gray-500">
      Total: Rp {Number(sale.total_amount).toLocaleString('id-ID')}
    </p>

    <p className="text-sm text-gray-500">
      Status pembayaran: {sale.payment_status}
    </p>

    <p className="text-sm text-gray-500">
      Tanggal: {new Date(sale.created_at).toLocaleString('id-ID')}
    </p>
  </button>
))}
    </div>
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

    <div className="mt-6 flex justify-end">
  <button
    type="button"
    disabled={!selectedEpc || !reason || !targetRack || returnSubmitting}
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

