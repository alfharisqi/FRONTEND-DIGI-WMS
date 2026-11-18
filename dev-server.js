import { createServer } from 'vite';

async function runServer() {
  const server = await createServer({
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
  });
  await server.listen();
  console.log('[DIGI WMS Frontend] Server running on http://localhost:3000');
}

runServer().catch((err) => {
  console.error('[DIGI WMS Frontend] Failed to start:', err);
  process.exit(1);
});
