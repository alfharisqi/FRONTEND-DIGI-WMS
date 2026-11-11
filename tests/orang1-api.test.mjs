import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({ entryPoints: ['src/modules/orang1-inbound/api.js'], bundle: true, write: false, format: 'esm', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('http://test.local/api') } });
const api = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
test('UUID from API select is retained without numeric conversion', async () => {
  const uuid = '18b635db-0ec3-41b1-a1ec-e15da1438ce2';
  const product_id = api.selectedProductId([{ id: uuid }], uuid);
  globalThis.fetch = async (url, options) => { assert.equal(url, 'http://test.local/api/tags/encode'); assert.equal(JSON.parse(options.body).product_id, uuid); return Response.json({ success: true, data: { product_id } }, { status: 201 }); };
  assert.equal((await api.inboundRequest('/tags/encode', 'POST', { product_id })).product_id, uuid);
});
test('Integer identity is also preserved in request payload', () => { assert.equal(api.selectedProductId([{ id: 7 }], '7'), 7); });
test('Unverified product cannot be silently substituted', () => { assert.throws(() => api.selectedProductId([{ id: 7 }], 'other'), /Pilih produk/); });
test('HTTP conflict message reaches UI', async () => {
  globalThis.fetch = async () => Response.json({ success: false, message: 'EPC sudah terdaftar' }, { status: 409 });
  await assert.rejects(api.inboundRequest('/tags/encode', 'POST', {}), /EPC sudah terdaftar/);
});
test('success:false on HTTP 200 never becomes success', async () => {
  globalThis.fetch = async () => Response.json({ success: false, message: 'Tidak tersimpan' });
  await assert.rejects(api.inboundRequest('/products', 'POST', {}), /Tidak tersimpan/);
});
test('Invalid JSON and network failures are exposed', async () => {
  globalThis.fetch = async () => new Response('<html>Error</html>', { status: 502 });
  await assert.rejects(api.inboundRequest('/products'), /Respons API tidak valid/);
  globalThis.fetch = async () => { throw new Error('Network offline'); };
  await assert.rejects(api.inboundRequest('/products'), /Network offline/);
});
test('Form supports both product naming contracts, including zero minimum', () => {
  assert.deepEqual(api.productForm({ sku: 'X', name: 'Y', category: 'Z', unit_price: '99.00', min_stock_threshold: 0 }), { sku: 'X', name: 'Y', category: 'Z', price: '99.00', min_stock_alert: 0 });
});
test('Simulated EPC generator yields 96 bits as 24 uppercase hex characters', () => {
  const values = new Set(Array.from({ length: 100 }, () => api.newEpc()));
  assert.equal(values.size, 100); for (const value of values) assert.match(value, /^[0-9A-F]{24}$/);
});
test('Supabase tag_type labels are mapped without changing a legacy EPC', () => {
  const row = api.normalizeTag({ id: 'tag-qa', epc: 'E280-1160-2000-012A', tag_type: 'On-Metal (Logam/Cairan)' });
  assert.equal(row.type, 'ON_METAL'); assert.equal(row.epc, 'E280-1160-2000-012A');
});
test('Missing or unrecognized legacy tag type gets an informative label, never a guessed type', () => {
  assert.equal(api.normalizeTag({ tag_type: null }).type_label, 'Belum tercatat (legacy)');
  assert.equal(api.normalizeTag({ tag_type: null }).type, null);
  assert.equal(api.normalizeTag({ tag_type: 'Custom legacy' }).type_label, 'Custom legacy');
  assert.equal(api.normalizeTag({ type: '__proto__' }).type, null);
});
test('Tag detail metadata is safe for new registration forms without an existing row', () => {
  assert.equal(api.tagTypeDetailField(undefined), 'type_label');
  assert.equal(api.tagTypeDetailField({ type: 'ON_METAL' }), 'type');
  assert.equal(api.tagTypeDetailField({ type: null }), 'type_label');
});
