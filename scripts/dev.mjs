import { fork, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.DIGIWMS_DEV_FRONTEND_PORT || 3000);
const origin = `http://localhost:${port}`;
const backendUrl = 'http://127.0.0.1:5102/api';
const frontendOnly = process.argv.includes('--frontend-only');
const archive = process.argv.includes('--archive');
const seedPacking = process.argv.includes('--seed-packing');
let child;
let childClosed;
let vite;
let stopping;
let requestedStop = false;
function backendDirectory() {
  const override = process.env.DIGIWMS_DEV_BACKEND_DIR;
  if (override !== undefined && !override.trim()) {
    throw new Error('DIGIWMS_DEV_BACKEND_DIR kosong. Isi path checkout backend atau hapus variabel untuk memakai folder sebelah frontend.');
  }
  const source = override === undefined ? 'Folder backend di sebelah frontend' : 'DIGIWMS_DEV_BACKEND_DIR';
  const selected = override === undefined ? path.resolve(frontend, '../BACKEND-DIGI-WMS') : path.resolve(override);
  if (!statSync(selected, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`${source} tidak menunjuk direktori: ${selected}. Siapkan checkout BACKEND-DIGI-WMS atau atur DIGIWMS_DEV_BACKEND_DIR.`);
  }
  const directory = realpathSync(selected);
  const hasFile = file => statSync(path.join(directory, file), { throwIfNoEntry: false })?.isFile();
  let backendName;
  try {
    backendName = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8')).name;
  } catch {
    throw new Error(`${source} tidak memiliki package.json backend yang bisa dibaca: ${directory}.`);
  }
  if (backendName !== 'digiwms-backend') {
    throw new Error(`${source} bukan checkout BACKEND-DIGI-WMS: ${directory}.`);
  }
  const required = [
    'scripts/dev-backend.cjs', 'scripts/dev-db.cjs', 'scripts/dev-seed-packing.cjs',
    'src/modules/orang1-picking/routes.ts', 'src/modules/orang1-picking/packing.ts',
    'sql/migrations/001_orang1_inbound_audit.sql', 'sql/migrations/002_orang1_picking.sql',
    'sql/migrations/003_orang1_packing.sql', 'sql/migrations/004_orang1_grn_lines.sql',
  ];
  const missing = required.filter(file => !hasFile(file));
  if (missing.length) {
    throw new Error(`Checkout backend belum mendukung Development Picking: ${directory}. File yang kurang: ${missing.join(', ')}. Perbarui checkout backend atau atur DIGIWMS_DEV_BACKEND_DIR.`);
  }
  if (!['tsx', 'pg', 'bcryptjs', 'fastify'].every(pkg => hasFile(`node_modules/${pkg}/package.json`))) {
    throw new Error(`Dependensi backend belum lengkap. Jalankan npm ci di ${directory}.`);
  }
  return directory;
}

function portOwner(value) {
  if (process.platform !== 'win32') return '';
  try {
    return execFileSync('powershell.exe', ['-NoProfile', '-Command',
      `Get-NetTCPConnection -LocalPort ${value} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { $owner = Get-Process -Id $_ -ErrorAction SilentlyContinue; if ($owner) { "PID $($owner.Id) ($($owner.ProcessName))" } }`,
    ], { windowsHide: true, encoding: 'utf8', timeout: 6500, stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\r?\n/).filter(Boolean).join(', ');
  } catch { return ''; }
}

async function checkPort(value, host) {
  const probe = net.createServer();
  try {
    await new Promise((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(value, host, () => probe.close(resolve));
    });
  } catch (error) {
    if (error.code === 'EAFNOSUPPORT' || (host === '::1' && error.code === 'EADDRNOTAVAIL')) return;
    if (error.code === 'EADDRINUSE') {
      const owner = portOwner(value);
      throw new Error(`Port ${value} sudah digunakan${owner ? ' oleh ' + owner : ''}. Hentikan prosesnya secara manual atau pilih DIGIWMS_DEV_FRONTEND_PORT untuk frontend.`);
    }
    throw error;
  }
}

function shutdown() {
  requestedStop = true;
  if (!stopping) {
    stopping = (async () => {
      try { await vite?.close(); }
      finally {
        if (child?.connected) child.send('stop', () => {});
        await childClosed;
      }
    })();
  }
  return stopping;
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  shutdown().catch(error => { console.error('[Development]', error.message); process.exitCode = 1; });
});

