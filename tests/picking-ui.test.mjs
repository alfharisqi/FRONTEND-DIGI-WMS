import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

test('Picking, Packing, cancellation and Outbound sources work through the UI with mocked APIs', {
  skip: !process.env.PLAYWRIGHT_MODULE || !process.env.PICKING_TEST_CHROME,
  timeout: 45_000,
}, async () => {
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
  const dist = path.resolve('dist');
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
      const file = path.resolve(dist, pathname === '/' ? 'index.html' : `.${pathname}`);
      assert.ok(file.startsWith(dist + path.sep));
      const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
      const content = await readFile(file);
      response.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream');
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  let browser;
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ executablePath: process.env.PICKING_TEST_CHROME, headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    await context.routeWebSocket(/.*/, socket => socket.close());
    const monitor = { id: '18b635db-0ec3-41b1-a1ec-e15da1438ce2', sku: 'MON-1', name: 'Monitor' };
    const other = { id: '07ef2112-9dba-4b41-a627-c17c0ebbc18a', sku: 'MON-2', name: 'Monitor Lain' };
    const orderId = '95a22d68-d0fe-4ee7-a83d-f32895f89810';
    const cancellationId = 'c390e19c-f8ea-4d34-90b6b1d673de';
    const cancellationNumber = 'ORD-UI-CANCEL';
    const partialId = 'cf8da67c-b48a-49d1-97ba-e8fa9582a41f';
    const partialNumber = 'ORD-UI-PARTIAL';
    const partialScanId = '762c4648-b76c-4d95-b793-13d248919237';
    const makeEpc = index => String(index).padStart(24, '0');
    const saleId = '4401793d-0779-4dfa-9ad7-22f4d1d98efc';
    const outboundId = '5ad5142b-f70c-4826-afc0-8932ab6335ce';
    const shipmentCalls = [];
    let stock = [1, 2, 3].map(makeEpc);
    const scans = [];
    const attempts = [];
    let packingStatus = 'MENUNGGU_PACKING';
    let revision = 0;
    let checklist = Object.fromEntries(['quantity', 'epc', 'condition', 'packaging', 'label'].map(key => [key + '_checked', false]));
    const snapshot = (includeCandidates = false) => {
      const remaining = 5 - scans.length;
      const line = {
        product_id: monitor.id, sku: monitor.sku, product_name: monitor.name, requested_qty: 5,
        picked_qty: scans.length, remaining_qty: remaining, available_qty: stock.length,
        shortage_qty: Math.max(0, remaining - stock.length), scans,
        locations: stock.length ? [{ id: 'rack', code: 'B1', name: 'Rak Monitor', available_qty: stock.length }] : [],
      };
      if (includeCandidates) line.candidates = stock.slice(0, remaining).map(epc => ({
        epc, tag_status: 'IN_STOCK', item_status: 'IN_STOCK', location_code: 'B1', location_name: 'Rak Monitor',
      }));
      return {
        id: orderId, order_number: 'ORD-UI-TEST', requested_qty: 5, picked_qty: scans.length,
        status: packingStatus === 'SELESAI_PACKING' ? 'DIKIRIM'
          : remaining === 0 ? 'SIAP_PACKING' : scans.length ? 'SEDANG_DIAMBIL' : 'MENUNGGU_PICKING',
        shipping_stage: packingStatus === 'SELESAI_PACKING' ? 'AUTHORIZED_OUT' : null,
        packing_status: packingStatus, lines: [line],
      };
    };
    const packing = () => ({ order: snapshot(), status: packingStatus, revision, checklist, picking_complete: scans.length === 5 });
    let showCancellationOrder = false;
    let canCancel = false;
    let audit = null;
    let cancellations = 0;
    const cancellationOrder = () => ({
      id: cancellationId, order_number: cancellationNumber, status: audit ? 'DIBATALKAN' : 'MENUNGGU_PICKING',
      can_cancel: canCancel && !audit, cancellation: audit, requested_qty: 1, picked_qty: 0,
      lines: [{ product_id: other.id, sku: other.sku, product_name: other.name, requested_qty: 1, picked_qty: 0, scans: [], locations: [] }],
    });
    let partialAudit = null;
    const partialScan = { id: partialScanId, epc: makeEpc(15), location_code: 'C2', location_name: 'Rak Uji C2' };
    const partialOrder = () => ({
      id: partialId, order_number: partialNumber, status: partialAudit ? 'DIBATALKAN' : 'SEDANG_DIAMBIL',
      can_cancel: canCancel && !partialAudit, cancellation: partialAudit, requested_qty: 3, picked_qty: partialAudit ? 0 : 1,
      lines: [{ product_id: other.id, sku: other.sku, product_name: other.name, requested_qty: 3,
        picked_qty: partialAudit ? 0 : 1, scans: [{ ...partialScan, active: !partialAudit }], locations: [] }],
    });
    let creates = 0;
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith('/api/')) return url.origin === origin ? route.continue() : route.abort();
      const method = route.request().method();
      const send = (data, status = 200, fields = {}) => route.fulfill({
        status, json: { success: status < 400, data, ...fields }, headers: {
          'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PATCH',
        },
      });
      if (method === 'OPTIONS') return send(null);
      if (url.pathname === '/api/auth/login') return send({ user: { role: 'ADMIN', username: 'tester', full_name: 'Test' }, token: 'ui-test-token' });
      if (url.pathname === '/api/products') return send([monitor, other]);
      if (url.pathname === '/api/locations' || url.pathname === '/api/inventory/ledger') return send([]);
      if (url.pathname === '/api/tags') return send([{ epc: makeEpc(13), status: 'IN_STOCK' }]);
      if (url.pathname === '/api/outbound/picking-orders') {
        assert.equal(url.searchParams.get('for_handoff'), '1');
        return send([
          { id: orderId, source_type: 'PICKING_ORANG1', status: 'DIKIRIM', order_number: 'ORD-SIAP', items: [{ epc: makeEpc(10) }] },
          { id: cancellationId, source_type: 'PICKING_ORANG1', status: 'DIBATALKAN', order_number: 'ORD-BATAL', items: [{ epc: makeEpc(11) }] },
          { id: outboundId, source_type: 'OUTBOUND_PICKING', status: 'SIAP_PACKING', order_number: 'ORD-OUTBOUND', items: [{ epc: makeEpc(12) }] },
        ]);
      }
      if (url.pathname === '/api/outbound/pos-orders') {
        assert.equal(route.request().headers().authorization, 'Bearer ui-test-token');
        return send([{ id: saleId, invoice_or_resi: 'POS-123', epcs: [makeEpc(14)] }]);
      }
      if (url.pathname === '/api/outbound/shipments') {
        if (method === 'GET') return send([]);
        const body = route.request().postDataJSON();
        shipmentCalls.push(body);
        if (body.source.type === 'PICKING_ORANG1') {
          return send(null, 409, { message: 'Order sumber sudah berubah.', code: 'SHIPMENT_SOURCE_CONFLICT' });
        }
        return send({});
      }
      if (url.pathname === '/api/picking/availability') {
        const productId = url.searchParams.get('product_id');
        return send({ product_id: productId, available_qty: productId === monitor.id ? stock.length : 0 });
      }
      if (url.pathname === '/api/picking/orders') {
        if (method === 'GET') return send(showCancellationOrder ? [snapshot(), cancellationOrder(), partialOrder()] : [snapshot()]);
        creates++;
        stock.pop();
        return send(null, 409, { message: 'Stok berubah sejak terakhir diperiksa.' });
      }
      if (url.pathname.endsWith('/available-epcs')) return send({ order_id: orderId, lines: snapshot(true).lines });
      if (url.pathname.endsWith(`/${cancellationId}/cancel`)) {
        cancellations++;
        const body = route.request().postDataJSON();
        assert.deepEqual(body, { reason: 'LAINNYA', notes: 'Order ganda' });
        audit = { ...body, actor_name: 'Petugas Uji', cancelled_at: '2026-11-25T10:00:00Z' };
        return send({ id: cancellationId, status: 'DIBATALKAN', can_cancel: false, cancellation: audit });
      }
      if (url.pathname.endsWith(`/${partialId}/cancel`)) {
        const body = route.request().postDataJSON();
        assert.deepEqual(body, { reason: 'STOK_TIDAK_MENCUKUPI', notes: '', physical_return_confirmed: true,
          return_scan_ids: [partialScanId] });
        partialAudit = { ...body, actor_name: 'Petugas Uji', cancelled_at: '2026-11-25T10:00:00Z',
          released_units: [{ ...partialScan, scan_id: partialScanId }] };
        return send({ id: partialId, status: 'DIBATALKAN', can_cancel: false, cancellation: partialAudit });
      }
      if (url.pathname === '/api/picking/scan') {
        const { epc } = route.request().postDataJSON();
        attempts.push(epc);
        if (!stock.includes(epc) || epc === makeEpc(2)) {
          stock = stock.filter(unit => unit !== epc);
          return send(null, 409, { code: 'PICKING_SCAN_REJECTED', message: 'EPC sudah direservasi pengguna lain.' });
        }
        stock = stock.filter(unit => unit !== epc);
        scans.push({ id: epc, epc, active: true, location_code: 'B1', location_name: 'Rak Monitor' });
        if (epc === makeEpc(5)) return send({ order: snapshot() });
        return send({ order: snapshot(), scan: { order_id: orderId, epc } });
      }
      if (url.pathname.endsWith('/packing-checklist')) {
        const body = route.request().postDataJSON();
        assert.equal(body.revision, 0);
        checklist = body.checklist;
        revision++;
        return send(packing());
      }
      if (url.pathname.endsWith('/packing-complete')) {
        assert.equal(route.request().postDataJSON().revision, 1);
        assert.ok(Object.values(checklist).every(Boolean));
        packingStatus = 'SELESAI_PACKING';
        return send(packing());
      }
      if (url.pathname.endsWith(`/${cancellationId}/packing`)) {
        return send({ order: cancellationOrder(), status: 'MENUNGGU_PACKING', revision: 0, checklist, picking_complete: false });
      }
      if (url.pathname.endsWith(`/${partialId}/packing`)) {
        return send({ order: partialOrder(), status: 'MENUNGGU_PACKING', revision: 0, checklist, picking_complete: false });
      }
      if (url.pathname.endsWith('/packing')) return send(packing());
      return send(null);
    });

    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(6000);
    await page.goto(origin);
    await page.getByLabel('Username', { exact: true }).fill('tester');
    await page.getByLabel('Password', { exact: true }).fill('fixture-password');
    await page.getByRole('button', { name: /Masuk ke Sistem/ }).click();
    const navigate = () => page.getByRole('button', { name: 'Picking & Packing', exact: true }).click();
    await navigate();
    for (const name of ['Menunggu Picking', 'Sedang Diambil', 'Siap Packing', 'Dikirim / Kurir']) {
      await page.getByRole('region', { name, exact: true }).waitFor();
    }
    await page.getByRole('button', { name: 'Buat Pesanan Picking' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText(/Stok tersedia untuk Picking · 3 unit/).waitFor();
    await dialog.getByLabel('Jumlah Unit Diminta').fill('5');
    const save = dialog.getByRole('button', { name: 'Simpan Pesanan' });
    assert.ok(await save.isDisabled());
    await dialog.getByLabel('Pilih Barang / SKU').selectOption(other.id);
    await dialog.getByText(/Stok tersedia untuk Picking · 0 unit/).waitFor();
    assert.ok(await save.isDisabled());
    await dialog.getByLabel('Pilih Barang / SKU').selectOption(monitor.id);
    await dialog.getByRole('button', { name: 'Gunakan jumlah tersedia (3 unit)' }).click();
    await save.click();
    await dialog.getByText('Stok berubah sejak terakhir diperiksa.').waitFor();
    await dialog.getByText(/Stok tersedia untuk Picking · 2 unit/).waitFor();
    assert.ok(await save.isDisabled());
    assert.equal(creates, 1);
    await dialog.getByRole('button', { name: 'Batal' }).click();

    stock.push(makeEpc(3));
    await page.getByRole('button', { name: 'Mulai Picking' }).click();
    await dialog.getByText(/3 EPC ditampilkan/).waitFor();
    assert.equal(await dialog.getByRole('textbox').count(), 0);
    const checkboxes = dialog.getByRole('checkbox');
    await checkboxes.first().focus();
    await page.keyboard.press('Space');
    assert.ok(await checkboxes.first().isChecked());
    await dialog.getByRole('button', { name: 'Pilih Semua' }).click();
    await dialog.getByText('3 EPC dipilih', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Bersihkan' }).click();
    assert.equal(attempts.length, 0);
    await dialog.getByRole('button', { name: 'Pilih Semua' }).click();
    await dialog.getByRole('button', { name: 'Validasi Scan (3 EPC)' }).click();
    await dialog.getByText('2 berhasil · 1 ditolak.', { exact: true }).waitFor();
    await dialog.getByText(/Belum ada EPC yang memenuhi syarat/).waitFor();
    assert.deepEqual(attempts, [1, 2, 3].map(makeEpc));
    await dialog.getByRole('button', { name: 'Tutup' }).click();
    await page.getByRole('article', { name: 'ORD-UI-TEST' }).getByText('Kekurangan stok · 3 unit').waitFor();

    await page.reload();
    await navigate();
    stock = [4, 5, 6, 7].map(makeEpc);
    await page.getByRole('button', { name: 'Lanjut Picking' }).click();
    await dialog.getByText(/Stok tersedia 4 unit · 3 EPC ditampilkan/).waitFor();
    assert.equal(await dialog.getByRole('textbox').count(), 0);
    await dialog.getByRole('checkbox', { name: new RegExp(makeEpc(4)) }).check();
    await dialog.getByRole('button', { name: 'Validasi Scan (1 EPC)' }).click();
    await dialog.getByText('1 berhasil · 0 ditolak.', { exact: true }).waitFor();
    await dialog.getByText(/Stok tersedia 3 unit · 2 EPC ditampilkan/).waitFor();
    await dialog.getByRole('button', { name: 'Pilih Semua' }).click();
    await dialog.getByRole('button', { name: 'Validasi Scan (2 EPC)' }).click();
    await dialog.getByText(/Respons validasi EPC tidak lengkap/).waitFor();
    await dialog.getByText('4/5', { exact: true }).waitFor();
    assert.deepEqual(attempts, [1, 2, 3, 4, 5].map(makeEpc));
    await dialog.getByRole('button', { name: 'Pilih Semua' }).click();
    await dialog.getByRole('button', { name: 'Validasi Scan (1 EPC)' }).click();
    await dialog.getByText('5/5', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Tutup' }).click();
    await page.getByRole('button', { name: 'Checklist Packing' }).click();
    await dialog.getByRole('checkbox').first().waitFor();
    for (const box of await dialog.getByRole('checkbox').all()) await box.check();
    await dialog.getByRole('button', { name: 'Simpan Checklist' }).click();
    await dialog.getByRole('button', { name: 'Selesai Packing', exact: true }).click();
    await dialog.getByRole('button', { name: 'Konfirmasi Selesai Packing' }).click();
    await dialog.getByText('Packing selesai. Paket siap diserahterimakan.', { exact: true }).waitFor();
    await page.setViewportSize({ width: 820, height: 900 });
    assert.ok(await dialog.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && element.scrollWidth <= element.clientWidth;
    }));
    await dialog.getByRole('button', { name: 'Tutup' }).click();
    const shipped = page.getByRole('region', { name: 'Dikirim / Kurir' }).getByRole('article', { name: 'ORD-UI-TEST' });
    await shipped.getByText('Diserahkan ke Kurir', { exact: true }).waitFor();
    assert.equal(await shipped.getByRole('button', { name: /Picking|Packing/ }).count(), 0);

    showCancellationOrder = true;
    const reload = page.getByRole('button', { name: 'Muat Ulang', exact: true });
    await reload.click();
    const waiting = page.getByRole('region', { name: 'Menunggu Picking', exact: true }).getByRole('article', { name: cancellationNumber });
    const partial = page.getByRole('region', { name: 'Sedang Diambil', exact: true }).getByRole('article', { name: partialNumber });
    await waiting.waitFor();
    assert.equal(await waiting.getByRole('button', { name: 'Batalkan Pesanan' }).count(), 0);
    assert.equal(await partial.getByRole('button', { name: 'Batalkan Pesanan' }).count(), 0);
    canCancel = true;
    await reload.click();
    await waiting.getByRole('button', { name: 'Batalkan Pesanan' }).click();
    await dialog.getByText('Konfirmasi Pembatalan Picking', { exact: true }).waitFor();
    assert.equal(await dialog.getByRole('checkbox').count(), 0);
    const confirm = dialog.getByRole('button', { name: 'Konfirmasi Pembatalan' });
    assert.ok(await confirm.isDisabled());
    await dialog.getByLabel('Alasan pembatalan').selectOption('LAINNYA');
    assert.ok(await confirm.isDisabled());
    await dialog.getByLabel('Keterangan tambahan').fill(' Order ganda ');
    assert.ok(await confirm.isEnabled());
    await dialog.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });

    const history = page.getByRole('region', { name: 'Riwayat pesanan dibatalkan' });
    const cancelled = history.getByRole('article', { name: cancellationNumber });
    await cancelled.getByText('Petugas Uji', { exact: true }).waitFor();
    assert.equal(cancellations, 1);
    assert.equal(await cancelled.getByRole('button').count(), 1);
    await cancelled.getByRole('button', { name: 'Detail' }).click();
    await dialog.getByText('Order ganda', { exact: true }).waitFor();
    assert.equal(await dialog.getByRole('button', { name: /Packing|Picking/ }).count(), 0);
    await dialog.getByRole('button', { name: 'Tutup' }).click();

    await page.getByRole('combobox', { name: 'Filter status picking' }).selectOption('');
    await partial.getByRole('button', { name: 'Batalkan Pesanan' }).click();
    await dialog.getByText(partialScan.epc, { exact: true }).waitFor();
    await dialog.getByText('C2 · Rak Uji C2', { exact: true }).waitFor();
    await dialog.getByLabel('Alasan pembatalan').selectOption('STOK_TIDAK_MENCUKUPI');
    assert.ok(await confirm.isDisabled());
    await dialog.getByRole('checkbox', { name: /mengembalikan seluruh barang/ }).check();
    await confirm.click();
    const partialHistory = history.getByRole('article', { name: partialNumber });
    await partialHistory.getByText(partialScan.epc, { exact: true }).waitFor();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    await navigate();
    await shipped.getByText('Diserahkan ke Kurir', { exact: true }).waitFor();
    assert.equal(await waiting.count(), 0);
    await page.getByRole('combobox', { name: 'Filter status picking' }).selectOption('DIBATALKAN');
    await cancelled.getByText('Order ganda', { exact: true }).waitFor();
    await partialHistory.getByText(partialScan.epc, { exact: true }).waitFor();
    await partialHistory.getByRole('button', { name: 'Detail' }).click();
    const releasedScan = dialog.getByRole('list', { name: 'Rincian barang dan EPC' });
    await releasedScan.getByText(partialScan.epc, { exact: true }).waitFor();
    await releasedScan.getByText('Reservasi dilepas', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Tutup' }).click();
    assert.equal(cancellations, 1);

    await page.getByRole('button', { name: 'Pengiriman', exact: true }).click();
    await page.getByRole('button', { name: 'Buat Pengiriman Baru' }).click();
    const source = page.getByLabel('Sumber Pengiriman');
    const epcs = page.getByLabel('EPC Pengiriman');
    await source.locator('option').filter({ hasText: 'Penjualan POS · POS-123' }).waitFor({ state: 'attached' });
    assert.equal(await source.locator('option').filter({ hasText: 'ORD-BATAL' }).count(), 0);
    await source.selectOption(`PICKING_ORANG1:${orderId}`);
    assert.equal(await epcs.inputValue(), makeEpc(10));
    await source.selectOption(`OUTBOUND_PICKING:${outboundId}`);
    assert.equal(await epcs.inputValue(), makeEpc(12));
    await source.selectOption('STOK_BEBAS');
    assert.equal(await epcs.inputValue(), '');
    await source.selectOption(`PICKING_ORANG1:${orderId}`);
    await page.getByLabel('Tujuan / Nama Pelanggan').fill('Gudang');
    await page.getByRole('button', { name: 'Terbitkan & Simpan' }).click();
    await page.getByText('Order sumber sudah berubah.', { exact: true }).waitFor();
    assert.equal(await epcs.inputValue(), '');
    assert.equal(await source.inputValue(), '');
    assert.deepEqual(shipmentCalls[0].source, { type: 'PICKING_ORANG1', order_id: orderId });
    await source.selectOption(`POS:${saleId}`);
    assert.equal(await epcs.inputValue(), makeEpc(14));
    await page.getByLabel('No. Resi / Surat Jalan').fill('RESI-POS-MOCK');
    await page.getByLabel('Tujuan / Nama Pelanggan').fill('Tujuan POS');
    await page.getByRole('button', { name: 'Terbitkan & Simpan' }).click();
    await page.getByText('Pengiriman berhasil disimpan.', { exact: true }).waitFor();
    assert.deepEqual(shipmentCalls[1].source, { type: 'POS', sale_id: saleId });
    assert.deepEqual(shipmentCalls[1].epcs, [makeEpc(14)]);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
