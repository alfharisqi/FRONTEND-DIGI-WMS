import mqtt from 'mqtt';

const EMQX_WS_URL = import.meta.env.VITE_MQTT_WS_URL || 'ws://localhost:8083/mqtt';

/**
 * Inisialisasi koneksi langsung dari Browser React.js ke EMQX Broker via WebSocket (Port 8083)
 * Fokus menggunakan MQTT Broker EMQX (Tanpa Socket.io)
 */
export function createEmqxWebSocketClient(onMessageCallback, onStatusChange) {
  const clientId = 'digiwms_web_' + Math.random().toString(16).substring(2, 8);
  let realClient = null;
  let isDisposed = false;
  let isConnected = false;

  // Tunda inisialisasi 120ms agar siklus mount-unmount cepat (React StrictMode / pindah tab)
  // tidak memutus WebSocket yang masih berstatus CONNECTING.
  const connectTimer = setTimeout(() => {
    if (isDisposed) return;

    const client = mqtt.connect(EMQX_WS_URL, {
      clientId,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 3000,
    });
    realClient = client;

    client.on('connect', () => {
      if (isDisposed) {
        client.end(true);
        return;
      }
      isConnected = true;
      console.log(`[EMQX WS] Terhubung ke ${EMQX_WS_URL} (${clientId})`);
      if (onStatusChange) onStatusChange(true);

      // Subscribe ke topik real-time DIGI WMS
      client.subscribe(
        ['wms/stock/realtime', 'wms/tags/encoded', 'wms/opname/+/scan', 'wms/gate/+/alarm', 'wms/pos/live-scan'],
        { qos: 1 }
      );
    });

    client.on('reconnect', () => {
      isConnected = false;
      if (!isDisposed && onStatusChange) onStatusChange(false);
    });

    client.on('close', () => {
      isConnected = false;
      if (!isDisposed && onStatusChange) onStatusChange(false);
    });

    client.on('error', () => {
      // Tangani error diam-diam agar tidak memicu uncaught error di console
    });

    client.on('message', (topic, payloadBuffer) => {
      if (isDisposed) return;
      try {
        const data = JSON.parse(payloadBuffer.toString());
        if (onMessageCallback) onMessageCallback(topic, data);
      } catch (err) {
        console.warn('[EMQX WS] Gagal mem-parsing payload JSON:', err);
      }
    });
  }, 120);

  return {
    get connected() {
      return isConnected;
    },
    end(force = false, opts, cb) {
      isDisposed = true;
      clearTimeout(connectTimer);
      if (!realClient) return;
      if (isConnected) {
        realClient.end(force, opts, cb);
      } else {
        // Jika masih CONNECTING, tutup dengan bersih setelah terbuka atau hentikan reconnect
        realClient.options.reconnectPeriod = 0;
        try {
          realClient.end(false, opts, cb);
        } catch {
          // Abaikan jika socket belum siap
        }
      }
    },
  };
}
