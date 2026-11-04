import mqtt from 'mqtt';

const EMQX_WS_URL = import.meta.env.VITE_MQTT_WS_URL || 'ws://localhost:8083/mqtt';

/**
 * Inisialisasi koneksi langsung dari Browser React.js ke EMQX Broker via WebSocket (Port 8083)
 * Fokus menggunakan MQTT Broker EMQX (Tanpa Socket.io)
 */
export function createEmqxWebSocketClient(onMessageCallback, onStatusChange) {
  const clientId = 'digiwms_web_' + Math.random().toString(16).substring(2, 8);

  const client = mqtt.connect(EMQX_WS_URL, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    console.log(`[EMQX WS] Terhubung ke ${EMQX_WS_URL} (${clientId})`);
    if (onStatusChange) onStatusChange(true);

    // Subscribe ke topik real-time DIGI WMS
    client.subscribe(
      ['wms/stock/realtime', 'wms/tags/encoded', 'wms/opname/+/scan', 'wms/gate/+/alarm'],
      { qos: 1 }
    );
  });

  client.on('reconnect', () => {
    if (onStatusChange) onStatusChange(false);
  });

  client.on('close', () => {
    if (onStatusChange) onStatusChange(false);
  });

  client.on('message', (topic, payloadBuffer) => {
    try {
      const data = JSON.parse(payloadBuffer.toString());
      if (onMessageCallback) onMessageCallback(topic, data);
    } catch (err) {
      console.warn('[EMQX WS] Gagal mem-parsing payload JSON:', err);
    }
  });

  return client;
}
