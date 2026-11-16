import mqtt from 'mqtt';

const EMQX_WS_URL = import.meta.env.VITE_MQTT_WS_URL || 'ws://localhost:8083/mqtt';

export function createMqttSubscription(onEvent, onStatusChange) {
  // Hanya konek otomatis ke EMQX WS jika VITE_ENABLE_MQTT=true, agar browser console bersih saat tanpa Docker EMQX
  const enableLiveWs = import.meta.env.VITE_ENABLE_MQTT === 'true';
  if (!enableLiveWs) {
    if (onStatusChange) onStatusChange(false);
    return { disconnect: () => {} };
  }

  const clientId = 'digiwms_web_' + Math.random().toString(16).substring(2, 8);
  const client = mqtt.connect(EMQX_WS_URL, {
    clientId,
    clean: true,
    connectTimeout: 3000,
    reconnectPeriod: 0,
  });

  client.on('connect', () => {
    if (onStatusChange) onStatusChange(true);
    client.subscribe(['digiwms/#', 'wms/#'], { qos: 0 });
  });

  client.on('error', () => {
    if (onStatusChange) onStatusChange(false);
    client.end(true);
  });

  client.on('close', () => {
    if (onStatusChange) onStatusChange(false);
  });

  client.on('message', (topic, payloadBuffer) => {
    try {
      const payload = JSON.parse(payloadBuffer.toString());
      if (onEvent) {
        onEvent({
          topic,
          payload,
          receivedAt: new Date().toLocaleTimeString('id-ID'),
        });
      }
    } catch {
      // Ignore malformed JSON
    }
  });

  return {
    disconnect: () => client.end(true),
  };
}
