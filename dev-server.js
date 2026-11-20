import { createServer } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function createDigiwmsViteServer(options = {}) {
  return createServer({
    ...options,
    server: { port: 3000, host: '0.0.0.0', ...options.server },
  });
}

async function runServer() {
  const server = await createDigiwmsViteServer();
  await server.listen();
  console.log('[DIGI WMS Frontend] Server running on http://localhost:3000');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runServer().catch((err) => {
    console.error('[DIGI WMS Frontend] Failed to start:', err);
    process.exit(1);
  });
}