async function main() {
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || [5000, 5102, 55436].includes(port)) {
    throw new Error('DIGIWMS_DEV_FRONTEND_PORT harus merupakan port frontend yang valid dan berbeda dari port backend/database.');
  }
  let createViteServer;
  let loginFile;
  if (!archive && !seedPacking) {
    if (!statSync(path.join(frontend, 'node_modules/vite/package.json'), { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`Dependensi frontend belum terpasang. Jalankan npm ci di ${frontend}.`);
    }
    ({ createDigiwmsViteServer: createViteServer } = await import('../dev-server.js'));
    await checkPort(port, '127.0.0.1');
    await checkPort(port, '::1');
  }
  if ((!frontendOnly || archive || seedPacking) && !requestedStop) {
    if (!archive && !seedPacking) await checkPort(5102, '127.0.0.1');
    const cwd = backendDirectory();
    if (requestedStop) return;
    console.log(`[Development] Backend: ${cwd}`);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^(?:PG[A-Z_]|DATABASE_URL$|SUPABASE_|JWT_SECRET$|MQTT_|NODE_OPTIONS$)/i.test(key)));
    const entry = seedPacking ? 'scripts/dev-seed-packing.cjs' : 'scripts/dev-backend.cjs';
    const args = seedPacking ? process.argv.slice(2).filter(arg => arg !== '--seed-packing') : archive ? ['--archive'] : [];
    child = fork(path.join(cwd, entry), args, {
      cwd, env: { ...env, DIGIWMS_DEV_FRONTEND_ORIGIN: origin, DIGIWMS_DEV_SERVICE_ID: randomUUID() },
      // Let the supervisor finish PostgreSQL shutdown over IPC even if npm's console exits first.
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'], windowsHide: true, detached: !seedPacking && process.platform === 'win32',
    });
    childClosed = once(child, 'close').catch(() => [1]);
    if (archive || seedPacking) { const [code] = await childClosed; process.exitCode = code ?? 1; return; }
    const message = await Promise.race([
      once(child, 'message').then(([message]) => message),
      childClosed.then(() => null),
    ]);
    if (requestedStop) return;
    if (!message?.ready) throw new Error('Backend Development berhenti sebelum siap.');
    loginFile = message.loginFile;
  }
  if (requestedStop) return;
  // envFile=false also bypasses Vite's normal env import. Supply the Development values explicitly.
  vite = await createViteServer({
    root: frontend, envFile: false,
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(backendUrl),
      'import.meta.env.VITE_ENABLE_MQTT': JSON.stringify('false'),
      'import.meta.env.VITE_DIGIWMS_LOCAL_DEV': JSON.stringify('true'),
    },
    server: { host: 'localhost', port, strictPort: true },
  });
  if (requestedStop) { await vite.close(); return; }
  await vite.listen();
  console.log(`\n  DigiWMS Development  ${origin}\n  API                  ${backendUrl}`);
  if (loginFile) console.log(`  Akun                 admin.dev\n  File password        ${loginFile}`);
  console.log('  Tekan Ctrl+C untuk menghentikan layanan yang dimulai launcher.\n');
  if (childClosed) {
    await childClosed;
    if (!requestedStop) { process.exitCode = 1; await shutdown(); }
  }
}

main().catch(async error => {
  if (!requestedStop) { console.error('[Development]', error.message); process.exitCode = 1; }
  await shutdown().catch(error => { console.error('[Development]', error.message); process.exitCode = 1; });
});
