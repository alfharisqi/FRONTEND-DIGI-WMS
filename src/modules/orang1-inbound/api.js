import { API_BASE_URL } from '../../config/api';
import { tokenStorageKey } from '../../config/authSession';

export async function inboundRequest(path, method = 'GET', payload) {
  const token = globalThis.localStorage?.getItem(tokenStorageKey);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  let json;
  try { json = await response.json(); }
  catch { throw new Error(`Respons API tidak valid (HTTP ${response.status}).`); }
  if (!response.ok || json.success !== true) throw new Error(json.message || `Operasi gagal (HTTP ${response.status}).`);
  return json.data;
}
export const productForm = (row = {}) => ({
  sku: row.sku ?? '', name: row.name ?? '', category: row.category ?? '',
  price: row.price ?? row.unit_price ?? row.price_idr ?? 0,
  min_stock_alert: row.min_stock_alert ?? row.min_stock_threshold ?? row.min_stock ?? 20,
  ...('default_location_code' in row ? { default_location_code: row.default_location_code ?? '' } : {}),
});
export function newEpc() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function newSku(category = '', name = '') {
  const source = String(category || name || 'SKU').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const prefix = (source.slice(0, 3) || 'SKU').padEnd(3, 'X');
  const randomDigits = String(1000 + (crypto.getRandomValues(new Uint16Array(1))[0] % 9000));
  return `SKU-${prefix}-${randomDigits}`;
}
// Keep identity opaque; resolve a select's value to the original API ID.
export function selectedProductId(products, value) {
  const product = products.find(row => String(row.id) === String(value));
  if (!product) throw new Error('Pilih produk dari data API yang tersedia.');
  return product.id;
}

export function receivedLines(products, rows) {
  if (!rows.length) throw new Error('Tambahkan minimal satu baris SKU.');
  const lines = rows.map(row => {
    const received_qty = Number(row.received_qty);
    if (!Number.isInteger(received_qty) || received_qty < 1 || received_qty > 2147483647) {
      throw new Error('Jumlah diterima harus bilangan bulat positif.');
    }
    return { product_id: selectedProductId(products, row.product_id), received_qty };
  });
  if (new Set(lines.map(line => String(line.product_id))).size !== lines.length) throw new Error('SKU tidak boleh duplikat.');
  return lines;
}

const tagTypes = {
  STANDARD_LABEL: 'STANDARD_LABEL', ON_METAL: 'ON_METAL', HARD_TAG: 'HARD_TAG',
  'Label Biasa (UHF)': 'STANDARD_LABEL', 'On-Metal (Logam/Cairan)': 'ON_METAL', 'Hard Tag (Aset)': 'HARD_TAG',
};
export function normalizeTag(row) {
  const raw = row.type ?? row.tag_type;
  return { ...row, type: Object.hasOwn(tagTypes, raw) ? tagTypes[raw] : null,
    type_label: raw || 'Belum tercatat (legacy)' };
}
export const tagTypeDetailField = row => row?.type ? 'type' : 'type_label';
