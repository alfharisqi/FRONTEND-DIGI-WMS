import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

test('Picking UI handles shortages, partial batch, and Packing using the EPC checklist with mocked APIs', {
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
    const makeEpc = index => String(index).padStart(24, '0');
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
      if (url.pathname === '/api/picking/availability') {
        const productId = url.searchParams.get('product_id');
        return send({ product_id: productId, available_qty: productId === monitor.id ? stock.length : 0 });
      }
      if (url.pathname === '/api/picking/orders') {
        if (method === 'GET') return send([snapshot()]);
        creates++;
        stock.pop();
        return send(null, 409, { message: 'Stok berubah sejak terakhir diperiksa.' });
      }
      if (url.pathname.endsWith('/available-epcs')) return send({ order_id: orderId, lines: snapshot(true).lines });
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
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
