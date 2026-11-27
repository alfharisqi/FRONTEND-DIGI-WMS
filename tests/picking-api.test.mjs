import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const buildResult = await build({
  entryPoints: ['src/modules/orang1-picking/api.js'], bundle: true, write: false, format: 'esm',
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('http://test.local/api'),
    'import.meta.env.VITE_DIGIWMS_LOCAL_DEV': JSON.stringify('false'),
  },
});
const source = Buffer.from(buildResult.outputFiles[0].text).toString('base64');
const { pickingRequest, validatePickingSelection } = await import(`data:text/javascript;base64,${source}`);
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: key => {
  assert.equal(key, 'digiwms_token');
  return 'test-token';
} } });
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('Picking reads use the existing Bearer token and bypass cached stock', async () => {
  const controller = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://test.local/api/picking/availability?product_id=fixture');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.method, 'GET');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, controller.signal);
    return Response.json({ success: true, data: { available_qty: 2 } });
  };
  assert.deepEqual(await pickingRequest('/availability?product_id=fixture', { signal: controller.signal }), { available_qty: 2 });
});

test('bulk validation awaits each existing scan call and continues after a definite EPC rejection', async () => {
  let running = 0;
  const progress = [];
  const attempted = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://test.local/api/picking/scan');
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    assert.equal(body.order_id, 'fixture-order');
    attempted.push(body.epc);
    assert.equal(++running, 1);
    await new Promise(resolve => setImmediate(resolve));
    running--;
    if (body.epc === 'B') {
      return Response.json({ success: false, message: 'EPC sudah direservasi', code: 'PICKING_SCAN_REJECTED' }, { status: 409 });
    }
    return Response.json({ success: true, data: { order: { status: 'SEDANG_DIAMBIL' } } });
  };
  const outcome = await validatePickingSelection(['A', 'B', 'C'], async epc => {
    return (await pickingRequest('/scan', { body: { order_id: 'fixture-order', epc } })).order;
  }, current => progress.push(current));
  assert.deepEqual(attempted, ['A', 'B', 'C']);
  assert.deepEqual(progress, [1, 2, 3]);
  assert.deepEqual(outcome, { succeeded: 2, failures: [{ epc: 'B', message: 'EPC sudah direservasi' }], interrupted: null, unattempted: 0 });
});

test('a batch stops without retry for auth, database, network, invalid response, and ambiguous conflict', async () => {
  const responses = [
    () => Response.json({ success: false, message: 'Sesi berakhir' }, { status: 401 }),
    () => Response.json({ success: false, message: 'Database tidak siap' }, { status: 503 }),
    () => { throw new Error('offline'); },
    () => new Response('invalid json', { status: 200 }),
    () => Response.json({ success: false, message: 'Konflik transaksi' }, { status: 409 }),
  ];
  for (const failure of responses) {
    const attempted = [];
    globalThis.fetch = async (_, options) => {
      const { epc } = JSON.parse(options.body);
      attempted.push(epc);
      return epc === 'A' ? Response.json({ success: true, data: { status: 'SEDANG_DIAMBIL' } }) : failure();
    };
    const outcome = await validatePickingSelection(['A', 'B', 'C'], epc => pickingRequest('/scan', {
      body: { order_id: 'fixture-order', epc },
    }), () => {});
    assert.deepEqual(attempted, ['A', 'B']);
    assert.equal(outcome.succeeded, 1);
    assert.equal(outcome.failures.length, 0);
    assert.equal(outcome.interrupted.epc, 'B');
    assert.equal(outcome.unattempted, 1);
  }
});

test('a ready order stops before submitting additional EPCs', async () => {
  const attempted = [];
  const outcome = await validatePickingSelection(['A', 'B'], async epc => {
    attempted.push(epc);
    return { status: 'SIAP_PACKING' };
  }, () => {});
  assert.deepEqual(attempted, ['A']);
  assert.deepEqual(outcome, { succeeded: 1, failures: [], interrupted: null, unattempted: 1 });
});
